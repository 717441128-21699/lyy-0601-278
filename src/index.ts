export * from './types';
export * from './utils';
export * from './calculators';

import {
  CalculationInput,
  Bill,
  BillComparison,
  ValidationResult,
  SplitMode,
  RoundingMode,
  FeeDetail,
  TenantSplit,
  RefundSuggestion,
} from './types';
import { validateCalculationInput } from './utils';
import { generateBill } from './calculators/billGenerator';
import { compareBills, BillComparisonInput } from './calculators/comparison';
import { calculateTenantSplits, SplitCalculationInput, SplitResult } from './calculators/split';
import { calculateRent, RentCalculationInput } from './calculators/rent';
import { calculateDeposit, DepositCalculationInput, DepositResult } from './calculators/deposit';
import { calculateUtility, UtilityCalculationInput } from './calculators/utility';
import { calculateServiceFees, ServiceFeeCalculationInput } from './calculators/service';
import { calculatePenalty, PenaltyCalculationInput, calculateLateFee, LateFeeCalculationInput } from './calculators/penalty';
import { calculateDiscounts, DiscountCalculationInput } from './calculators/discount';
import { generatePaymentSchedule, applyPayments, PaymentScheduleInput, PaymentScheduleResult, PaymentPeriodKind, DueDateRule, DiscountScope, PaymentRecord, ReconciliationResult, ReconciliationStatus, computeDueDate } from './calculators/paymentSchedule';

export class RentalFeeSDK {
  private defaultRoundingMode: RoundingMode;
  private defaultPrecision: number;
  private defaultSplitMode: SplitMode;

  constructor(options?: {
    roundingMode?: RoundingMode;
    precision?: number;
    splitMode?: SplitMode;
  }) {
    this.defaultRoundingMode = options?.roundingMode || 'round';
    this.defaultPrecision = options?.precision ?? 2;
    this.defaultSplitMode = options?.splitMode || 'average';
  }

  generateBill(input: CalculationInput, splitMode?: SplitMode): Bill {
    const processedInput = this.applyDefaults(input);
    return generateBill(processedInput, splitMode || this.defaultSplitMode);
  }

  validate(input: CalculationInput): ValidationResult {
    return validateCalculationInput(input);
  }

  compareBills(input: BillComparisonInput): BillComparison {
    return compareBills({
      ...input,
      roundingMode: input.roundingMode || this.defaultRoundingMode,
      precision: input.precision ?? this.defaultPrecision,
    });
  }

