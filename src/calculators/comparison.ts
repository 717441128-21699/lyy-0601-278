import { BillComparison, Bill, FeeType, FeeDetail, RoundingMode } from '../types';
import { roundAmount } from '../utils/rounding';

export interface BillComparisonInput {
  currentBill: Bill;
  previousBill: Bill;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function compareBills(input: BillComparisonInput): BillComparison {
  const { currentBill, previousBill, roundingMode = 'round', precision = 2 } = input;

  const currentTotal = currentBill.summary.totalAmount;
  const previousTotal = previousBill.summary.totalAmount;
  const difference = roundAmount(currentTotal - previousTotal, roundingMode, precision);

  let percentageChange = 0;
  if (previousTotal !== 0) {
    percentageChange = roundAmount(((currentTotal - previousTotal) / Math.abs(previousTotal)) * 100, roundingMode, 2);
  }

  const itemDifferences: BillComparison['itemDifferences'] = [];

  const allTypes: FeeType[] = ['rent', 'deposit', 'water', 'electricity', 'gas', 'service', 'penalty', 'late_fee', 'discount'];

  for (const type of allTypes) {
    const currentFees = currentBill.feeDetails.filter((f) => f.type === type);
    const previousFees = previousBill.feeDetails.filter((f) => f.type === type);

    if (currentFees.length > 0 || previousFees.length > 0) {
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

      if (diff !== 0 || currentAmount !== 0 || previousAmount !== 0) {
        const name = getFeeTypeName(type);
        itemDifferences.push({
          type,
          name,
          currentAmount,
          previousAmount,
          difference: diff,
        });
      }
    }
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
      .map((d) => `${d.name}${d.difference > 0 ? '+' : ''}${d.difference}元`)
      .join('、');
    summary += `，其中${changeDetails}`;
  }

  return {
    currentBillId: currentBill.summary.billId,
    previousBillId: previousBill.summary.billId,
    difference,
    percentageChange,
    itemDifferences,
    summary,
  };
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

export function getFeeDetailsSummary(feeDetails: FeeDetail[]): string[] {
  const summaries: string[] = [];
  for (const fee of feeDetails) {
    summaries.push(`${fee.name}：${fee.amount}元 - ${fee.description}`);
  }
  return summaries;
}
