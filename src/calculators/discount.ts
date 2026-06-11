import { DiscountRule, FeeDetail, FeeType, RoundingMode } from '../types';
import { roundAmount } from '../utils/rounding';

export interface DiscountCalculationInput {
  discounts?: DiscountRule[];
  feeDetails: FeeDetail[];
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculateDiscounts(input: DiscountCalculationInput): FeeDetail[] {
  const { discounts, feeDetails, roundingMode = 'round', precision = 2 } = input;

  if (!discounts || discounts.length === 0) {
    return [];
  }

  const results: FeeDetail[] = [];

  for (const discount of discounts) {
    const applicableFees = feeDetails.filter((fee) => discount.applyTo.includes(fee.type));

    if (applicableFees.length === 0) {
      continue;
    }

    const applicableTotal = applicableFees.reduce((sum, fee) => sum + fee.amount, 0);

    if (discount.minAmount && applicableTotal < discount.minAmount) {
      continue;
    }

    let discountAmount = 0;
    const breakdown: { label: string; value: number }[] = [];

    if (discount.type === 'fixed') {
      discountAmount = Math.min(discount.amount, applicableTotal);
      breakdown.push({ label: '减免类型', value: 1 });
      breakdown.push({ label: '固定减免金额', value: discount.amount });
    } else if (discount.type === 'percentage') {
      discountAmount = (applicableTotal * discount.amount) / 100;
      breakdown.push({ label: '减免类型', value: 2 });
      breakdown.push({ label: '减免比例', value: discount.amount });
      breakdown.push({ label: '计算基数', value: applicableTotal });
    } else if (discount.type === 'rent_free_days') {
      const rentFee = applicableFees.find((f) => f.type === 'rent');
      if (rentFee && rentFee.breakdown) {
        const dailyRateItem = rentFee.breakdown.find((b) => b.label.includes('日租金'));
        if (dailyRateItem) {
          discountAmount = dailyRateItem.value * discount.amount;
        }
      }
      breakdown.push({ label: '减免类型', value: 3 });
      breakdown.push({ label: '免租天数', value: discount.amount });
    }

    discountAmount = roundAmount(discountAmount, roundingMode, precision);
    breakdown.push({ label: '适用费用项', value: applicableFees.length });
    breakdown.push({ label: '实际减免金额', value: discountAmount });

    if (discountAmount > 0) {
      results.push({
        type: 'discount',
        name: discount.description || '费用减免',
        amount: -discountAmount,
        description: discount.description || `减免${discountAmount}元`,
        breakdown,
      });
    }
  }

  return results;
}
