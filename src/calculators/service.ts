import { ServiceFeeRule, FeeDetail, RoundingMode, DateRange, BillingPeriodMode } from '../types';
import { roundAmount } from '../utils/rounding';
import { daysBetween, isNaturalMonth, isNaturalQuarter, splitIntoNaturalMonths, parseDate } from '../utils/date';

export interface ServiceFeeCalculationInput {
  services?: ServiceFeeRule[];
  billingPeriod: DateRange;
  billingPeriodMode?: BillingPeriodMode;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculateServiceFees(input: ServiceFeeCalculationInput): FeeDetail[] {
  const { services, billingPeriod, billingPeriodMode, roundingMode = 'round', precision = 2 } = input;

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
      const result = calcQuarterlyFee(service.amount, billingPeriod, billingPeriodMode, roundingMode, precision);
      amount = result.amount;
      description = result.description;
      breakdown.push(...result.breakdown);
    } else {
      const result = calcMonthlyFee(service.amount, billingPeriod, billingPeriodMode, roundingMode, precision);
      amount = result.amount;
      description = result.description;
      breakdown.push(...result.breakdown);
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

function calcMonthlyFee(
  serviceAmount: number,
  billingPeriod: DateRange,
  billingPeriodMode: BillingPeriodMode | undefined,
  roundingMode: RoundingMode,
  precision: number
): { amount: number; description: string; breakdown: { label: string; value: number }[] } {
  const mode = billingPeriodMode || 'custom_days';
  const breakdown: { label: string; value: number }[] = [];
  const daysPerMonth = 30;

  if (mode === 'natural_month' || mode === 'natural_quarter') {
    const months = splitIntoNaturalMonths(billingPeriod.startDate, billingPeriod.endDate);
    let fullMonths = 0;
    let partialDays = 0;

    for (const m of months) {
      if (isNaturalMonth(m.startDate, m.endDate)) {
        fullMonths++;
      } else {
        partialDays += daysBetween(m.startDate, m.endDate) + 1;
      }
    }

    const fullAmount = fullMonths * serviceAmount;
    const dailyRate = serviceAmount / daysPerMonth;
    const partialAmount = partialDays * dailyRate;
    const amount = fullAmount + partialAmount;
    const modeLabel = mode === 'natural_month' ? '自然月口径' : '自然季度口径';

    if (partialDays > 0) {
      breakdown.push({ label: '账期口径', value: mode === 'natural_month' ? 1 : 2 });
      breakdown.push({ label: '完整月数', value: fullMonths });
      breakdown.push({ label: '月费用', value: serviceAmount });
      breakdown.push({ label: '零散天数', value: partialDays });
      breakdown.push({ label: '月折算日费用', value: roundAmount(dailyRate, roundingMode, precision) });
      breakdown.push({ label: '零散天数费用', value: roundAmount(partialAmount, roundingMode, precision) });
      return { amount, description: `月费（${modeLabel}，${fullMonths}完整月+${partialDays}天）`, breakdown };
    } else {
      breakdown.push({ label: '账期口径', value: mode === 'natural_month' ? 1 : 2 });
      breakdown.push({ label: '完整月数', value: fullMonths });
      breakdown.push({ label: '月费用', value: serviceAmount });
      return { amount, description: `月费（${modeLabel}，${fullMonths}完整月）`, breakdown };
    }
  } else {
    const totalDays = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
    const fullMonths = Math.floor(totalDays / daysPerMonth);
    const remainingDays = totalDays % daysPerMonth;
    const dailyRate = serviceAmount / daysPerMonth;
    const fullAmount = fullMonths * serviceAmount;
    const partialAmount = remainingDays * dailyRate;
    const amount = fullAmount + partialAmount;

    if (remainingDays > 0) {
      breakdown.push({ label: '账期口径', value: 3 });
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '完整月数', value: fullMonths });
      breakdown.push({ label: '月费用', value: serviceAmount });
      breakdown.push({ label: '零散天数', value: remainingDays });
      breakdown.push({ label: '月折算日费用', value: roundAmount(dailyRate, roundingMode, precision) });
      breakdown.push({ label: '零散天数费用', value: roundAmount(partialAmount, roundingMode, precision) });
      return { amount, description: `月费（自定义天数口径，${fullMonths}完整月+${remainingDays}天）`, breakdown };
    } else {
      breakdown.push({ label: '账期口径', value: 3 });
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '完整月数', value: fullMonths });
      breakdown.push({ label: '月费用', value: serviceAmount });
      return { amount, description: `月费（自定义天数口径，${fullMonths}完整月）`, breakdown };
    }
  }
}

