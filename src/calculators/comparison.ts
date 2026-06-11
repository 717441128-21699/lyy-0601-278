import { BillComparison, Bill, FeeType, RoundingMode } from '../types';
import { roundAmount } from '../utils/rounding';

export interface BillComparisonInput {
  currentBill: Bill;
  previousBill: Bill;
  anomalyThreshold?: number;
  anomalyPercentageThreshold?: number;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function compareBills(input: BillComparisonInput): BillComparison {
  const {
    currentBill,
    previousBill,
    anomalyThreshold = 50,
    anomalyPercentageThreshold = 20,
    roundingMode = 'round',
    precision = 2,
  } = input;

  const currentTotal = currentBill.summary.totalAmount;
  const previousTotal = previousBill.summary.totalAmount;
  const difference = roundAmount(currentTotal - previousTotal, roundingMode, precision);

  let percentageChange = 0;
  if (previousTotal !== 0) {
    percentageChange = roundAmount(((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100, roundingMode, 2);
  }

  const itemDifferences: BillComparison['itemDifferences'] = [];
  const anomalies: string[] = [];

  const allTypes: FeeType[] = ['rent', 'deposit', 'water', 'electricity', 'gas', 'service', 'penalty', 'late_fee', 'discount'];

  for (const type of allTypes) {
    const currentFees = currentBill.feeDetails.filter((f) => f.type === type);
    const previousFees = previousBill.feeDetails.filter((f) => f.type === type);

    if (currentFees.length === 0 && previousFees.length === 0) continue;

    const currentAmount = roundAmount(
      currentFees.reduce((sum, f) => sum + f.amount, 0),
      roundingMode,
      precision
    );
    const previousAmount = roundAmount(
      previousFees.reduce((sum, f) => sum + f.amount, 0),
      roundingMode,
      precision
    );
    const diff = roundAmount(currentAmount - previousAmount, roundingMode, precision);

    if (diff === 0 && currentAmount === 0 && previousAmount === 0) continue;

    const name = getFeeTypeName(type);
    const reason = buildChangeReason(type, name, currentAmount, previousAmount, diff, currentFees, previousFees);
    const isAnomaly = checkAnomaly(diff, previousAmount, anomalyThreshold, anomalyPercentageThreshold);

    if (isAnomaly) {
      const direction = diff > 0 ? '增加' : '减少';
      const absDiff = Math.abs(diff);
      const pct = previousAmount !== 0 ? Math.abs((diff / previousAmount) * 100).toFixed(1) : '∞';
      anomalies.push(`${name}${direction}${absDiff}元（${pct}%），超过阈值`);
    }

    itemDifferences.push({
      type,
      name,
      currentAmount,
      previousAmount,
      difference: diff,
      reason,
      isAnomaly,
    });
  }

  let summary = '';
  if (difference > 0) {
    summary = `本期账单较上期增加${difference}元（+${percentageChange}%）`;
  } else if (difference < 0) {
    summary = `本期账单较上期减少${Math.abs(difference)}元（${percentageChange}%）`;
  } else {
    summary = '本期账单与上期金额相同';
  }

  const significantChanges = itemDifferences.filter((d) => Math.abs(d.difference) > 0);
  if (significantChanges.length > 0) {
    const changeDetails = significantChanges
      .map((d) => `${d.name}${d.difference > 0 ? '+' : ''}${d.difference}元（${d.reason}）`)
      .join('；');
    summary += `，其中${changeDetails}`;
  }

  return {
    currentBillId: currentBill.summary.billId,
    previousBillId: previousBill.summary.billId,
    difference,
    percentageChange,
    itemDifferences,
    anomalies,
    summary,
  };
}

function buildChangeReason(
  type: FeeType,
  name: string,
  current: number,
  previous: number,
  diff: number,
  currentFees: { description: string }[],
  previousFees: { description: string }[]
): string {
  if (diff === 0) return `${name}无变化`;

  const direction = diff > 0 ? '增加' : '减少';

  if (previous === 0 && current > 0) {
    return `${name}本期新增`;
  }
  if (current === 0 && previous > 0) {
    return `${name}本期未产生`;
  }

  switch (type) {
    case 'rent':
      return `租金${direction}${Math.abs(diff)}元，可能因租期天数或单价变化`;
    case 'water':
      return `水费${direction}${Math.abs(diff)}元，可能因用水量变化`;
    case 'electricity':
      return `电费${direction}${Math.abs(diff)}元，可能因用电量变化`;
    case 'gas':
      return `燃气费${direction}${Math.abs(diff)}元，可能因用气量变化`;
    case 'service':
      return `服务费${direction}${Math.abs(diff)}元，可能因账期天数或服务项目变化`;
    case 'penalty':
      return `违约金${direction}${Math.abs(diff)}元`;
    case 'late_fee':
      return `滞纳金${direction}${Math.abs(diff)}元，可能因逾期天数变化`;
    case 'discount':
      return `优惠${diff > 0 ? '减少' : '增加'}${Math.abs(diff)}元`;
    default:
      return `${name}${direction}${Math.abs(diff)}元`;
  }
}

function checkAnomaly(
  diff: number,
  previousAmount: number,
  amountThreshold: number,
  percentageThreshold: number
): boolean {
  if (Math.abs(diff) >= amountThreshold) return true;
  if (previousAmount !== 0 && Math.abs((diff / previousAmount) * 100) >= percentageThreshold) return true;
  if (previousAmount === 0 && diff !== 0) return true;
  return false;
}

function getFeeTypeName(type: FeeType): string {
  const names: Record<FeeType, string> = {
    rent: '租金',
    deposit: '押金',
    water: '水费',
    electricity: '电费',
    gas: '燃气费',
    service: '服务费',
    penalty: '违约金',
    late_fee: '滞纳金',
    discount: '优惠减免',
  };
  return names[type] || type;
}

export function getFeeDetailsSummary(feeDetails: { name: string; amount: number; description: string }[]): string[] {
  const summaries: string[] = [];
  for (const fee of feeDetails) {
    summaries.push(`${fee.name}：${fee.amount}元 - ${fee.description}`);
  }
  return summaries;
}
