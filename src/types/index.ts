export type RoundingMode = 'round' | 'floor' | 'ceil';

export type SplitMode = 'average' | 'area' | 'ratio' | 'custom';

export type FeeType =
  | 'rent'
  | 'deposit'
  | 'water'
  | 'electricity'
  | 'gas'
  | 'service'
  | 'penalty'
  | 'late_fee'
  | 'discount';

export type BillingCycle = 'monthly' | 'weekly' | 'daily' | 'quarterly';

export type BillingPeriodMode = 'natural_month' | 'natural_quarter' | 'custom_days';

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface Tenant {
  id: string;
  name: string;
  moveInDate?: string;
  moveOutDate?: string;
  shareRatio?: number;
  areaRatio?: number;
  customAmount?: Record<FeeType, number>;
}

export interface MeterReading {
  previous: number;
  current: number;
}

export interface MeterReadings {
  water?: MeterReading;
  electricity?: MeterReading;
  gas?: MeterReading;
}

export interface UtilityTier {
  minUsage: number;
  maxUsage?: number;
  pricePerUnit: number;
}

export interface UtilityRule {
  tiers: UtilityTier[];
  baseFee?: number;
}

export interface RentRule {
  monthlyAmount: number;
  weeklyAmount?: number;
  dailyAmount?: number;
  billingCycle: BillingCycle;
  prorationMethod: 'by_day' | 'by_30days';
}

export interface DepositRule {
  amount: number;
  freezeDays?: number;
  refundDays?: number;
  deductions?: {
    reason: string;
    amount: number;
  }[];
}

export interface ServiceFeeRule {
  type: string;
  amount: number;
  cycle: BillingCycle | 'one_time';
}

export interface PenaltyRule {
  enabled: boolean;
  percentage: number;
  minAmount?: number;
  maxAmount?: number;
  conditions?: string;
}

export interface LateFeeRule {
  enabled: boolean;
  dailyRate: number;
  graceDays: number;
  maxAmount?: number;
  minAmount?: number;
}

export interface DiscountRule {
  type: 'fixed' | 'percentage' | 'rent_free_days';
  amount: number;
  applyTo: FeeType[];
  description?: string;
  minAmount?: number;
}

export interface FeeRules {
  rent: RentRule;
  deposit?: DepositRule;
  water?: UtilityRule;
  electricity?: UtilityRule;
  gas?: UtilityRule;
  services?: ServiceFeeRule[];
  penalty?: PenaltyRule;
  lateFee?: LateFeeRule;
  discounts?: DiscountRule[];
}

export interface CalculationInput {
  leaseStartDate: string;
  leaseEndDate: string;
  moveInDate: string;
  moveOutDate?: string;
  billingPeriod: DateRange;
  billingPeriodMode?: BillingPeriodMode;
  numberOfTenants: number;
  tenants?: Tenant[];
  meterReadings?: MeterReadings;
  rules: FeeRules;
  paymentDueDate?: string;
  actualPaymentDate?: string;
  roundingMode?: RoundingMode;
  precision?: number;
  previousBill?: Bill;
}

export interface FeeDetail {
  type: FeeType;
  name: string;
  amount: number;
  description: string;
  breakdown?: {
    label: string;
    value: number;
  }[];
}

export interface TenantSplit {
  tenantId: string;
  tenantName: string;
  totalAmount: number;
  feeDetails: FeeDetail[];
  splitDescription: string;
}

export interface BillSummary {
  billId: string;
  period: DateRange;
  totalAmount: number;
  dueDate?: string;
  numberOfItems: number;
  primaryTenant?: string;
  status: 'pending' | 'paid' | 'overdue' | 'refunded';
  billingPeriodMode?: BillingPeriodMode;
}

export interface Bill {
  summary: BillSummary;
  feeDetails: FeeDetail[];
  tenantSplits?: TenantSplit[];
  splitExplanation: string[];
  refundSuggestion?: RefundSuggestion;
  exceptions: string[];
  generatedAt: string;
}

export interface RefundSuggestion {
  shouldRefund: boolean;
  originalDeposit: number;
  refundAmount: number;
  deductions: {
    reason: string;
    amount: number;
  }[];
  suggestedDate?: string;
}

export interface BillComparison {
  currentBillId: string;
  previousBillId: string;
  difference: number;
  percentageChange: number;
  itemDifferences: {
    type: FeeType;
    name: string;
    currentAmount: number;
    previousAmount: number;
    difference: number;
    reason: string;
    isAnomaly: boolean;
  }[];
  anomalies: string[];
  summary: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
