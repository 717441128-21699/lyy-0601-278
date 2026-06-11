import { RentalFeeSDK, CalculationInput, FeeRules } from '../src';

const sdk = new RentalFeeSDK({ roundingMode: 'round', precision: 2 });

function log(title: string, data?: any): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  if (data !== undefined) {
    if (typeof data === 'string') console.log(data);
    else console.log(JSON.stringify(data, null, 2));
  }
}

function testServiceFeeTwoNaturalMonths(): void {
  log('测试1: 服务费按月 — 两个完整自然月(1-2月)，自然月口径应收两个月金额');

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
    billingPeriodMode: 'natural_month',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getBillSummary(bill));
  console.log(sdk.getFeeBreakdown(bill));

  const propertyFee = bill.feeDetails.find(f => f.name === '物业费');
  const networkFee = bill.feeDetails.find(f => f.name === '网络费');
  console.log(`\n验证: 物业费 = ${propertyFee?.amount} → 期望 400 (200×2)`);
  console.log(`验证: 网络费 = ${networkFee?.amount} → 期望 200 (100×2)`);
  console.log(`说明: ${propertyFee?.description}`);
}

function testServiceFeeNaturalQuarter(): void {
  log('测试2: 服务费按季度 — 完整自然季度(Q1)，自然季度口径应收一个季度金额');

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
    billingPeriodMode: 'natural_quarter',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getBillSummary(bill));
  console.log(sdk.getFeeBreakdown(bill));

  const qFee = bill.feeDetails.find(f => f.name === '季度物业费');
  console.log(`\n验证: 季度物业费 = ${qFee?.amount} → 期望 600`);
  console.log(`说明: ${qFee?.description}`);
}

function testServiceFeeNonFullNaturalMonth(): void {
  log('测试3: 服务费按月 — 非整自然月(1月15日-2月28日)，自然月口径');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '物业费', amount: 300, cycle: 'monthly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-15', endDate: '2026-02-28' },
    billingPeriodMode: 'natural_month',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const propFee = bill.feeDetails.find(f => f.name === '物业费');
  console.log(`\n验证: 1月15-31日=17天(非整月) + 2月1-28日=28天(整月)`);
  console.log(`  整月1个 × 300 + 零散17天 × 10/天 = 300 + 170 = 470`);
  console.log(`  实际物业费 = ${propFee?.amount}`);
  console.log(`  说明: ${propFee?.description}`);
}

function testServiceFeeCustomDaysMode(): void {
  log('测试4: 服务费按月 — 自定义天数口径(59天)');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-02-28' },
    billingPeriodMode: 'custom_days',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const propFee = bill.feeDetails.find(f => f.name === '物业费');
  console.log(`\n验证: 59天 ÷ 30 = 1整月 + 29天`);
  console.log(`  200 + 29 × (200/30) = 200 + 193.33 = 393.33`);
  console.log(`  实际物业费 = ${propFee?.amount}`);
  console.log(`  说明: ${propFee?.description}`);
}

function testPaymentScheduleNaturalMonth(): void {
  log('测试5: 收款计划 — 自然月口径，6个月租期');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 6000, freezeDays: 3, refundDays: 30 },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
      { type: '网络费', amount: 100, cycle: 'monthly' },
    ],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-06-30',
    moveInDate: '2026-01-01',
    rules,
    billingPeriodMode: 'natural_month',
    utilityEstimatePerMonth: 150,
    paymentDueOffsetDays: 5,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log(`\n验证: 应有6期，每期租金3000 + 物业200 + 网络100 + 水电预估150 = 3450`);
}

function testPaymentScheduleMidMoveIn(): void {
  log('测试6: 收款计划 — 中途入住，首期自动修正');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 6000 },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
    ],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-06-30',
    moveInDate: '2026-01-15',
    rules,
    billingPeriodMode: 'natural_month',
    utilityEstimatePerMonth: 100,
    paymentDueOffsetDays: 5,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log(`\n验证: 首期(1月15-31日=17天)租金应按天数折算`);
  console.log(`  首期租金 ≈ 3000/31 × 17 ≈ ${(3000/31*17).toFixed(2)}`);
}

function testPaymentScheduleEarlyMoveOut(): void {
  log('测试7: 收款计划 — 提前退租，末期自动修正');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
    ],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-06-30',
    moveInDate: '2026-01-01',
    moveOutDate: '2026-04-10',
    rules,
    billingPeriodMode: 'natural_month',
    utilityEstimatePerMonth: 100,
    paymentDueOffsetDays: 5,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log(`\n验证: 末期(4月1-10日=10天)租金应按天数折算`);
  console.log(`  末期租金 ≈ 3000/30 × 10 = 1000`);
}

