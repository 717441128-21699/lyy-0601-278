import { ServiceFeeRule, FeeDetail, RoundingMode, DateRange } from '../types';
import { roundAmount } from '../utils/rounding';
import { daysBetween } from '../utils/date';

export interface ServiceFeeCalculationInput {
  services?: ServiceFeeRule[];
  billingPeriod: DateRange;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculateServiceFees(input: ServiceFeeCalculationInput): FeeDetail[] {
  const { services, billingPeriod, roundingMode = 'round', precision = 2 } = input;

  if (!services || services.length === 0) {
    return [];
  }

  const results: FeeDetail[] = [];

  for (const service of services) {
    let amount = service.amount;
    let description = '';
    const breakdown: { label: string; value: number }[] = [];

    if (service.cycle === 'one_time') {
      description = `${service.type}（一次性）`;
      breakdown.push({ label: '类型', value: 1 });
    } else if (service.cycle === 'daily') {
      const days = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      amount = service.amount * days;
      description = `${service.type}（按日）`;
      breakdown.push({ label: '计费天数', value: days });
      breakdown.push({ label: '日费用', value: service.amount });
    } else if (service.cycle === 'weekly') {
      const days = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      const weeks = Math.ceil(days / 7);
      amount = service.amount * weeks;
      description = `${service.type}（按周）`;
      breakdown.push({ label: '计费周数', value: weeks });
      breakdown.push({ label: '周费用', value: service.amount });
    } else if (service.cycle === 'quarterly') {
      description = `${service.type}（按季度）`;
      breakdown.push({ label: '季度费用', value: service.amount });
    } else {
      description = `${service.type}（按月）`;
      breakdown.push({ label: '月费用', value: service.amount });
    }

    amount = roundAmount(amount, roundingMode, precision);
    breakdown.push({ label: '小计', value: amount });

    results.push({
      type: 'service',
      name: service.type,
      amount,
      description,
      breakdown,
    });
  }

  return results;
}
