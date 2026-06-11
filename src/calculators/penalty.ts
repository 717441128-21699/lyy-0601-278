import { PenaltyRule, LateFeeRule, FeeDetail, RoundingMode } from '../types';
import { roundAmount } from '../utils/rounding';
import { daysBetween, formatDate } from '../utils/date';

export interface PenaltyCalculationInput {
  penaltyRule?: PenaltyRule;
  baseAmount: number;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculatePenalty(input: PenaltyCalculationInput): FeeDetail | null {
  const { penaltyRule, baseAmount, roundingMode = 'round', precision = 2 } = input;

  if (!penaltyRule || !penaltyRule.enabled) {
    return null;
  }

  let amount = (baseAmount * penaltyRule.percentage) / 100;

  if (penaltyRule.minAmount && amount < penaltyRule.minAmount) {
    amount = penaltyRule.minAmount;
  }
  if (penaltyRule.maxAmount && amount > penaltyRule.maxAmount) {
    amount = penaltyRule.maxAmount;
  }

  amount = roundAmount(amount, roundingMode, precision);

  return {
    type: 'penalty',
    name: '违约金',
    amount,
    description: `按${penaltyRule.percentage}%比例计算的违约金${penaltyRule.conditions ? '：' + penaltyRule.conditions : ''}`,
    breakdown: [
      { label: '计算基数', value: baseAmount },
      { label: '违约金比例', value: penaltyRule.percentage },
      ...(penaltyRule.minAmount ? [{ label: '最低违约金', value: penaltyRule.minAmount }] : []),
      ...(penaltyRule.maxAmount ? [{ label: '最高违约金', value: penaltyRule.maxAmount }] : []),
      { label: '违约金金额', value: amount },
    ],
  };
}

export interface LateFeeCalculationInput {
  lateFeeRule?: LateFeeRule;
  baseAmount: number;
  dueDate?: string;
  actualPaymentDate?: string;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculateLateFee(input: LateFeeCalculationInput): FeeDetail | null {
  const {
    lateFeeRule,
    baseAmount,
    dueDate,
    actualPaymentDate,
    roundingMode = 'round',
    precision = 2,
  } = input;

  if (!lateFeeRule || !lateFeeRule.enabled || !dueDate || !actualPaymentDate) {
    return null;
  }

  const due = new Date(dueDate);
  const paid = new Date(actualPaymentDate);

  if (paid <= due) {
    return {
      type: 'late_fee',
      name: '滞纳金',
      amount: 0,
      description: '在宽限期内支付，无滞纳金',
      breakdown: [
        { label: '应付款日期', value: 0 },
        { label: '实际付款日期', value: 0 },
        { label: '逾期天数', value: 0 },
      ],
    };
  }

  const graceDays = lateFeeRule.graceDays || 0;
  const graceEnd = new Date(due);
  graceEnd.setDate(graceEnd.getDate() + graceDays);

  if (paid <= graceEnd) {
    return {
      type: 'late_fee',
      name: '滞纳金',
      amount: 0,
      description: `在宽限期(${graceDays}天)内支付，无滞纳金`,
      breakdown: [
        { label: '应付款日期', value: 0 },
        { label: '宽限期天数', value: graceDays },
        { label: '逾期天数', value: 0 },
      ],
    };
  }

  const overdueStart = new Date(graceEnd.getTime() + 86400000);
  const overdueDays = daysBetween(
    formatDate(overdueStart),
    actualPaymentDate
  ) + 1;

  let amount = (baseAmount * lateFeeRule.dailyRate * overdueDays) / 100;

  if (lateFeeRule.minAmount && amount < lateFeeRule.minAmount) {
    amount = lateFeeRule.minAmount;
  }
  if (lateFeeRule.maxAmount && amount > lateFeeRule.maxAmount) {
    amount = lateFeeRule.maxAmount;
  }

  amount = roundAmount(amount, roundingMode, precision);

  return {
    type: 'late_fee',
    name: '滞纳金',
    amount,
    description: `逾期${overdueDays}天，按日利率${lateFeeRule.dailyRate}%计算`,
    breakdown: [
      { label: '计算基数', value: baseAmount },
      { label: '日利率', value: lateFeeRule.dailyRate },
      { label: '逾期天数', value: overdueDays },
      ...(lateFeeRule.minAmount ? [{ label: '最低滞纳金', value: lateFeeRule.minAmount }] : []),
      ...(lateFeeRule.maxAmount ? [{ label: '最高滞纳金', value: lateFeeRule.maxAmount }] : []),
      { label: '滞纳金金额', value: amount },
    ],
  };
}