function testBillComparisonDetailed(): void {
  log('测试8: 增强账单对比 — 按费用项增减原因和异常标记');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    water: { tiers: [{ minUsage: 0, pricePerUnit: 3.5 }] },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
    ],
  };

  const janInput: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    billingPeriodMode: 'natural_month',
    numberOfTenants: 1,
    meterReadings: { water: { previous: 0, current: 10 } },
    rules,
  };

  const febInput: CalculationInput = {
    ...janInput,
    billingPeriod: { startDate: '2026-02-01', endDate: '2026-02-28' },
    meterReadings: { water: { previous: 10, current: 50 } },
    rules: {
      ...rules,
      discounts: [{ type: 'fixed', amount: 100, applyTo: ['rent'], description: '春节优惠' }],
    },
  };

  const janBill = sdk.generateBill(janInput);
  const febBill = sdk.generateBill(febInput);

  const comparison = sdk.compareBillsDetailed({
    currentBill: febBill,
    previousBill: janBill,
    anomalyThreshold: 30,
    anomalyPercentageThreshold: 15,
  });

  console.log(sdk.getComparisonText(comparison));

  console.log(`\n1月: 租金3000 + 水费35 + 物业200 = 3235`);
  console.log(`2月: 租金3000 - 优惠100 + 水费140 + 物业200 = 3240`);
  console.log(`\n验证: 异常项包含水费(从35→140, 变化>30元且>15%)和优惠(新增-100元)`);
}

function testBillingPeriodModeInSummary(): void {
  log('测试9: 账单摘要显示口径信息');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
  };

  const inputNM: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    billingPeriodMode: 'natural_month',
    numberOfTenants: 1,
    rules,
  };

  const billNM = sdk.generateBill(inputNM);
  console.log('自然月口径:');
  console.log(sdk.getBillSummary(billNM));

  const inputCD: CalculationInput = {
    ...inputNM,
    billingPeriodMode: 'custom_days',
  };

  const billCD = sdk.generateBill(inputCD);
  console.log('\n自定义天数口径:');
  console.log(sdk.getBillSummary(billCD));
}

function testServiceFeeNonFullNaturalQuarter(): void {
  log('测试10: 服务费按季度 — 非整自然季度(1月15日-4月10日)，自然季度口径');
  console.log('说明: 缺少1月1-14日不构成完整自然季度，因此全部按零散天数折算');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '季度服务费', amount: 900, cycle: 'quarterly' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-15', endDate: '2026-04-10' },
    billingPeriodMode: 'natural_quarter',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const qFee = bill.feeDetails.find(f => f.name === '季度服务费');
  console.log(`\n验证: 1月15日-4月10日共86天，0个完整自然季度`);
  console.log(`  86天 × (900/90) = 860`);
  console.log(`  实际 = ${qFee?.amount}`);
  console.log(`  说明: ${qFee?.description}`);
}

function testServiceFeeFullQ1PlusExtra(): void {
  log('测试11: 服务费按季度 — 完整Q1 + 额外天数，自然季度口径');

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
    billingPeriodMode: 'natural_quarter',
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const qFee = bill.feeDetails.find(f => f.name === '季度服务费');
  console.log(`\n验证: 1月1日-3月31日=完整Q1 + 4月1-10日=10天(非整季)`);
  console.log(`  1个完整季度 × 900 + 10天 × (900/90) = 900 + 100 = 1000`);
  console.log(`  实际 = ${qFee?.amount}`);
  console.log(`  说明: ${qFee?.description}`);
}

function runAllTests(): void {
  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '租房费用 SDK — 四项增强验证测试'.padStart(38).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60));

  testServiceFeeTwoNaturalMonths();
  testServiceFeeNaturalQuarter();
  testServiceFeeNonFullNaturalMonth();
  testServiceFeeCustomDaysMode();
  testPaymentScheduleNaturalMonth();
  testPaymentScheduleMidMoveIn();
  testPaymentScheduleEarlyMoveOut();
  testBillComparisonDetailed();
  testBillingPeriodModeInSummary();
  testServiceFeeNonFullNaturalQuarter();
  testServiceFeeFullQ1PlusExtra();

  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '所有验证测试执行完成！'.padStart(35).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60) + '\n');
}

runAllTests();
