import {
  CalculationInput,
  Bill,
  BillSummary,
  FeeDetail,
  TenantSplit,
  RefundSuggestion,
  SplitMode,
} from '../types';
import { validateCalculationInput, sumAmounts, formatDate } from '../utils';
import { calculateRent } from './rent';
import { calculateDeposit } from './deposit';
import { calculateUtility } from './utility';
import { calculateServiceFees } from './service';
import { calculatePenalty, calculateLateFee } from './penalty';
import { calculateDiscounts } from './discount';
import { calculateTenantSplits } from './split';

export function generateBill(
  input: CalculationInput,
  splitMode: SplitMode = 'average'
): Bill {
  const validation = validateCalculationInput(input);
  const exceptions: string[] = [...validation.errors, ...validation.warnings];

  const roundingMode = input.roundingMode || 'round';
  const precision = input.precision ?? 2;

  const feeDetails: FeeDetail[] = [];
  let refundSuggestion: RefundSuggestion | undefined;
  const splitExplanations: string[] = [];

  if (validation.valid) {
    const rentDetail = calculateRent({
      rentRule: input.rules.rent,
      billingPeriod: input.billingPeriod,
      moveInDate: input.moveInDate,
      moveOutDate: input.moveOutDate,
      leaseStartDate: input.leaseStartDate,
      leaseEndDate: input.leaseEndDate,
      billingPeriodMode: input.billingPeriodMode,
      roundingMode,
      precision,
    });
    feeDetails.push(rentDetail);

    if (input.rules.deposit) {
      const depositResult = calculateDeposit({
        depositRule: input.rules.deposit,
        moveOutDate: input.moveOutDate,
        roundingMode,
        precision,
      });
      if (depositResult.refundSuggestion) {
        refundSuggestion = depositResult.refundSuggestion;
      }
    }

    if (input.meterReadings) {
      const waterFee = calculateUtility({
        type: 'water',
        rule: input.rules.water,
        reading: input.meterReadings.water,
        roundingMode,
        precision,
      });
      if (waterFee) feeDetails.push(waterFee);

      const electricityFee = calculateUtility({
        type: 'electricity',
        rule: input.rules.electricity,
        reading: input.meterReadings.electricity,
        roundingMode,
        precision,
      });
      if (electricityFee) feeDetails.push(electricityFee);

      const gasFee = calculateUtility({
        type: 'gas',
        rule: input.rules.gas,
        reading: input.meterReadings.gas,
        roundingMode,
        precision,
      });
      if (gasFee) feeDetails.push(gasFee);
    }

    const serviceFees = calculateServiceFees({
      services: input.rules.services,
      billingPeriod: input.billingPeriod,
      billingPeriodMode: input.billingPeriodMode,
      roundingMode,
      precision,
    });
    feeDetails.push(...serviceFees);

    if (input.rules.penalty && input.rules.penalty.enabled) {
      const baseAmount = feeDetails
        .filter((f) => f.type !== 'discount')
        .reduce((sum, f) => sum + f.amount, 0);
      const penalty = calculatePenalty({
        penaltyRule: input.rules.penalty,
        baseAmount,
        roundingMode,
        precision,
      });
      if (penalty) feeDetails.push(penalty);
    }

    if (input.rules.lateFee && input.rules.lateFee.enabled && input.paymentDueDate && input.actualPaymentDate) {
      const baseAmount = feeDetails
        .filter((f) => f.type !== 'discount')
        .reduce((sum, f) => sum + f.amount, 0);
      const lateFee = calculateLateFee({
        lateFeeRule: input.rules.lateFee,
        baseAmount,
        dueDate: input.paymentDueDate,
        actualPaymentDate: input.actualPaymentDate,
        roundingMode,
        precision,
      });
      if (lateFee) feeDetails.push(lateFee);
    }

    if (input.rules.discounts && input.rules.discounts.length > 0) {
      const discounts = calculateDiscounts({
        discounts: input.rules.discounts,
        feeDetails,
        roundingMode,
        precision,
      });
      feeDetails.push(...discounts);
    }
  }

  const totalAmount = sumAmounts(
    feeDetails.map((f) => f.amount),
    roundingMode,
    precision
  );

  const billId = generateBillId();

  let tenantSplits: TenantSplit[] | undefined;
  if (input.tenants && input.tenants.length > 1) {
    const splitResult = calculateTenantSplits({
      feeDetails,
      tenants: input.tenants,
      splitMode,
      billingPeriod: input.billingPeriod,
      roundingMode,
      precision,
    });
    tenantSplits = splitResult.tenantSplits;
    splitExplanations.push(...splitResult.explanations);
  }

  const summary: BillSummary = {
    billId,
    period: input.billingPeriod,
    totalAmount,
    dueDate: input.paymentDueDate,
    numberOfItems: feeDetails.length,
    primaryTenant: input.tenants?.[0]?.name,
    status: validation.valid ? 'pending' : 'pending',
    billingPeriodMode: input.billingPeriodMode,
  };

  if (splitExplanations.length === 0) {
    if (input.tenants && input.tenants.length === 1) {
      splitExplanations.push(`单人租房，无需分摊，租客：${input.tenants[0].name}`);
    } else if (!input.tenants || input.tenants.length === 0) {
      splitExplanations.push(`未指定租客信息，共${input.numberOfTenants}人`);
    }
  }

  return {
    summary,
    feeDetails,
    tenantSplits,
    splitExplanation: splitExplanations,
    refundSuggestion,
    exceptions,
    generatedAt: formatDate(new Date()),
  };
}

function generateBillId(): string {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `BILL-${timestamp}-${random}`;
}