  splitFees(input: Omit<SplitCalculationInput, 'roundingMode' | 'precision'>): SplitResult {
    return calculateTenantSplits({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateRent(input: Omit<RentCalculationInput, 'roundingMode' | 'precision'>): FeeDetail {
    return calculateRent({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateDeposit(input: Omit<DepositCalculationInput, 'roundingMode' | 'precision'>): DepositResult {
    return calculateDeposit({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateUtility(input: Omit<UtilityCalculationInput, 'roundingMode' | 'precision'>): FeeDetail | null {
    return calculateUtility({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateServiceFees(input: Omit<ServiceFeeCalculationInput, 'roundingMode' | 'precision'>): FeeDetail[] {
    return calculateServiceFees({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculatePenalty(input: Omit<PenaltyCalculationInput, 'roundingMode' | 'precision'>): FeeDetail | null {
    return calculatePenalty({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateLateFee(input: Omit<LateFeeCalculationInput, 'roundingMode' | 'precision'>): FeeDetail | null {
    return calculateLateFee({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  calculateDiscounts(input: Omit<DiscountCalculationInput, 'roundingMode' | 'precision'>): FeeDetail[] {
    return calculateDiscounts({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  getBillSummary(bill: Bill): string {
    const lines: string[] = [];
    lines.push(`账单编号: ${bill.summary.billId}`);
    lines.push(`账期: ${bill.summary.period.startDate} 至 ${bill.summary.period.endDate}`);
    lines.push(`总金额: ${bill.summary.totalAmount} 元`);
    lines.push(`费用项数: ${bill.summary.numberOfItems}`);
    if (bill.summary.billingPeriodMode) {
      const modeLabels: Record<string, string> = { natural_month: '自然月', natural_quarter: '自然季度', custom_days: '自定义天数' };
      lines.push(`账期口径: ${modeLabels[bill.summary.billingPeriodMode] || bill.summary.billingPeriodMode}`);
    }
    if (bill.summary.dueDate) {
      lines.push(`付款截止日: ${bill.summary.dueDate}`);
    }
    if (bill.summary.primaryTenant) {
      lines.push(`主租客: ${bill.summary.primaryTenant}`);
    }
    return lines.join('\n');
  }

  getFeeBreakdown(bill: Bill): string {
    const lines: string[] = ['费用明细:'];
    bill.feeDetails.forEach((fee, idx) => {
      lines.push(`  ${idx + 1}. ${fee.name}: ${fee.amount}元`);
      lines.push(`     ${fee.description}`);
      if (fee.breakdown && fee.breakdown.length > 0) {
        fee.breakdown.forEach((item) => {
          lines.push(`       - ${item.label}: ${item.value}`);
        });
      }
    });
    return lines.join('\n');
  }

  getSplitExplanation(bill: Bill): string {
    if (!bill.tenantSplits || bill.tenantSplits.length === 0) {
      return bill.splitExplanation.join('\n');
    }
    const lines: string[] = ['分摊说明:'];
    lines.push(...bill.splitExplanation.map((e) => `  ${e}`));
    lines.push('');
    bill.tenantSplits.forEach((split) => {
      lines.push(`  ${split.tenantName} (ID: ${split.tenantId}):`);
      lines.push(`    合计: ${split.totalAmount}元`);
      split.feeDetails.forEach((fee) => {
        lines.push(`      - ${fee.name}: ${fee.amount}元`);
      });
    });
    return lines.join('\n');
  }

  getRefundSuggestion(bill: Bill): string {
    if (!bill.refundSuggestion) {
      return '无退款建议';
    }
    const rs = bill.refundSuggestion;
    const lines: string[] = [];
    lines.push(`是否需要退款: ${rs.shouldRefund ? '是' : '否'}`);
    lines.push(`原押金: ${rs.originalDeposit}元`);
    lines.push(`应退金额: ${rs.refundAmount}元`);
    if (rs.suggestedDate) {
      lines.push(`建议退款日期: ${rs.suggestedDate}`);
    }
    if (rs.deductions && rs.deductions.length > 0) {
      lines.push('扣除明细:');
      rs.deductions.forEach((item) => {
        lines.push(`  - ${item.reason}: ${item.amount}元`);
      });
    }
    return lines.join('\n');
  }

  getExceptions(bill: Bill): string {
    if (bill.exceptions.length === 0) {
      return '无异常提示';
    }
    return '异常提示:\n' + bill.exceptions.map((e) => `  - ${e}`).join('\n');
  }

  generatePaymentSchedule(input: Omit<PaymentScheduleInput, 'roundingMode' | 'precision'>): PaymentScheduleResult {
    return generatePaymentSchedule({
      ...input,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  getPaymentScheduleText(schedule: PaymentScheduleResult): string {
    const lines: string[] = [];
    const kindLabels: Record<string, string> = {
      regular: '常规期',
      move_in: '首期',
      move_out: '末期',
      deposit: '押金期',
    };
    const statusLabels: Record<string, string> = {
      pending: '待收',
      partial: '部分收款',
      paid: '已收',
      overdue: '逾期',
    };
    for (const item of schedule.items) {
      const k = kindLabels[item.kind] || item.kind;
      const st = statusLabels[item.status] || item.status;
      if (item.kind === 'deposit') {
        lines.push(`【${k}】第${item.periodIndex > 0 ? item.periodIndex : ''}期: ${item.dueDate}前支付 [${st}]`);
        lines.push(`  押金: ${item.deposit}元`);
        lines.push(`  进度: 已收${item.receivedAmount}/${item.totalExpected}元 (${item.progress}%)  剩余: ${item.remainingAmount}元`);
        if (item.overdueDays > 0) lines.push(`  逾期: ${item.overdueDays}天`);
        lines.push(`  备注: ${item.note}`);
      } else {
        lines.push(`第${item.periodIndex}期【${k}】: ${item.period.startDate} ~ ${item.period.endDate} [${st}]`);
        lines.push(`  应付日期: ${item.dueDate}`);
        lines.push(`  租金: ${item.rent}元`);
        item.serviceFees.forEach(sf => {
          lines.push(`  ${sf.type}: ${sf.amount}元`);
        });
        if (item.waterEstimate > 0) lines.push(`  水费预估: ${item.waterEstimate}元`);
        if (item.electricityEstimate > 0) lines.push(`  电费预估: ${item.electricityEstimate}元`);
        if (item.utilityEstimate > 0 && item.waterEstimate === 0 && item.electricityEstimate === 0) {
          lines.push(`  水电预估: ${item.utilityEstimate}元`);
        }
        item.discounts.forEach(d => {
          lines.push(`  优惠(${d.type}): ${d.amount}元`);
        });
        lines.push(`  本期合计: ${item.totalExpected}元`);
        lines.push(`  进度: 已收${item.receivedAmount}/${item.totalExpected}元 (${item.progress}%)  剩余: ${item.remainingAmount}元`);
        if (item.overdueDays > 0) lines.push(`  逾期: ${item.overdueDays}天`);
        lines.push(`  备注: ${item.note}`);
      }
      lines.push('');
    }
    lines.push('汇总:');
    if (schedule.totalRent) lines.push(`  租金: ${schedule.totalRent}元`);
    if (schedule.totalServiceFees) lines.push(`  服务费: ${schedule.totalServiceFees}元`);
    if (schedule.totalWaterEstimate) lines.push(`  水费预估: ${schedule.totalWaterEstimate}元`);
    if (schedule.totalElectricityEstimate) lines.push(`  电费预估: ${schedule.totalElectricityEstimate}元`);
    if (schedule.totalDeposit) lines.push(`  押金: ${schedule.totalDeposit}元`);
    if (schedule.totalDiscounts) lines.push(`  优惠合计: ${schedule.totalDiscounts}元`);
    lines.push(`  全部合计: ${schedule.totalAll}元`);
    return lines.join('\n');
  }

  applyPayments(
    schedule: PaymentScheduleResult,
    payments: PaymentRecord[],
    options?: { asOfDate?: string }
  ): ReconciliationResult {
    return applyPayments(schedule, payments, {
      ...options,
      roundingMode: this.defaultRoundingMode,
      precision: this.defaultPrecision,
    });
  }

  getReconciliationText(rec: ReconciliationResult): string {
    const lines: string[] = [];
    const statusLabels: Record<string, string> = {
      pending: '待收',
      partial: '部分收款',
      paid: '已收',
      overdue: '逾期',
    };
    const kindLabels: Record<string, string> = {
      regular: '常规期',
      move_in: '首期',
      move_out: '末期',
      deposit: '押金期',
    };

    lines.push('═══ 收款日历（含对账状态）═══');
    for (const item of rec.scheduleItems) {
      const k = kindLabels[item.kind] || item.kind;
      const st = statusLabels[item.status] || item.status;
      lines.push(`第${item.periodIndex}期【${k}】 ${item.period.startDate}~${item.period.endDate}  应收日:${item.dueDate}  [${st}]`);
      lines.push(`  应收${item.totalExpected}元 / 已收${item.receivedAmount}元 / 剩余${item.remainingAmount}元 (进度${item.progress}%)`);
      if (item.overdueDays > 0) lines.push(`  ⚠ 逾期${item.overdueDays}天`);
    }

    lines.push('');
    lines.push('═══ 对账明细（每笔收款对应到期与费用项）═══');
    for (const s of rec.summaryItems) {
      lines.push(`收款 ${s.paymentId}  日期:${s.paymentDate}  金额:${s.paymentAmount}元`);
      for (const a of s.allocations) {
        lines.push(`  → ${a.periodLabel} · ${a.feeType}: ${a.allocatedAmount}元`);
      }
    }

    lines.push('');
    lines.push('═══ 对账汇总 ═══');
    lines.push(`应收总额: ${rec.totalExpected}元`);
    lines.push(`已收总额: ${rec.totalReceived}元`);
    lines.push(`剩余应收: ${rec.totalRemaining}元`);
    if (rec.totalOverdue > 0) lines.push(`逾期金额: ${rec.totalOverdue}元 ⚠`);
    return lines.join('\n');
  }

  computeDueDate(periodStart: string, dueDateRule: DueDateRule, moveInDate: string, kind: 'regular' | 'move_in' | 'deposit' = 'regular'): string {
    return computeDueDate(periodStart, dueDateRule, moveInDate, kind);
  }

  compareBillsDetailed(input: BillComparisonInput): BillComparison {
    return compareBills({
      ...input,
      roundingMode: input.roundingMode || this.defaultRoundingMode,
      precision: input.precision ?? this.defaultPrecision,
    });
  }

  getComparisonText(comparison: BillComparison): string {
    const lines: string[] = [];
    lines.push(`本期: ${comparison.currentBillId}`);
    lines.push(`上期: ${comparison.previousBillId}`);
    lines.push(`差额: ${comparison.difference > 0 ? '+' : ''}${comparison.difference}元（${comparison.percentageChange}%）`);
    lines.push('');
    lines.push('费用项对比:');
    for (const item of comparison.itemDifferences) {
      const flag = item.isAnomaly ? '⚠' : ' ';
      lines.push(`  ${flag} ${item.name}: 上期${item.previousAmount}元 → 本期${item.currentAmount}元（${item.difference > 0 ? '+' : ''}${item.difference}元）`);
      lines.push(`    原因: ${item.reason}`);
    }
    if (comparison.anomalies.length > 0) {
      lines.push('');
      lines.push('异常提示:');
      comparison.anomalies.forEach(a => lines.push(`  ⚠ ${a}`));
    }
    lines.push('');
    lines.push(`总结: ${comparison.summary}`);
    return lines.join('\n');
  }

  private applyDefaults(input: CalculationInput): CalculationInput {
    return {
      ...input,
      roundingMode: input.roundingMode || this.defaultRoundingMode,
      precision: input.precision ?? this.defaultPrecision,
    };
  }
}

export default RentalFeeSDK;
