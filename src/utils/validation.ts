import { FeeRules, CalculationInput, ValidationResult, DateRange } from '../types';
import { parseDate } from './date';

export function validateDateRange(range: DateRange): string[] {
  const errors: string[] = [];
  if (!range.startDate || !range.endDate) {
    errors.push('账期开始日期和结束日期不能为空');
    return errors;
  }
  const start = parseDate(range.startDate);
  const end = parseDate(range.endDate);
  if (isNaN(start.getTime())) {
    errors.push(`无效的开始日期格式: ${range.startDate}`);
  }
  if (isNaN(end.getTime())) {
    errors.push(`无效的结束日期格式: ${range.endDate}`);
  }
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
    errors.push('账期开始日期不能晚于结束日期');
  }
  return errors;
}

export function validateFeeRules(rules: FeeRules): string[] {
  const errors: string[] = [];
  if (!rules.rent) {
    errors.push('租金规则不能为空');
  } else {
    if (rules.rent.monthlyAmount <= 0) {
      errors.push('月租金金额必须大于0');
    }
    if (!['by_day', 'by_30days'].includes(rules.rent.prorationMethod)) {
      errors.push('租金分摊方式必须是 by_day 或 by_30days');
    }
  }

  if (rules.water) {
    if (!rules.water.tiers || rules.water.tiers.length === 0) {
      errors.push('水费规则必须包含阶梯配置');
    } else {
      rules.water.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit < 0) {
          errors.push(`水费第${idx + 1}阶梯单价不能为负数`);
        }
      });
    }
  }

  if (rules.electricity) {
    if (!rules.electricity.tiers || rules.electricity.tiers.length === 0) {
      errors.push('电费规则必须包含阶梯配置');
    } else {
      rules.electricity.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit < 0) {
          errors.push(`电费第${idx + 1}阶梯单价不能为负数`);
        }
      });
    }
  }

  if (rules.gas) {
    if (!rules.gas.tiers || rules.gas.tiers.length === 0) {
      errors.push('燃气费规则必须包含阶梯配置');
    } else {
      rules.gas.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit < 0) {
          errors.push(`燃气费第${idx + 1}阶梯单价不能为负数`);
        }
      });
    }
  }

  if (rules.lateFee && rules.lateFee.enabled) {
    if (rules.lateFee.dailyRate <= 0) {
      errors.push('滞纳金日利率必须大于0');
    }
    if (rules.lateFee.graceDays < 0) {
      errors.push('滞纳金宽限期不能为负数');
    }
  }

  if (rules.penalty && rules.penalty.enabled) {
    if (rules.penalty.percentage <= 0) {
      errors.push('违约金比例必须大于0');
    }
  }

  if (rules.discounts) {
    rules.discounts.forEach((discount, idx) => {
      if (discount.amount < 0) {
        errors.push(`第${idx + 1}条优惠金额不能为负数`);
      }
      if (discount.type === 'percentage' && discount.amount > 100) {
        errors.push(`第${idx + 1}条优惠折扣比例不能超过100%`);
      }
    });
  }

  return errors;
}

export function validateCalculationInput(input: CalculationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  errors.push(...validateDateRange(input.billingPeriod));

  const leaseStart = parseDate(input.leaseStartDate);
  const leaseEnd = parseDate(input.leaseEndDate);
  if (isNaN(leaseStart.getTime())) {
    errors.push(`无效的租约开始日期: ${input.leaseStartDate}`);
  }
  if (isNaN(leaseEnd.getTime())) {
    errors.push(`无效的租约结束日期: ${input.leaseEndDate}`);
  }
  if (!isNaN(leaseStart.getTime()) && !isNaN(leaseEnd.getTime()) && leaseStart > leaseEnd) {
    errors.push('租约开始日期不能晚于结束日期');
  }

  const moveIn = parseDate(input.moveInDate);
  if (isNaN(moveIn.getTime())) {
    errors.push(`无效的入住日期: ${input.moveInDate}`);
  }

  if (input.moveOutDate) {
    const moveOut = parseDate(input.moveOutDate);
    if (isNaN(moveOut.getTime())) {
      errors.push(`无效的退房日期: ${input.moveOutDate}`);
    }
    if (!isNaN(moveIn.getTime()) && !isNaN(moveOut.getTime()) && moveIn > moveOut) {
      errors.push('入住日期不能晚于退房日期');
    }
  }

  if (input.numberOfTenants <= 0) {
    errors.push('入住人数必须大于0');
  }

  if (input.tenants && input.tenants.length !== input.numberOfTenants) {
    warnings.push(`租客数量(${input.tenants.length})与入住人数(${input.numberOfTenants})不一致`);
  }

  errors.push(...validateFeeRules(input.rules));

  if (input.meterReadings) {
    const { water, electricity, gas } = input.meterReadings;
    if (water && water.current < water.previous) {
      errors.push('水表当前抄数不能小于上次抄数');
    }
    if (electricity && electricity.current < electricity.previous) {
      errors.push('电表当前抄数不能小于上次抄数');
    }
    if (gas && gas.current < gas.previous) {
      errors.push('燃气表当前抄数不能小于上次抄数');
    }
  }

  if (input.precision !== undefined && (input.precision < 0 || input.precision > 4)) {
    warnings.push('建议精度设置在0-4位小数之间');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