function calcQuarterlyFee(
  serviceAmount: number,
  billingPeriod: DateRange,
  billingPeriodMode: BillingPeriodMode | undefined,
  roundingMode: RoundingMode,
  precision: number
): { amount: number; description: string; breakdown: { label: string; value: number }[] } {
  const mode = billingPeriodMode || 'custom_days';
  const breakdown: { label: string; value: number }[] = [];
  const daysPerQuarter = 90;
  const quarterStartMonths = [0, 3, 6, 9];

  if (mode === 'natural_month' || mode === 'natural_quarter') {
    const months = splitIntoNaturalMonths(billingPeriod.startDate, billingPeriod.endDate);

    type MonthInfo = { startDate: string; endDate: string; isFull: boolean; monthIndex: number };
    const monthInfos: MonthInfo[] = months.map(m => ({
      startDate: m.startDate,
      endDate: m.endDate,
      isFull: isNaturalMonth(m.startDate, m.endDate),
      monthIndex: parseDate(m.startDate).getMonth(),
    }));

    let fullQuarters = 0;
    let partialDays = 0;
    let i = 0;

    while (i < monthInfos.length) {
      if (
        i + 2 < monthInfos.length &&
        monthInfos[i].isFull &&
        monthInfos[i + 1].isFull &&
        monthInfos[i + 2].isFull &&
        quarterStartMonths.includes(monthInfos[i].monthIndex)
      ) {
        fullQuarters++;
        i += 3;
      } else {
        partialDays += daysBetween(monthInfos[i].startDate, monthInfos[i].endDate) + 1;
        i++;
      }
    }

    const fullAmount = fullQuarters * serviceAmount;
    const dailyRate = serviceAmount / daysPerQuarter;
    const partialAmount = partialDays * dailyRate;
    const amount = fullAmount + partialAmount;
    const modeLabel = mode === 'natural_month' ? '自然月口径' : '自然季度口径';

    if (partialDays > 0) {
      breakdown.push({ label: '账期口径', value: mode === 'natural_month' ? 1 : 2 });
      breakdown.push({ label: '完整季度数', value: fullQuarters });
      breakdown.push({ label: '季度费用', value: serviceAmount });
      breakdown.push({ label: '零散天数', value: partialDays });
      breakdown.push({ label: '季度折算日费用', value: roundAmount(dailyRate, roundingMode, precision) });
      breakdown.push({ label: '零散天数费用', value: roundAmount(partialAmount, roundingMode, precision) });
      return { amount, description: `季度费（${modeLabel}，${fullQuarters}完整季度+${partialDays}天）`, breakdown };
    } else {
      breakdown.push({ label: '账期口径', value: mode === 'natural_month' ? 1 : 2 });
      breakdown.push({ label: '完整季度数', value: fullQuarters });
      breakdown.push({ label: '季度费用', value: serviceAmount });
      return { amount, description: `季度费（${modeLabel}，${fullQuarters}完整季度）`, breakdown };
    }
  } else {
    const totalDays = daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
    const fullQuarters = Math.floor(totalDays / daysPerQuarter);
    const remainingDays = totalDays % daysPerQuarter;
    const dailyRate = serviceAmount / daysPerQuarter;
    const fullAmount = fullQuarters * serviceAmount;
    const partialAmount = remainingDays * dailyRate;
    const amount = fullAmount + partialAmount;

    if (remainingDays > 0) {
      breakdown.push({ label: '账期口径', value: 3 });
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '完整季度数', value: fullQuarters });
      breakdown.push({ label: '季度费用', value: serviceAmount });
      breakdown.push({ label: '零散天数', value: remainingDays });
      breakdown.push({ label: '季度折算日费用', value: roundAmount(dailyRate, roundingMode, precision) });
      breakdown.push({ label: '零散天数费用', value: roundAmount(partialAmount, roundingMode, precision) });
      return { amount, description: `季度费（自定义天数口径，${fullQuarters}完整季度+${remainingDays}天）`, breakdown };
    } else {
      breakdown.push({ label: '账期口径', value: 3 });
      breakdown.push({ label: '账期天数', value: totalDays });
      breakdown.push({ label: '完整季度数', value: fullQuarters });
      breakdown.push({ label: '季度费用', value: serviceAmount });
      return { amount, description: `季度费（自定义天数口径，${fullQuarters}完整季度）`, breakdown };
    }
  }
}
