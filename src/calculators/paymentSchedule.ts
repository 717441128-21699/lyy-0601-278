import {
  FeeRules,
  BillingPeriodMode,
  RoundingMode,
  DateRange,
  ServiceFeeRule,
  DiscountRule,
} from '../types';
import { roundAmount } from '../utils/rounding';
import {
  parseDate,
  formatDate,
  addDays,
  addMonths,
  getDaysInMonth,
  daysBetween,
  isNaturalMonth,
  splitIntoNaturalMonths,
  splitIntoNaturalQuarters,
} from '../utils/date';
import { calculateRent } from './rent';

export type PaymentPeriodKind = 'regular' | 'move_in' | 'move_out' | 'deposit';

export type DueDateRule = {
  offsetDays?: number;
  fixedDayOfMonth?: number;
  shiftHoliday?: boolean;
};

export interface PaymentScheduleItem {
  periodIndex: number;
  kind: PaymentPeriodKind;
  period: DateRange;
  dueDate: string;
  rent: number;
  serviceFees: {
    type: string;
    amount: number;
  }[];
  waterEstimate: number;
  electricityEstimate: number;
  utilityEstimate: number;
  deposit: number;
  discounts: {
    type: string;
    amount: number;
  }[];
  discountTotal: number;
  totalExpected: number;
  note: string;
}

export interface PaymentScheduleInput {
  leaseStartDate: string;
  leaseEndDate: string;
  moveInDate: string;
  moveOutDate?: string;
  rules: FeeRules;
  billingPeriodMode: BillingPeriodMode;
  customDays?: number;
  dueDateRule?: DueDateRule;
  waterEstimatePerMonth?: number;
  electricityEstimatePerMonth?: number;
  utilityEstimatePerMonth?: number;
  discounts?: DiscountRule[];
  roundingMode?: RoundingMode;
  precision?: number;
}

export interface PaymentScheduleResult {
  items: PaymentScheduleItem[];
  totalRent: number;
  totalServiceFees: number;
  totalWaterEstimate: number;
  totalElectricityEstimate: number;
  totalUtilityEstimate: number;
  totalDeposit: number;
  totalDiscounts: number;
  totalAll: number;
}

