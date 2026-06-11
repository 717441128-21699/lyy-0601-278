import { FeeRules, CalculationInput, ValidationResult, DateRange } from '../types';
import { parseDate } from './date';

export function validateDateRange(range: DateRange): string[] {
  const errors: string[] = [];
  if (!range) {
    errors.push('账期不能为空');
    return errors;
  }
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

  if (!rules) {
    errors.push('费用规则不能为空');
    return errors;
  }

  if (!rules.rent) {
    errors.push('租金规则不能为空');
  } else {
    if (rules.rent.monthlyAmount === undefined || rules.rent.monthlyAmount === null) {
      errors.push('月租金金额不能为空');
    } else if (rules.rent.monthlyAmount <= 0) {
      errors.push('月租金金额必须大于0');
    }
    if (!rules.rent.prorationMethod) {
      errors.push('租金分摊方式不能为空');
    } else if (!['by_day', 'by_30days'].includes(rules.rent.prorationMethod)) {
      errors.push('租金分摊方式必须是 by_day 或 by_30days');
    }
    if (!rules.rent.billingCycle) {
      errors.push('租金计费周期不能为空');
    } else if (!['monthly', 'weekly', 'daily', 'quarterly'].includes(rules.rent.billingCycle)) {
      errors.push('租金计费周期必须是 monthly、weekly、daily 或 quarterly');
    }
  }

  if (rules.water) {
    if (!rules.water.tiers) {
      errors.push('水费阶梯配置不能为空');
    } else if (rules.water.tiers.length === 0) {
      errors.push('水费规则必须包含至少一个阶梯配置');
    } else {
      rules.water.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit === undefined || tier.pricePerUnit === null) {
          errors.push(`水费第${idx + 1}阶梯单价不能为空`);
        } else if (tier.pricePerUnit < 0) {
          errors.push(`水费第${idx + 1}阶梯单价不能为负数`);
        }
        if (tier.minUsage === undefined || tier.minUsage === null) {
          errors.push(`水费第${idx + 1}阶梯最小用量不能为空`);
        } else if (tier.minUsage < 0) {
          errors.push(`水费第${idx + 1}阶梯最小用量不能为负数`);
        }
      });
    }
  }

  if (rules.electricity) {
    if (!rules.electricity.tiers) {
      errors.push('电费阶梯配置不能为空');
    } else if (rules.electricity.tiers.length === 0) {
      errors.push('电费规则必须包含至少一个阶梯配置');
    } else {
      rules.electricity.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit === undefined || tier.pricePerUnit === null) {
          errors.push(`电费第${idx + 1}阶梯单价不能为空`);
        } else if (tier.pricePerUnit < 0) {
          errors.push(`电费第${idx + 1}阶梯单价不能为负数`);
        }
        if (tier.minUsage === undefined || tier.minUsage === null) {
          errors.push(`电费第${idx + 1}阶梯最小用量不能为空`);
        } else if (tier.minUsage < 0) {
          errors.push(`电费第${idx + 1}阶梯最小用量不能为负数`);
        }
      });
    }
  }

  if (rules.gas) {
    if (!rules.gas.tiers) {
      errors.push('燃气费阶梯配置不能为空');
    } else if (rules.gas.tiers.length === 0) {
      errors.push('燃气费规则必须包含至少一个阶梯配置');
    } else {
      rules.gas.tiers.forEach((tier, idx) => {
        if (tier.pricePerUnit === undefined || tier.pricePerUnit === null) {
          errors.push(`燃气费第${idx + 1}阶梯单价不能为空`);
        } else if (tier.pricePerUnit < 0) {
          errors.push(`燃气费第${idx + 1}阶梯单价不能为负数`);
        }
        if (tier.minUsage === undefined || tier.minUsage === null) {
          errors.push(`燃气费第${idx + 1}阶梯最小用量不能为空`);
        } else if (tier.minUsage < 0) {
          errors.push(`燃气费第${idx + 1}阶梯最小用量不能为负数`);
        }
      });
    }
  }

  if (rules.deposit) {
    if (rules.deposit.amount === undefined || rules.deposit.amount === null) {
      errors.push('押金金额不能为空');
    } else if (rules.deposit.amount < 0) {
      errors.push('押金金额不能为负数');
    }
    if (rules.deposit.deductions) {
      rules.deposit.deductions.forEach((d, idx) => {
        if (d.amount < 0) {
          errors.push(`押金第${idx + 1}项扣除金额不能为负数`);
        }
      });
    }
  }

  if (rules.services) {
    rules.services.forEach((s, idx) => {
      if (!s.type) {
        errors.push(`第${idx + 1}项服务费类型不能为空`);
      }
      if (s.amount === undefined || s.amount === null) {
        errors.push(`第${idx + 1}项服务费金额不能为空`);
      } else if (s.amount < 0) {
        errors.push(`第${idx + 1}项服务费金额不能为负数`);
      }
      if (!s.cycle) {
        errors.push(`第${idx + 1}项服务费计费周期不能为空`);
      }
    });
  }

  if (rules.lateFee && rules.lateFee.enabled) {
    if (rules.lateFee.dailyRate === undefined || rules.lateFee.dailyRate === null) {
      errors.push('滞纳金日利率不能为空');
    } else if (rules.lateFee.dailyRate <= 0) {
      errors.push('滞纳金日利率必须大于0');
    }
    if (rules.lateFee.graceDays === undefined || rules.lateFee.graceDays === null) {
      errors.push('滞纳金宽限期不能为空');
    } else if (rules.lateFee.graceDays < 0) {
      errors.push('滞纳金宽限期不能为负数');
    }
  }

  if (rules.penalty && rules.penalty.enabled) {
    if (rules.penalty.percentage === undefined || rules.penalty.percentage === null) {
      errors.push('违约金比例不能为空');
    } else if (rules.penalty.percentage <= 0) {
      errors.push('违约金比例必须大于0');
    }
  }

  if (rules.discounts) {
    rules.discounts.forEach((discount, idx) => {
      if (!discount.type) {
        errors.push(`第${idx + 1}条优惠类型不能为空`);
      }
      if (discount.amount === undefined || discount.amount === null) {
        errors.push(`第${idx + 1}条优惠金额不能为空`);
      } else if (discount.amount < 0) {
        errors.push(`第${idx + 1}条优惠金额不能为负数`);
      }
      if (discount.type === 'percentage' && discount.amount > 100) {
        errors.push(`第${idx + 1}条优惠折扣比例不能超过100%`);
      }
      if (!discount.applyTo || discount.applyTo.length === 0) {
        errors.push(`第${idx + 1}条优惠适用费用类型不能为空`);
      }
    });
  }

  return errors;
}

