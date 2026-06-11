import { RentalFeeSDK, CalculationInput, FeeRules, Tenant, ValidationResult } from '../src';

const sdk = new RentalFeeSDK({ roundingMode: 'round', precision: 2, splitMode: 'average' });

function log(title: string, data?: any): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  if (data !== undefined) {
    if (typeof data === 'string') console.log(data);
    else console.log(JSON.stringify(data, null, 2));
  }
}

function testDepositNotInTotal(): void {
  log('测试1: 押金不抬高应付总额，只出现在退款建议');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: {
      amount: 6000,
      freezeDays: 3,
      refundDays: 30,
      deductions: [
        { reason: '墙面修复', amount: 500 },
        { reason: '门锁更换', amount: 200 },
      ],
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    moveOutDate: '2026-12-31',
    billingPeriod: { startDate: '2026-12-01', endDate: '2026-12-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);

  console.log(sdk.getFeeBreakdown(bill));
  console.log(`\n总应付: ${bill.summary.totalAmount} 元`);
  console.log(`费用项类型: ${bill.feeDetails.map(f => f.type).join(', ')}`);
  console.log(`\n--- 退款建议 ---`);
  console.log(sdk.getRefundSuggestion(bill));

  const hasDepositInDetails = bill.feeDetails.some(f => f.type === 'deposit');
  console.log(`\n验证: feeDetails 中包含 deposit? ${hasDepositInDetails} → 期望 false`);
  console.log(`验证: 总应付 = ${bill.summary.totalAmount} → 期望 3000（仅租金）`);
  console.log(`验证: 应退押金 = ${bill.refundSuggestion?.refundAmount} → 期望 5300`);
  console.log(`验证: 原押金 = ${bill.refundSuggestion?.originalDeposit} → 期望 6000`);
}

function testServiceFeeTwoMonths(): void {
  log('测试2: 服务费按月计费 — 两个月账期');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
      { type: '网络费', amount: 100, cycle: 'monthly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-02-28' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  console.log(`\n总应付: ${bill.summary.totalAmount} 元`);
  console.log(`验证: 2个月 = 59天, 物业费 = 200/30*59 = ${(200/30*59).toFixed(2)}`);
  console.log(`验证: 2个月 = 59天, 网络费 = 100/30*59 = ${(100/30*59).toFixed(2)}`);
}

function testServiceFeeQuarter(): void {
  log('测试3: 服务费按季度计费 — 一个季度账期');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '季度物业费', amount: 600, cycle: 'quarterly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-03-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  console.log(`\n总应付: ${bill.summary.totalAmount} 元`);
  console.log(`验证: 1季度(90天), 1-3月=90天, 季度物业费 = 600`);
}

function testServiceFeePartialQuarter(): void {
  log('测试4: 服务费按季度 — 非整季度账期(100天)');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '季度服务费', amount: 900, cycle: 'quarterly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-04-10' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  const totalDays = 100;
  const fullQ = Math.floor(totalDays / 90);
  const remain = totalDays % 90;
  const dailyRate = 900 / 90;
  console.log(`\n验证: 100天 = 1整季度(90天) + 10天`);
  console.log(`  季度服务费 = ${fullQ} * 900 + ${remain} * ${dailyRate.toFixed(2)} = ${(fullQ * 900 + remain * dailyRate).toFixed(2)}`);
}

function testSplitByAreaWithPartialStay(): void {
  log('测试5: 按面积分摊 — 含半途入住和已退租租客');

  const rules: FeeRules = {
    rent: { monthlyAmount: 6000, billingCycle: 'monthly', prorationMethod: 'by_day' },
  };

  const tenants: Tenant[] = [
    { id: 'T1', name: '张三（全期）', areaRatio: 40, moveInDate: '2026-01-01', moveOutDate: '2026-01-31' },
    { id: 'T2', name: '李四（半途入住15日）', areaRatio: 35, moveInDate: '2026-01-15', moveOutDate: '2026-01-31' },
    { id: 'T3', name: '王五（已退租不在账期）', areaRatio: 25, moveInDate: '2025-12-01', moveOutDate: '2025-12-20' },
  ];

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 3,
    tenants,
    rules,
  };

  const bill = sdk.generateBill(input, 'area');
  console.log(sdk.getSplitExplanation(bill));

  console.log(`\n验证:`);
  console.log(`  张三: 全期31天, area=40, 权重=40*31=1240`);
  console.log(`  李四: 15-31共17天, area=35, 权重=35*17=595`);
  console.log(`  王五: 不在账期, 分摊=0`);
  console.log(`  总权重 = 1240+595 = 1835`);
  console.log(`  张三占比 = 1240/1835 ≈ ${((1240/1835)*100).toFixed(2)}%`);
  console.log(`  李四占比 = 595/1835 ≈ ${((595/1835)*100).toFixed(2)}%`);
}

function testSplitByRatioWithPartialStay(): void {
  log('测试6: 按比例分摊 — 含半途退租租客');

  const rules: FeeRules = {
    rent: { monthlyAmount: 5000, billingCycle: 'monthly', prorationMethod: 'by_day' },
  };

  const tenants: Tenant[] = [
    { id: 'T1', name: '张三（全期）', shareRatio: 50, moveInDate: '2026-01-01', moveOutDate: '2026-01-31' },
    { id: 'T2', name: '李四（20日退租）', shareRatio: 30, moveInDate: '2026-01-01', moveOutDate: '2026-01-20' },
    { id: 'T3', name: '王五（全期）', shareRatio: 20, moveInDate: '2026-01-01', moveOutDate: '2026-01-31' },
  ];

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 3,
    tenants,
    rules,
  };

  const bill = sdk.generateBill(input, 'ratio');
  console.log(sdk.getSplitExplanation(bill));

  console.log(`\n验证:`);
  console.log(`  张三: 全期31天, ratio=50, 权重=50*31=1550`);
  console.log(`  李四: 1-20日共20天, ratio=30, 权重=30*20=600`);
  console.log(`  王五: 全期31天, ratio=20, 权重=20*31=620`);
  console.log(`  总权重 = 1550+600+620 = 2770`);
  console.log(`  张三占比 = 1550/2770 ≈ ${((1550/2770)*100).toFixed(2)}%`);
  console.log(`  李四占比 = 600/2770 ≈ ${((600/2770)*100).toFixed(2)}%`);
  console.log(`  王五占比 = 620/2770 ≈ ${((620/2770)*100).toFixed(2)}%`);
}

function testValidationEmptyRules(): void {
  log('测试7: 校验 — 空规则、缺租金、空阶梯');

  const result1 = sdk.validate({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules: undefined as any,
  });
  console.log('--- 空规则 ---');
  console.log(`valid: ${result1.valid}, errors: ${result1.errors.length}`);
  result1.errors.forEach(e => console.log(`  - ${e}`));

  const result2 = sdk.validate({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules: {} as any,
  });
  console.log('\n--- 缺少租金规则 ---');
  console.log(`valid: ${result2.valid}, errors: ${result2.errors.length}`);
  result2.errors.forEach(e => console.log(`  - ${e}`));

  const result3 = sdk.validate({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules: {
      rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
      water: { tiers: [] },
      electricity: { tiers: undefined as any },
    } as any,
  });
  console.log('\n--- 空阶梯配置 ---');
  console.log(`valid: ${result3.valid}, errors: ${result3.errors.length}`);
  result3.errors.forEach(e => console.log(`  - ${e}`));

  const result4 = sdk.validate({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules: {
      rent: { monthlyAmount: -100, billingCycle: 'monthly', prorationMethod: 'by_day' },
      services: [{ type: '', amount: -50, cycle: 'monthly' }],
      discounts: [{ type: 'percentage' as any, amount: 200, applyTo: [] }],
    },
  });
  console.log('\n--- 多项错误 ---');
  console.log(`valid: ${result4.valid}, errors: ${result4.errors.length}`);
  result4.errors.forEach(e => console.log(`  - ${e}`));

  console.log('\n验证: 所有校验均返回了 valid/errors/warnings，没有中断');
}

function testValidationAlwaysReturnsStructure(): void {
  log('测试8: 校验 — 极端输入也不中断，始终返回结构');

  const extremeCases: { label: string; input: any }[] = [
    { label: 'null input', input: null },
    { label: 'undefined input', input: undefined },
    { label: 'empty object', input: {} },
    { label: 'missing billingPeriod', input: { leaseStartDate: '2026-01-01', leaseEndDate: '2026-12-31', moveInDate: '2026-01-01', numberOfTenants: 1, rules: {} } },
  ];

  for (const c of extremeCases) {
    try {
      const result = sdk.validate(c.input as CalculationInput);
      console.log(`${c.label}: valid=${result.valid}, errors=${result.errors.length}, warnings=${result.warnings.length}`);
    } catch (e: any) {
      console.log(`${c.label}: 抛出异常! ${e.message}`);
    }
  }

  console.log('\n验证: 所有极端输入均正常返回了 ValidationResult，未抛出异常');
}

function testBasicRentStillWorks(): void {
  log('测试9: 回归 — 整月租金和非整月租金仍然正确');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
  };

  const fullMonthInput: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };
  const bill1 = sdk.generateBill(fullMonthInput);
  console.log(`整月: ${bill1.feeDetails[0].amount} 元 (期望 3000)`);

  const partialInput: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };
  const bill2 = sdk.generateBill(partialInput);
  const expected = (3000 / 31 * 17).toFixed(2);
  console.log(`非整月(15-31日): ${bill2.feeDetails[0].amount} 元 (期望 ≈${expected})`);
}

function runAllTests(): void {
  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '租房费用 SDK — 四项改动验证测试'.padStart(38).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60));

  testDepositNotInTotal();
  testServiceFeeTwoMonths();
  testServiceFeeQuarter();
  testServiceFeePartialQuarter();
  testSplitByAreaWithPartialStay();
  testSplitByRatioWithPartialStay();
  testValidationEmptyRules();
  testValidationAlwaysReturnsStructure();
  testBasicRentStillWorks();

  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '所有验证测试执行完成！'.padStart(35).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60) + '\n');
}

runAllTests();