export function generatePaymentSchedule(input: PaymentScheduleInput): PaymentScheduleResult {
  const {
    leaseStartDate,
    leaseEndDate,
    moveInDate,
    moveOutDate,
    rules,
    billingPeriodMode,
    customDays = 30,
    dueDateRule,
    waterEstimatePerMonth = 0,
    electricityEstimatePerMonth = 0,
    utilityEstimatePerMonth = 0,
    discounts,
    roundingMode = 'round',
    precision = 2,
  } = input;

  const effectiveStart = moveInDate;
  const effectiveEnd = moveOutDate || leaseEndDate;
  const periods = generatePeriods(effectiveStart, effectiveEnd, billingPeriodMode, customDays);

  const items: PaymentScheduleItem[] = [];
  let totalRent = 0;
  let totalServiceFees = 0;
  let totalWaterEstimate = 0;
  let totalElectricityEstimate = 0;
  let totalUtilityEstimate = 0;
  let totalDeposit = 0;
  let totalDiscounts = 0;

  if (rules.deposit) {
    const dep = rules.deposit.amount;
    const depositDue = computeDueDate(effectiveStart, dueDateRule, effectiveStart, 'deposit');
    items.push({
      periodIndex: 0,
      kind: 'deposit',
      period: { startDate: effectiveStart, endDate: effectiveStart },
      dueDate: depositDue,
      rent: 0,
      serviceFees: [],
      waterEstimate: 0,
      electricityEstimate: 0,
      utilityEstimate: 0,
      deposit: dep,
      discounts: [],
      discountTotal: 0,
      totalExpected: dep,
      note: '押金',
    });
    totalDeposit += dep;
  }

  for (let i = 0; i < periods.length; i++) {
    const period = periods[i];
    const isMoveInPeriod = i === 0;
    const isMoveOutPeriod = i === periods.length - 1 && !!moveOutDate;

    const rentDetail = calculateRent({
      rentRule: rules.rent,
      billingPeriod: period,
      moveInDate: effectiveStart,
      moveOutDate: effectiveEnd,
      leaseStartDate,
      leaseEndDate,
      billingPeriodMode,
      roundingMode,
      precision,
    });

    const rent = rentDetail.amount;
    totalRent += rent;

    const serviceFeeItems: { type: string; amount: number }[] = [];
    let serviceFeeTotal = 0;
    if (rules.services) {
      for (const svc of rules.services) {
        const svcAmount = calcServiceFeeForPeriod(svc, period, billingPeriodMode, roundingMode, precision);
        serviceFeeItems.push({ type: svc.type, amount: svcAmount });
        serviceFeeTotal += svcAmount;
      }
    }
    totalServiceFees += serviceFeeTotal;

    const periodDays = daysBetween(period.startDate, period.endDate) + 1;
    const avgDaysPerMonth = 30;
    const scale = periodDays / avgDaysPerMonth;
    const waterEst = roundAmount(waterEstimatePerMonth * scale, roundingMode, precision);
    const elecEst = roundAmount(electricityEstimatePerMonth * scale, roundingMode, precision);
    const utilEst = utilityEstimatePerMonth > 0
      ? roundAmount(utilityEstimatePerMonth * scale, roundingMode, precision)
      : roundAmount(waterEst + elecEst, roundingMode, precision);
    totalWaterEstimate += waterEst;
    totalElectricityEstimate += elecEst;
    totalUtilityEstimate += utilEst;

    const discountItems: { type: string; amount: number }[] = [];
    let discountTotal = 0;
    if (discounts && discounts.length > 0 && isMoveInPeriod) {
      for (const d of discounts) {
        let base = 0;
        if (d.applyTo.includes('rent')) base += rent;
        if (d.applyTo.includes('service')) base += serviceFeeTotal;
        if (base <= 0) continue;
        let discAmt = 0;
        if (d.type === 'fixed') discAmt = d.amount;
        else if (d.type === 'percentage') discAmt = base * (d.amount / 100);
        else if (d.type === 'rent_free_days') discAmt = (rent / periodDays) * d.amount;
        discAmt = roundAmount(discAmt, roundingMode, precision);
        if (discAmt > 0) {
          discountItems.push({ type: d.description || d.type, amount: -discAmt });
          discountTotal += discAmt;
        }
      }
    }
    totalDiscounts += discountTotal;

    const totalExpected = roundAmount(rent + serviceFeeTotal + utilEst - discountTotal, roundingMode, precision);
    const dueDate = computeDueDate(period.startDate, dueDateRule, effectiveStart, isMoveInPeriod ? 'move_in' : 'regular');

    const notes: string[] = [];
    if (isMoveInPeriod) notes.push('首期');
    if (isMoveOutPeriod) notes.push('末期');
    const kind: PaymentPeriodKind = isMoveInPeriod && !isMoveOutPeriod ? 'move_in' : isMoveOutPeriod ? 'move_out' : 'regular';
    if (kind === 'move_in' && rentDetail.description.includes('折算')) notes.push('按实际天数折算');
    if (kind === 'move_out' && rentDetail.description.includes('折算')) notes.push('按实际天数折算');

    items.push({
      periodIndex: i + 1,
      kind,
      period,
      dueDate,
      rent,
      serviceFees: serviceFeeItems,
      waterEstimate: waterEst,
      electricityEstimate: elecEst,
      utilityEstimate: utilEst,
      deposit: 0,
      discounts: discountItems,
      discountTotal: roundAmount(-discountTotal, roundingMode, precision),
      totalExpected,
      note: notes.join('，') || '常规期',
    });
  }

  totalRent = roundAmount(totalRent, roundingMode, precision);
  totalServiceFees = roundAmount(totalServiceFees, roundingMode, precision);
  totalWaterEstimate = roundAmount(totalWaterEstimate, roundingMode, precision);
  totalElectricityEstimate = roundAmount(totalElectricityEstimate, roundingMode, precision);
  totalUtilityEstimate = roundAmount(totalUtilityEstimate, roundingMode, precision);
  totalDeposit = roundAmount(totalDeposit, roundingMode, precision);
  totalDiscounts = roundAmount(-totalDiscounts, roundingMode, precision);
  const totalAll = roundAmount(totalRent + totalServiceFees + totalUtilityEstimate + totalDeposit + totalDiscounts, roundingMode, precision);

  return {
    items,
    totalRent,
    totalServiceFees,
    totalWaterEstimate,
    totalElectricityEstimate,
    totalUtilityEstimate,
    totalDeposit,
    totalDiscounts,
    totalAll,
  };
}

function generatePeriods(
  startDate: string,
  endDate: string,
  mode: BillingPeriodMode,
  customDays: number
): DateRange[] {
  if (mode === 'natural_month') {
    return splitIntoNaturalMonths(startDate, endDate);
  }
  if (mode === 'natural_quarter') {
    return splitIntoNaturalQuarters(startDate, endDate);
  }
  const periods: DateRange[] = [];
  let current = startDate;
  while (current < endDate) {
    let periodEnd = addDays(current, customDays - 1);
    if (periodEnd > endDate) periodEnd = endDate;
    periods.push({ startDate: current, endDate: periodEnd });
    current = addDays(periodEnd, 1);
  }
  return periods;
}

