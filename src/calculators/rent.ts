import { RentRule, DateRange, FeeDetail, RoundingMode } from '../types';
import {
  daysBetween,
  parseDate,
  getDaysInMonth,
} from '../utils';
import { roundAmount } from '../utils/rounding';

export interface RentCalculationInput {
  rentRule: RentRule;
  billingPeriod: DateRange;
  moveInDate: string;
  moveOutDate?: string;
  leaseStartDate: string;
  leaseEndDate: string;
  roundingMode?: RoundingMode;
  precision?: number;
}

export function calculateRent(input: RentCalculationInput): FeeDetail {
  const {
    rentRule,
    billingPeriod,
    moveInDate,
    moveOutDate,
    leaseStartDate,
    leaseEndDate,
    roundingMode = 'round',
    precision = 2,
  } = input;

  const breakdown: { label: string; value: number }[] = [];

  let effectiveStart = moveInDate > billingPeriod.startDate ? moveInDate : billingPeriod.startDate;
  let effectiveEnd = billingPeriod.endDate;

  if (moveOutDate && moveOutDate < effectiveEnd) {
    effectiveEnd = moveOutDate;
  }
  if (leaseEndDate < effectiveEnd) {
    effectiveEnd = leaseEndDate;
  }
  if (leaseStartDate > effectiveStart) {
    effectiveStart = leaseStartDate;
  }

  if (effectiveStart > effectiveEnd) {
    return {
      type: 'rent',
      name: '租金',
      amount: 0,
      description: '账期内无有效租期',
      breakdown: [],
    };
  }

  const effectivePeriod = { startDate: effectiveStart, endDate: effectiveEnd };

  if (rentRule.billingCycle === 'daily') {
    const days = daysBetween(effectiveStart, effectiveEnd) + 1;
    const dailyRate = rentRule.dailyAmount || rentRule.monthlyAmount / 30;
    const amount = roundAmount(days * dailyRate, roundingMode, precision);
    breakdown.push({ label: '计费天数', value: days });
    breakdown.push({ label: '日租金', value: roundAmount(dailyRate, roundingMode, precision) });
    return {
      type: 'rent',
      name: '租金',
      amount,
      description: `按日计算租金，共${days}天`,
      breakdown,
    };
  }

  if (rentRule.billingCycle === 'weekly') {
    const days = daysBetween(effectiveStart, effectiveEnd) + 1;
    const weeks = Math.ceil(days / 7);
    const weeklyRate = rentRule.weeklyAmount || rentRule.monthlyAmount / 4.33;
    const amount = roundAmount(weeks * weeklyRate, roundingMode, precision);
    breakdown.push({ label: '计费周数', value: weeks });
    breakdown.push({ label: '周租金', value: roundAmount(weeklyRate, roundingMode, precision) });
    return {
      type: 'rent',
      name: '租金',
      amount,
      description: `按周计算租金，共${weeks}周`,
      breakdown,
    };
  }

  const start = parseDate(effectiveStart);
  const end = parseDate(effectiveEnd);
  const startYear = start.getFullYear();
  const startMonth = start.getMonth();
  const startDay = start.getDate();
  const endYear = end.getFullYear();
  const endMonth = end.getMonth();
  const endDay = end.getDate();

  let fullMonths = 0;
  let firstPartialDays = 0;
  let lastPartialDays = 0;
  let dailyRateMonthForFirst = startMonth;
  let dailyRateYearForFirst = startYear;
  let dailyRateMonthForLast = endMonth;
  let dailyRateYearForLast = endYear;

  if (startYear === endYear && startMonth === endMonth) {
    const totalDaysInMonth = getDaysInMonth(startYear, startMonth);
    firstPartialDays = endDay - startDay + 1;
    if (startDay === 1 && endDay === totalDaysInMonth) {
      fullMonths = 1;
      firstPartialDays = 0;
    }
  } else {
    const daysInFirstMonth = getDaysInMonth(startYear, startMonth);
    firstPartialDays = daysInFirstMonth - startDay + 1;

    if (startDay === 1) {
      fullMonths += 1;
      firstPartialDays = 0;
    }

    lastPartialDays = endDay;
    const daysInLastMonth = getDaysInMonth(endYear, endMonth);
    if (endDay === daysInLastMonth) {
      fullMonths += 1;
      lastPartialDays = 0;
    }

    if (endYear > startYear || (endYear === startYear && endMonth > startMonth + 1)) {
      const middleStartYear = startMonth === 11 ? startYear + 1 : startYear;
      const middleStartMonth = startMonth === 11 ? 0 : startMonth + 1;
      const middleEndMonth = endMonth === 0 ? 11 : endMonth - 1;
      const middleEndYear = endMonth === 0 ? endYear - 1 : endYear;

      let y = middleStartYear;
      let m = middleStartMonth;
      while (y < middleEndYear || (y === middleEndYear && m <= middleEndMonth)) {
        fullMonths += 1;
        m += 1;
        if (m > 11) {
          m = 0;
          y += 1;
        }
      }
    }
  }

  const fullMonthAmount = fullMonths * rentRule.monthlyAmount;
  let partialAmount = 0;

  if (firstPartialDays > 0 || lastPartialDays > 0) {
    let firstPartialDailyRate: number;
    let lastPartialDailyRate: number;

    if (rentRule.prorationMethod === 'by_day') {
      const daysInFirstMonth = getDaysInMonth(dailyRateYearForFirst, dailyRateMonthForFirst);
      firstPartialDailyRate = rentRule.monthlyAmount / daysInFirstMonth;
      const daysInLastMonth = getDaysInMonth(dailyRateYearForLast, dailyRateMonthForLast);
      lastPartialDailyRate = rentRule.monthlyAmount / daysInLastMonth;
    } else {
      firstPartialDailyRate = rentRule.monthlyAmount / 30;
      lastPartialDailyRate = rentRule.monthlyAmount / 30;
    }

    const firstPartialAmount = firstPartialDays * firstPartialDailyRate;
    const lastPartialAmount = lastPartialDays * lastPartialDailyRate;
    partialAmount = firstPartialAmount + lastPartialAmount;

    if (firstPartialDays > 0) {
      breakdown.push({ label: '首月零散天数', value: firstPartialDays });
      breakdown.push({
        label: `首月日租金(${rentRule.prorationMethod === 'by_day' ? '按实际天数' : '按30天'})`,
        value: roundAmount(firstPartialDailyRate, roundingMode, precision),
      });
    }
    if (lastPartialDays > 0) {
      breakdown.push({ label: '末月零散天数', value: lastPartialDays });
      breakdown.push({
        label: `末月日租金(${rentRule.prorationMethod === 'by_day' ? '按实际天数' : '按30天'})`,
        value: roundAmount(lastPartialDailyRate, roundingMode, precision),
      });
    }
    breakdown.push({
      label: '零散天数租金合计',
      value: roundAmount(partialAmount, roundingMode, precision),
    });
  }

  if (fullMonths > 0) {
    breakdown.push({ label: '整月数量', value: fullMonths });
    breakdown.push({ label: '月租金', value: rentRule.monthlyAmount });
    breakdown.push({
      label: '整月租金合计',
      value: roundAmount(fullMonthAmount, roundingMode, precision),
    });
  }

  const totalAmount = roundAmount(fullMonthAmount + partialAmount, roundingMode, precision);
  const totalPartialDays = firstPartialDays + lastPartialDays;

  let description = '';
  if (fullMonths > 0 && totalPartialDays > 0) {
    description = `含${fullMonths}个整月和${totalPartialDays}天零散租期`;
  } else if (fullMonths > 0) {
    description = `整月租金，共${fullMonths}个月`;
  } else {
    description = `零散租期，共${totalPartialDays}天`;
  }

  return {
    type: 'rent',
    name: '租金',
    amount: totalAmount,
    description,
    breakdown,
  };
}
