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
      breakdown.push({ label: '计费方式', value: 1 });
      breakdown.push({ label: '固定金额', value: service.amount });
    } else if (service.cycle === 'daily') {
      const days = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      amount = service.amount * days;
      description = `${service.type}（按日，${days}天）`;
      breakdown.push({ label: '计费天数', value: days });
      breakdown.push({ label: '日费用', value: service.amount });
    } else if (service.cycle === 'weekly') {
      const totalDays = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      const fullWeeks = Math.floor(totalDays / 7);
      const remainingDays = totalDays % 7;
      const weeklyDailyRate = service.amount / 7;
      amount = fullWeeks * service.amount + remainingDays * weeklyDailyRate;
      description = `${service.type}（按周，${fullWeeks}整周+${remainingDays}天）`;
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '整周数', value: fullWeeks });
      breakdown.push({ label: '周费用', value: service.amount });
      if (remainingDays > 0) {
        breakdown.push({ label: '零散天数', value: remainingDays });
        breakdown.push({ label: '周折算日费用', value: roundAmount(weeklyDailyRate, roundingMode, precision) });
        breakdown.push({ label: '零散天数费用', value: roundAmount(remainingDays * weeklyDailyRate, roundingMode, precision) });
      }
    } else if (service.cycle === 'quarterly') {
      const totalDays = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      const daysPerQuarter = 90;
      const fullQuarters = Math.floor(totalDays / daysPerQuarter);
      const remainingDays = totalDays % daysPerQuarter;
      const quarterlyDailyRate = service.amount / daysPerQuarter;
      amount = fullQuarters * service.amount + remainingDays * quarterlyDailyRate;
      description = `${service.type}（按季度，${fullQuarters}整季度+${remainingDays}天）`;
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '整季度数', value: fullQuarters });
      breakdown.push({ label: '季度费用', value: service.amount });
      if (remainingDays > 0) {
        breakdown.push({ label: '零散天数', value: remainingDays });
        breakdown.push({ label: '季度折算日费用', value: roundAmount(quarterlyDailyRate, roundingMode, precision) });
        breakdown.push({ label: '零散天数费用', value: roundAmount(remainingDays * quarterlyDailyRate, roundingMode, precision) });
      }
    } else {
      const totalDays = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
      const daysPerMonth = 30;
      const fullMonths = Math.floor(totalDays / daysPerMonth);
      const remainingDays = totalDays % daysPerMonth;
      const monthlyDailyRate = service.amount / daysPerMonth;
      amount = fullMonths * service.amount + remainingDays * monthlyDailyRate;
      description = `${service.type}（按月，${fullMonths}整月+${remainingDays}天）`;
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '整月数', value: fullMonths });
      breakdown.push({ label: '月费用', value: service.amount });
      if (remainingDays > 0) {
        breakdown.push({ label: '零散天数', value: remainingDays });
        breakdown.push({ label: '月折算日费用', value: roundAmount(monthlyDailyRate, roundingMode, precision) });
        breakdown.push({ label: '零散天数费用', value: roundAmount(remainingDays * monthlyDailyRate, roundingMode, precision) });
      }
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
