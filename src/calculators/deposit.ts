import { DepositRule, RoundingMode, RefundSuggestion } from '../types';
import { roundAmount } from '../utils/rounding';
import { addDays } from '../utils/date';

export interface DepositCalculationInput {
  depositRule?: DepositRule;
  moveOutDate?: string;
  roundingMode?: RoundingMode;
  precision?: number;
}

export interface DepositResult {
  refundSuggestion?: RefundSuggestion;
}

export function calculateDeposit(input: DepositCalculationInput): DepositResult {
  const { depositRule, moveOutDate, roundingMode = 'round', precision = 2 } = input;

  if (!depositRule) {
    return {};
  }

  if (!moveOutDate) {
    return {};
  }

  let refundAmount = depositRule.amount;
  const deductions: { reason: string; amount: number }[] = [];

  if (depositRule.deductions && depositRule.deductions.length > 0) {
    depositRule.deductions.forEach((deduction) => {
      refundAmount -= deduction.amount;
      deductions.push({ reason: deduction.reason, amount: deduction.amount });
    });
  }

  refundAmount = Math.max(0, refundAmount);
  refundAmount = roundAmount(refundAmount, roundingMode, precision);

  const refundSuggestion: RefundSuggestion = {
    shouldRefund: refundAmount > 0,
    originalDeposit: depositRule.amount,
    refundAmount,
    deductions,
    suggestedDate: depositRule.refundDays ? addDays(moveOutDate, depositRule.refundDays) : undefined,
  };

  return { refundSuggestion };
}
