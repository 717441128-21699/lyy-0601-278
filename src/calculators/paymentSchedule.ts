import {
  FeeRules,
  BillingPeriodMode,
  RoundingMode,
  DateRange,
  ServiceFeeRule,
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

export interface PaymentScheduleItem {
  periodIndex: number;
  period: DateRange;
  dueDate: string;
  rent: number;
  serviceFees: {
    type: string;
    amount: number;
  }[];
  utilityEstimate: number;
  totalExpected: number;
  isDepositPeriod: boolean;
  isMoveInPeriod: boolean;
  isMoveOutPeriod: boolean;
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
  paymentDueOffsetDays?: number;
  utilityEstimatePerMonth?: number;
  roundingMode?: RoundingMode;
  precision?: number;
}

export interface PaymentScheduleResult {
  items: PaymentScheduleItem[];
  depositItem?: {
    amount: number;
    dueDate: string;
    note: string;
  };
  totalRent: number;
  totalServiceFees: number;
  totalUtilityEstimate: number;
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
    paymentDueOffsetDays = 5,
    utilityEstimatePerMonth = 0,
    roundingMode = 'round',
    precision = 2,
  } = input;

  const effectiveStart = moveInDate;
  const effectiveEnd = moveOutDate || leaseEndDate;

  const periods = generatePeriods(effectiveStart, effectiveEnd, billingPeriodMode, customDays);

  const items: PaymentScheduleItem[] = [];
  let totalRent = 0;
  let totalServiceFees = 0;
  let totalUtilityEstimate = 0;

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
    const utilityEstimate = roundAmount((utilityEstimatePerMonth / avgDaysPerMonth) * periodDays, roundingMode, precision);
    totalUtilityEstimate += utilityEstimate;

    const totalExpected = roundAmount(rent + serviceFeeTotal + utilityEstimate, roundingMode, precision);

    const dueDate = addDays(period.startDate, -paymentDueOffsetDays);
    const effectiveDueDate = dueDate < effectiveStart ? addDays(effectiveStart, paymentDueOffsetDays) : dueDate;

    const notes: string[] = [];
    if (isMoveInPeriod) notes.push('入住首期');
    if (isMoveOutPeriod) notes.push('退租末期');
    if (isMoveInPeriod && rentDetail.description.includes('零散')) notes.push('首期按实际天数折算');
    if (isMoveOutPeriod && rentDetail.description.includes('零散')) notes.push('末期按实际天数折算');

    items.push({
      periodIndex: i + 1,
      period,
      dueDate: effectiveDueDate,
      rent,
      serviceFees: serviceFeeItems,
      utilityEstimate,
      totalExpected,
      isDepositPeriod: false,
      isMoveInPeriod,
      isMoveOutPeriod,
      note: notes.join('，') || '常规账期',
    });
  }

  let depositItem: PaymentScheduleResult['depositItem'];
  if (rules.deposit) {
    const depositDueDate = addDays(effectiveStart, -1);
    depositItem = {
      amount: rules.deposit.amount,
      dueDate: depositDueDate < effectiveStart ? addDays(effectiveStart, 0) : depositDueDate,
      note: `押金${rules.deposit.amount}元，入住前收取`,
    };
  }

  totalRent = roundAmount(totalRent, roundingMode, precision);
  totalServiceFees = roundAmount(totalServiceFees, roundingMode, precision);
  totalUtilityEstimate = roundAmount(totalUtilityEstimate, roundingMode, precision);
  const totalAll = roundAmount(totalRent + totalServiceFees + totalUtilityEstimate, roundingMode, precision);

  return {
    items,
    depositItem,
    totalRent,
    totalServiceFees,
    totalUtilityEstimate,
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
      if (isNaturalMonth(period.startDate, period.endDate)) {
        return roundAmount(svc.amount, roundingMode, precision);
      }
    }
    const days = daysBetween(period.startDate, period.endDate) + 1;
    return roundAmount((svc.amount / 30) * days, roundingMode, precision);
  }

  if (svc.cycle === 'quarterly') {
    if (mode === 'natural_quarter') {
      const start = parseDate(period.startDate);
      const end = parseDate(period.endDate);
      const monthSpan = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1;
      if (monthSpan === 3 && start.getDate() === 1) {
        const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
        if (end.getDate() === lastDay) {
          return roundAmount(svc.amount, roundingMode, precision);
        }
      }
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
