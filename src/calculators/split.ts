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
        splitByCustom(fee, tenants, tenantSplits, roundingMode, precision, explanations);
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
  const areas = tenants.map((t) => t.areaRatio || 0);
  const totalArea = areas.reduce((a, b) => a + b, 0);

  if (totalArea === 0) {
    splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
    return;
  }

  let remainingAmount = fee.amount;
  tenants.forEach((tenant, idx) => {
    let shareAmount: number;
    if (idx === tenants.length - 1) {
      shareAmount = remainingAmount;
    } else {
      shareAmount = roundAmount((fee.amount * areas[idx]) / totalArea, roundingMode, precision);
      remainingAmount = roundAmount(remainingAmount - shareAmount, roundingMode, precision);
    }

    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: shareAmount,
      description: `${fee.description}（按面积分摊，占比${((areas[idx] / totalArea) * 100).toFixed(2)}%）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按面积比例分摊`);
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
  const ratios = tenants.map((t) => t.shareRatio || 0);
  const totalRatio = ratios.reduce((a, b) => a + b, 0);

  if (totalRatio === 0) {
    splitAverage(fee, tenants, tenantSplits, billingPeriod, roundingMode, precision, explanations);
    return;
  }

  let remainingAmount = fee.amount;
  tenants.forEach((tenant, idx) => {
    let shareAmount: number;
    if (idx === tenants.length - 1) {
      shareAmount = remainingAmount;
    } else {
      shareAmount = roundAmount((fee.amount * ratios[idx]) / totalRatio, roundingMode, precision);
      remainingAmount = roundAmount(remainingAmount - shareAmount, roundingMode, precision);
    }

    tenantSplits[idx].feeDetails.push({
      ...fee,
      amount: shareAmount,
      description: `${fee.description}（按比例分摊，占比${((ratios[idx] / totalRatio) * 100).toFixed(2)}%）`,
    });
  });

  explanations.push(`${fee.name}（${fee.amount}元）：按约定比例分摊`);
}

function splitByCustom(
  fee: FeeDetail,
  tenants: Tenant[],
  tenantSplits: TenantSplit[],
  roundingMode: RoundingMode,
  precision: number,
  explanations: string[]
): void {
  const customAmounts = tenants.map((t) => t.customAmount?.[fee.type as FeeType] || 0);
  const totalCustom = customAmounts.reduce((a, b) => a + b, 0);

  if (totalCustom === 0) {
    const avgAmount = roundAmount(fee.amount / tenants.length, roundingMode, precision);
    let remaining = fee.amount;
    tenants.forEach((tenant, idx) => {
      const share = idx === tenants.length - 1 ? remaining : avgAmount;
      remaining = roundAmount(remaining - share, roundingMode, precision);
      tenantSplits[idx].feeDetails.push({
        ...fee,
        amount: share,
        description: `${fee.description}（自定义金额为0，退回平均分摊）`,
      });
    });
  } else {
    tenants.forEach((tenant, idx) => {
      tenantSplits[idx].feeDetails.push({
        ...fee,
        amount: customAmounts[idx],
        description: `${fee.description}（自定义分摊金额）`,
      });
    });
  }

  explanations.push(`${fee.name}（${fee.amount}元）：按自定义金额分摊`);
}
