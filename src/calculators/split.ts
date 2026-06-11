import { Tenant, FeeDetail, TenantSplit, SplitMode, RoundingMode, FeeType } from '../types';
import { roundAmount, sumAmounts } from '../utils/rounding';
import { daysBetween, getOverlapRange } from '../utils/date';

export interface SplitCalculationInput {
  feeDetails: FeeDetail[];
  tenants: Tenant[];
  splitMode: SplitMode;
  billingPeriod: { startDate: string; endDate: string };
  roundingMode?: RoundingMode;
  precision?: number;
}

export interface SplitResult {
  tenantSplits: TenantSplit[];
  explanations: string[];
}

export function calculateTenantSplits(input: SplitCalculationInput): SplitResult {
  const {
    feeDetails,
    tenants,
    splitMode,
    billingPeriod,
    roundingMode = 'round',
    precision = 2,
  } = input;

  const explanations: string[] = [];
  const tenantSplits: TenantSplit[] = tenants.map((tenant) => ({
    tenantId: tenant.id,
    tenantName: tenant.name,
    totalAmount: 0,
    feeDetails: [],
    splitDescription: '',
  }));

  if (tenants.length === 0 || feeDetails.length === 0) {
    return { tenantSplits, explanations: ['无可分摊的费用或租客'] };
  }

  explanations.push(`分摊方式：${getSplitModeName(splitMode)}`);

  for (const fee of feeDetails) {
    if (fee.type === 'discount') {
      splitByRatio(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
      continue;
    }

    switch (splitMode) {
      case 'average':
        splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
        break;
      case 'area':
        splitByArea(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
        break;
      case 'ratio':
        splitByRatio(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
        break;
      case 'custom':
        splitByCustom(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
        break;
    }
  }

  tenantSplits.forEach((split) => {
    split.totalAmount = sumAmounts(
      split.feeDetails.map((f) => f.amount),
      roundingMode,
      precision
    );
    split.splitDescription = `${split.tenantName}应分摊${split.feeDetails.length}项费用，合计${split.totalAmount}元`;
  });

  return { tenantSplits, explanations };
}

function getSplitModeName(mode: SplitMode): string {
  const names: Record<SplitMode, string> = {
    average: '平均分摊',
    area: '按面积分摊',
    ratio: '按比例分摊',
    custom: '自定义分摊',
  };
  return names[mode];
}

function getTenantStayDays(
  tenant: Tenant,
  billingPeriod: { startDate: string; endDate: string }
): number {
  const tenantPeriod = {
    startDate: tenant.moveInDate || billingPeriod.startDate,
    endDate: tenant.moveOutDate || billingPeriod.endDate,
  };
  const overlap = getOverlapRange(tenantPeriod, billingPeriod);
  if (!overlap) return 0;
  return daysBetween(overlap.startDate, overlap.endDate) + 1;
}

function getBillingPeriodDays(billingPeriod: { startDate: string; endDate: string }): number {
  return daysBetween(billingPeriod.startDate, billingPeriod.endDate) + 1;
}

function splitAverage(
  fee: FeeDetail,
  tenants: Tenant[],
  tenantSplits: TenantSplit[],
  billingPeriod: { startDate: string; endDate: string },
  roundingMode: RoundingMode,
  precision: number,
  explanations: string[]
): void {
  const stayDays = tenants.map((t) => getTenantStayDays(t, billingPeriod));
  const totalStayDays = stayDays.reduce((a, b) => a + b, 0);

  if (totalStayDays === 0) {
    explanations.push(`${fee.name}：无租客在计费期内，跳过分摊`);
    return;
  }

  let remainingAmount = fee.amount;
  tenants.forEach((tenant, idx) => {
    if (stayDays[idx] === 0) return;

    let shareAmount: number;
    if (idx === tenants.length - 1) {
      shareAmount = remainingAmount;
    } else {
      shareAmount = roundAmount((fee.amount * stayDays[idx]) / totalStayDays, roundingMode, precision);
      remainingAmount = roundAmount(remainingAmount - shareAmount, roundingMode, precision);
    }

    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: shareAmount,
      description: `${fee.description}（平均分摊，${stayDays[idx]}天）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按入住天数平均分摊`);
}

function splitByArea(
  fee: FeeDetail,
  tenants: Tenant[],
  tenantSplits: TenantSplit[],
  billingPeriod: { startDate: string; endDate: string },
  roundingMode: RoundingMode,
  precision: number,
  explanations: string[]
): void {
  const stayDays = tenants.map((t) => getTenantStayDays(t, billingPeriod));
  const totalBillingDays = getBillingPeriodDays(billingPeriod);

  const weightedAreas = tenants.map((t, idx) => {
    if (stayDays[idx] === 0) return 0;
    return (t.areaRatio || 0) * stayDays[idx];
  });
  const totalWeightedArea = weightedAreas.reduce((a, b) => a + b, 0);

  if (totalWeightedArea === 0) {
    splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
    return;
  }

  let remainingAmount = fee.amount;
  tenants.forEach((tenant, idx) => {
    if (stayDays[idx] === 0) {
      tenantSplits[idx].feeDetails.push({
        ...fee,
        amount: 0,
        description: `${fee.description}（不在账期内，不分摊）`,
      });
      return;
    }

    let shareAmount: number;
    if (idx === tenants.length - 1) {
      shareAmount = remainingAmount;
    } else {
      shareAmount = roundAmount((fee.amount * weightedAreas[idx]) / totalWeightedArea, roundingMode, precision);
      remainingAmount = roundAmount(remainingAmount - shareAmount, roundingMode, precision);
    }

    const areaPct = ((weightedAreas[idx] / totalWeightedArea) * 100).toFixed(2);
    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: shareAmount,
      description: `${fee.description}（按面积×天数分摊，占比${areaPct}%，${stayDays[idx]}/${totalBillingDays}天）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按面积×入住天数加权分摊`);
}

function splitByRatio(
  fee: FeeDetail,
  tenants: Tenant[],
  tenantSplits: TenantSplit[],
  billingPeriod: { startDate: string; endDate: string },
  roundingMode: RoundingMode,
  precision: number,
  explanations: string[]
): void {
  const stayDays = tenants.map((t) => getTenantStayDays(t, billingPeriod));
  const totalBillingDays = getBillingPeriodDays(billingPeriod);

  const weightedRatios = tenants.map((t, idx) => {
    if (stayDays[idx] === 0) return 0;
    return (t.shareRatio || 0) * stayDays[idx];
  });
  const totalWeightedRatio = weightedRatios.reduce((a, b) => a + b, 0);

  if (totalWeightedRatio === 0) {
    splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
    return;
  }

  let remainingAmount = fee.amount;
  tenants.forEach((tenant, idx) => {
    if (stayDays[idx] === 0) {
      tenantSplits[idx].feeDetails.push({
        ...fee,
        amount: 0,
        description: `${fee.description}（不在账期内，不分摊）`,
      });
      return;
    }

    let shareAmount: number;
    if (idx === tenants.length - 1) {
      shareAmount = remainingAmount;
    } else {
      shareAmount = roundAmount((fee.amount * weightedRatios[idx]) / totalWeightedRatio, roundingMode, precision);
      remainingAmount = roundAmount(remainingAmount - shareAmount, roundingMode, precision);
    }

    const ratioPct = ((weightedRatios[idx] / totalWeightedRatio) * 100).toFixed(2);
    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: shareAmount,
      description: `${fee.description}（按比例×天数分摊，占比${ratioPct}%，${stayDays[idx]}/${totalBillingDays}天）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按约定比例×入住天数加权分摊`);
}

function splitByCustom(
  fee: FeeDetail,
  tenants: Tenant[],
  tenantSplits: TenantSplit[],
  billingPeriod: { startDate: string; endDate: string },
  roundingMode: RoundingMode,
  precision: number,
  explanations: string[]
): void {
  const stayDays = tenants.map((t) => getTenantStayDays(t, billingPeriod));

  const customAmounts = tenants.map((t, idx) => {
    if (stayDays[idx] === 0) return 0;
    return t.customAmount?.[fee.type as FeeType] || 0;
  });
  const totalCustom = customAmounts.reduce((a, b) => a + b, 0);

  if (totalCustom === 0) {
    splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
    return;
  }

  tenants.forEach((tenant, idx) => {
    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: customAmounts[idx],
      description: stayDays[idx] === 0
        ? `${fee.description}（不在账期内，不分摊）`
        : `${fee.description}（自定义分摊金额）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按自定义金额分摊`);
}