export function validateCalculationInput(input: CalculationInput): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!input) {
    return {
      valid: false,
      errors: ['计算输入不能为空'],
      warnings: [],
    };
  }

  if (!input.billingPeriod) {
    errors.push('账期不能为空');
  } else {
    errors.push(...validateDateRange(input.billingPeriod));
  }

  if (!input.leaseStartDate) {
    errors.push('租约开始日期不能为空');
  } else {
    const leaseStart = parseDate(input.leaseStartDate);
    if (isNaN(leaseStart.getTime())) {
      errors.push(`无效的租约开始日期: ${input.leaseStartDate}`);
    }
  }

  if (!input.leaseEndDate) {
    errors.push('租约结束日期不能为空');
  } else {
    const leaseEnd = parseDate(input.leaseEndDate);
    if (isNaN(leaseEnd.getTime())) {
      errors.push(`无效的租约结束日期: ${input.leaseEndDate}`);
    }
  }

  if (input.leaseStartDate && input.leaseEndDate) {
    const leaseStart = parseDate(input.leaseStartDate);
    const leaseEnd = parseDate(input.leaseEndDate);
    if (!isNaN(leaseStart.getTime()) && !isNaN(leaseEnd.getTime()) && leaseStart > leaseEnd) {
      errors.push('租约开始日期不能晚于结束日期');
    }
  }

  if (!input.moveInDate) {
    errors.push('入住日期不能为空');
  } else {
    const moveIn = parseDate(input.moveInDate);
    if (isNaN(moveIn.getTime())) {
      errors.push(`无效的入住日期: ${input.moveInDate}`);
    }
  }

  if (input.moveOutDate) {
    const moveOut = parseDate(input.moveOutDate);
    if (isNaN(moveOut.getTime())) {
      errors.push(`无效的退房日期: ${input.moveOutDate}`);
    }
  }

  if (input.moveInDate && input.moveOutDate) {
    const moveIn = parseDate(input.moveInDate);
    const moveOut = parseDate(input.moveOutDate);
    if (!isNaN(moveIn.getTime()) && !isNaN(moveOut.getTime()) && moveIn > moveOut) {
      errors.push('入住日期不能晚于退房日期');
    }
  }

  if (input.numberOfTenants === undefined || input.numberOfTenants === null) {
    errors.push('入住人数不能为空');
  } else if (input.numberOfTenants <= 0) {
    errors.push('入住人数必须大于0');
  }

  if (input.tenants && input.numberOfTenants && input.tenants.length !== input.numberOfTenants) {
    warnings.push(`租客数量(${input.tenants.length})与入住人数(${input.numberOfTenants})不一致`);
  }

  if (!input.rules) {
    errors.push('费用规则不能为空');
  } else {
    errors.push(...validateFeeRules(input.rules));
  }

  if (input.meterReadings) {
    const { water, electricity, gas } = input.meterReadings;
    if (water) {
      if (water.current === undefined || water.previous === undefined) {
        errors.push('水表抄数不能为空');
      } else if (water.current < water.previous) {
        errors.push('水表当前抄数不能小于上次抄数');
      }
    }
    if (electricity) {
      if (electricity.current === undefined || electricity.previous === undefined) {
        errors.push('电表抄数不能为空');
      } else if (electricity.current < electricity.previous) {
        errors.push('电表当前抄数不能小于上次抄数');
      }
    }
    if (gas) {
      if (gas.current === undefined || gas.previous === undefined) {
        errors.push('燃气表抄数不能为空');
      } else if (gas.current < gas.previous) {
        errors.push('燃气表当前抄数不能小于上次抄数');
      }
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
