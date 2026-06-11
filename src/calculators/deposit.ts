import { DepositRule, FeeDetail, RoundingMode, RefundSuggestion } from '../types';
import { roundAmount } from '../utils/rounding';
import { addDays } from '../utils/date';

export interface DepositCalculationInput {
  depositRule?: DepositRule;
  moveOutDate?: string;
  roundingMode?: RoundingMode;
  precision?: number;
}

export interface DepositResult {
  frozen: FeeDetail | null;
  refund: FeeDetail | null;
  refundSuggestion?: RefundSuggestion;
}

export function calculateDeposit(input: DepositCalculationInput): DepositResult {
  const { depositRule, moveOutDate, roundingMode = 'round', precision = 2 } = input;

  if (!depositRule) {
    return { frozen: null, refund: null };
  }

  const frozenAmount = roundAmount(depositRule.amount, roundingMode, precision);
  const frozenDetail: FeeDetail = {
    type: 'deposit',
    name: '押金冻结',
    amount: frozenAmount,
    description: `押金冻结金额，冻结期${depositRule.freezeDays || 0}天`,
    breakdown: [
      { label: '押金金额', value: depositRule.amount },
      { label: '冻结天数', value: depositRule.freezeDays || 0 },
    ],
  };

  if (!moveOutDate) {
    return { frozen: frozenDetail, refund: null };
  }

  let refundAmount = depositRule.amount;
  const refundItems: { reason: string; amount: number }[] = [];

  if (depositRule.deductions && depositRule.deductions.length > 0) {
    depositRule.deductions.forEach((deduction) => {
      refundAmount -= deduction.amount;
      refundItems.push({ reason: deduction.reason, amount: deduction.amount });
    });
  }

  refundAmount = Math.max(0, refundAmount);
  refundAmount = roundAmount(refundAmount, roundingMode, precision);

  const refundDetail: FeeDetail = {
    type: 'deposit',
    name: '押金退还',
    amount: refundAmount,
    description: `退房后${depositRule.refundDays || 0}天内退还押金`,
    breakdown: [
      { label: '原押金金额', value: depositRule.amount },
      ...refundItems.map((item) => ({ label: `扣除:${item.reason}`, value: item.amount })),
      { label: '实际退还金额', value: refundAmount },
    ],
  };

  const refundSuggestion: RefundSuggestion = {
    shouldRefund: refundAmount > 0,
    refundAmount,
    refundItems,
    suggestedDate: depositRule.refundDays ? addDays(moveOutDate, depositRule.refundDays) : undefined,
  };

  return {
    frozen: frozenDetail,
    refund: refundDetail,
    refundSuggestion,
  };
}
