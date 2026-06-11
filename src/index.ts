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
    lines.push(`退款金额: ${rs.refundAmount}元`);
    if (rs.suggestedDate) {
      lines.push(`建议退款日期: ${rs.suggestedDate}`);
    }
    if (rs.refundItems && rs.refundItems.length > 0) {
      lines.push('退款明细:');
      rs.refundItems.forEach((item) => {
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

  private applyDefaults(input: CalculationInput): CalculationInput {
    return {
      ...input,
      roundingMode: input.roundingMode || this.defaultRoundingMode,
      precision: input.precision ?? this.defaultPrecision,
    };
  }
}

export default RentalFeeSDK;