function calcServiceFeeForPeriod(
  svc: ServiceFeeRule,
  period: DateRange,
  mode: BillingPeriodMode,
  roundingMode: RoundingMode,
  precision: number
): number {
  if (svc.cycle === 'one_time') return roundAmount(svc.amount, roundingMode, precision);
  if (svc.cycle === 'daily') {
    const days = daysBetween(period.startDate, period.endDate) + 1;
    return roundAmount(svc.amount * days, roundingMode, precision);
  }

  if (svc.cycle === 'monthly') {
    if (mode === 'natural_month' || mode === 'natural_quarter') {
      const months = splitIntoNaturalMonths(period.startDate, period.endDate);
      let fullMonths = 0;
      let partialDays = 0;
      for (const m of months) {
        if (isNaturalMonth(m.startDate, m.endDate)) fullMonths++;
        else partialDays += daysBetween(m.startDate, m.endDate) + 1;
      }
      const fullAmt = fullMonths * svc.amount;
      const partialAmt = partialDays * (svc.amount / 30);
      return roundAmount(fullAmt + partialAmt, roundingMode, precision);
    }
    const days = daysBetween(period.startDate, period.endDate) + 1;
    return roundAmount((svc.amount / 30) * days, roundingMode, precision);
  }

  if (svc.cycle === 'quarterly') {
    if (mode === 'natural_quarter' || mode === 'natural_month') {
      const start = parseDate(period.startDate);
      const end = parseDate(period.endDate);
      const monthSpan = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      const quarterStartMonths = [0, 3, 6, 9];
      if (monthSpan === 3 && start.getDate() === 1 && quarterStartMonths.includes(start.getMonth())) {
        const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
        if (end.getDate() === lastDay) {
          return roundAmount(svc.amount, roundingMode, precision);
        }
      }
      const months = splitIntoNaturalMonths(period.startDate, period.endDate);
      let fullQuarters = 0;
      let partialDays = 0;
      let i = 0;
      while (i < months.length) {
        const mf = isNaturalMonth(months[i].startDate, months[i].endDate);
        if (
          i + 2 < months.length &&
          mf &&
          isNaturalMonth(months[i + 1].startDate, months[i + 1].endDate) &&
          isNaturalMonth(months[i + 2].startDate, months[i + 2].endDate) &&
          quarterStartMonths.includes(parseDate(months[i].startDate).getMonth())
        ) {
          fullQuarters++;
          i += 3;
        } else {
          partialDays += daysBetween(months[i].startDate, months[i].endDate) + 1;
          i++;
        }
      }
      const fullAmt = fullQuarters * svc.amount;
      const partialAmt = partialDays * (svc.amount / 90);
      return roundAmount(fullAmt + partialAmt, roundingMode, precision);
    }
    const days = daysBetween(period.startDate, period.endDate) + 1;
    return roundAmount((svc.amount / 90) * days, roundingMode, precision);
  }

  if (svc.cycle === 'weekly') {
    const days = daysBetween(period.startDate, period.endDate) + 1;
    return roundAmount((svc.amount / 7) * days, roundingMode, precision);
  }

  return 0;
}

function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 0 || d === 6;
}

export function computeDueDate(
  periodStart: string,
  rule: DueDateRule | undefined,
  moveInDate: string,
  kind: 'regular' | 'move_in' | 'deposit'
): string {
  const start = parseDate(periodStart);
  const mi = parseDate(moveInDate);

  const offsetDays = rule?.offsetDays ?? (kind === 'deposit' ? 0 : 5);
  const fixedDay = rule?.fixedDayOfMonth;
  const shiftHoliday = rule?.shiftHoliday ?? true;

  let due = new Date(start);

  if (fixedDay !== undefined && kind !== 'deposit') {
    let targetYear = start.getFullYear();
    let targetMonth = start.getMonth();
    if (offsetDays < 0) {
      targetMonth -= 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
    }
    const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const safeDay = Math.max(1, Math.min(fixedDay, lastDayOfMonth));
    due = new Date(targetYear, targetMonth, safeDay);
  } else {
    const delta = kind === 'deposit' ? offsetDays : -offsetDays;
    due = new Date(start.getTime() + delta * 24 * 60 * 60 * 1000);
  }

  if (due < mi && kind !== 'deposit') due = new Date(mi);

  if (shiftHoliday && isWeekend(due)) {
    let delta = due.getDay() === 0 ? 1 : 2;
    due = new Date(due.getTime() + delta * 24 * 60 * 60 * 1000);
  }

  return formatDate(due);
}

