import { UtilityRule, MeterReading, FeeDetail, FeeType, RoundingMode } from '../types';
import { roundAmount } from '../utils/rounding';

export interface UtilityCalculationInput {
  type: 'water' | 'electricity' | 'gas';
  rule?: UtilityRule;
  reading?: MeterReading;
  roundingMode?: RoundingMode;
  precision?: number;
}

const TYPE_NAMES: Record<string, string> = {
  water: '水费',
  electricity: '电费',
  gas: '燃气费',
};

export function calculateUtility(input: UtilityCalculationInput): FeeDetail | null {
  const { type, rule, reading, roundingMode = 'round', precision = 2 } = input;

  if (!rule || !reading) {
    return null;
  }

  const usage = reading.current - reading.previous;

  if (usage <= 0) {
    return {
      type: type as FeeType,
      name: TYPE_NAMES[type],
      amount: rule.baseFee ? roundAmount(rule.baseFee, roundingMode, precision) : 0,
      description: `无用量${rule.baseFee ? '，仅收基础费' : ''}`,
      breakdown: [
        { label: '上次抄数', value: reading.previous },
        { label: '本次抄数', value: reading.current },
        { label: '用量', value: usage },
      ],
    };
  }

  const breakdown: { label: string; value: number }[] = [];
  breakdown.push({ label: '上次抄数', value: reading.previous });
  breakdown.push({ label: '本次抄数', value: reading.current });
  breakdown.push({ label: '总用量', value: usage });

  let remainingUsage = usage;
  let tierAmount = 0;
  let tierIndex = 1;

  for (const tier of rule.tiers) {
    if (remainingUsage <= 0) break;

    const minUsage = tier.minUsage || 0;
    const maxUsage = tier.maxUsage ?? Infinity;
    const tierRange = maxUsage - minUsage;
    const tieredUsage = Math.min(remainingUsage, tierRange);

    if (tieredUsage > 0) {
      const tierCost = tieredUsage * tier.pricePerUnit;
      tierAmount += tierCost;
      breakdown.push({
        label: `第${tierIndex}阶梯(${minUsage}-${tier.maxUsage ?? '∞'}，${tier.pricePerUnit}元/单位)`,
        value: roundAmount(tierCost, roundingMode, precision),
      });
      remainingUsage -= tieredUsage;
    }
    tierIndex++;
  }

  let totalAmount = tierAmount;
  if (rule.baseFee) {
    totalAmount += rule.baseFee;
    breakdown.push({ label: '基础服务费', value: rule.baseFee });
  }

  totalAmount = roundAmount(totalAmount, roundingMode, precision);

  return {
    type: type as FeeType,
    name: TYPE_NAMES[type],
    amount: totalAmount,
    description: `阶梯计费，共${usage}单位`,
    breakdown,
  };
}
