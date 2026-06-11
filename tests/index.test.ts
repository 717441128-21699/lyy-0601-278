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
    dueDateRule: { offsetDays: 5 },
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
    dueDateRule: { offsetDays: 5 },
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
    dueDateRule: { offsetDays: 5 },
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
  console.log('█' + '租房费用 SDK — 账期口径×收款计划 完整验证'.padStart(44).padEnd(58) + '█');
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

  testCustomDaysRentNotNatural();
  testQuarterPeriodMonthlyService();
  testPaymentScheduleFixedDayDue();
  testPaymentScheduleWithDiscounts();
  testHolidayShiftDueDate();

  testCustomDaysSingleDay();
  testReconciliationStatus();
  testCombinedAndSplitPayments();
  testDueDateRuleCombined();
  testDiscountScopeFromFeeRules();

  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '所有验证测试执行完成！'.padStart(35).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60) + '\n');
}

function testCustomDaysSingleDay(): void {
  log('测试17: 自定义天数1天租期 — 当天这一期不漏期');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [{ type: '物业费', amount: 150, cycle: 'monthly' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-06-11',
    leaseEndDate: '2026-06-11',
    moveInDate: '2026-06-11',
    rules,
    billingPeriodMode: 'custom_days',
    customDays: 30,
    waterEstimatePerMonth: 30,
    electricityEstimatePerMonth: 60,
    dueDateRule: { offsetDays: 0 },
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  const only = schedule.items.find(i => i.kind !== 'deposit');
  console.log(`\n验证: 共1期,期数=${schedule.items.filter(i=>i.kind!=='deposit').length},租金≈3000/30=100,实际=${only?.rent}`);
  console.log(`验证: 物业费≈150/30=5,实际=${only?.serviceFees[0]?.amount}`);
  console.log(`验证: 水费≈1,电费≈2,合计水电≈${only?.utilityEstimate}`);
}

function testReconciliationStatus(): void {
  log('测试18: 对账状态 — 待收/部分收款/已收/逾期自动识别');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 6000 },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-03-31',
    moveInDate: '2026-01-01',
    rules,
    billingPeriodMode: 'natural_month',
    dueDateRule: { offsetDays: 5 },
    utilityEstimatePerMonth: 100,
  });

  const rec = sdk.applyPayments(schedule, [
    { id: 'PAY-1', date: '2026-01-02', amount: 6000, method: 'wechat', remark: '押金全额', allocations: [{ periodIndex: 0, feeTypes: ['deposit'], amount: 6000 }] },
    { id: 'PAY-2', date: '2026-01-05', amount: 2000, method: 'alipay', remark: '1月部分租金', allocations: [{ periodIndex: 1, feeTypes: ['rent'], amount: 2000 }] },
    { id: 'PAY-3', date: '2026-02-03', amount: 3300, method: 'bank', remark: '2月全额', allocations: [{ periodIndex: 2, feeTypes: ['rent', 'service', 'water'], amount: 3300 }] },
  ], { asOfDate: '2026-03-15' });

  console.log(sdk.getReconciliationText(rec));
  console.log('\n验证:');
  rec.scheduleItems.forEach(i => {
    console.log(`  第${i.periodIndex}期[${i.kind}] 应收=${i.totalExpected},已收=${i.receivedAmount},剩余=${i.remainingAmount},状态=${i.status},进度=${i.progress}%,逾期=${i.overdueDays}天`);
  });
}

function testCombinedAndSplitPayments(): void {
  log('测试19: 合并收款+分次收款 — 押金+首期一起收，租金分两笔');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 6000 },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-03-15',
    leaseEndDate: '2026-05-31',
    moveInDate: '2026-03-15',
    rules,
    billingPeriodMode: 'natural_month',
    dueDateRule: { offsetDays: 5 },
    utilityEstimatePerMonth: 120,
  });

  const depositAndFirst = schedule.items[1].totalExpected + schedule.items[0].totalExpected;
  const rec = sdk.applyPayments(schedule, [
    { id: 'PAY-A', date: '2026-03-14', amount: depositAndFirst, method: 'wechat', remark: '押金+首期合并收款', allocations: [
      { periodIndex: 0, feeTypes: ['deposit'], amount: 6000 },
      { periodIndex: 1, feeTypes: ['rent', 'service', 'water', 'electricity'], amount: schedule.items[1].totalExpected },
    ]},
    { id: 'PAY-B1', date: '2026-04-20', amount: 2000, method: 'alipay', remark: '2月租金分笔1', allocations: [
      { periodIndex: 2, feeTypes: ['rent'], amount: 2000 },
    ]},
    { id: 'PAY-B2', date: '2026-04-25', amount: 1320, method: 'alipay', remark: '2月剩余补齐', allocations: [
      { periodIndex: 2, feeTypes: ['rent', 'service'], amount: 1320 },
    ]},
  ], { asOfDate: '2026-05-05' });

  console.log(sdk.getReconciliationText(rec));
}

function testDueDateRuleCombined(): void {
  log('测试20: 付款规则组合 — 固定几号+提前几天+首期入住晚顺延');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-20',
    leaseEndDate: '2026-03-31',
    moveInDate: '2026-01-20',
    rules,
    billingPeriodMode: 'natural_month',
    dueDateRule: { offsetDays: 5, fixedDayOfMonth: 15, shiftHoliday: false },
    utilityEstimatePerMonth: 90,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log('\n验证:');
  schedule.items.forEach(i => {
    if (i.kind !== 'deposit') console.log(`  第${i.periodIndex}期[${i.kind}] 账期=${i.period.startDate}~${i.period.endDate},应收日=${i.dueDate}`);
  });
  console.log(`首期入住1月20日早，应收日应顺延到≥1月20日`);
}

function testDiscountScopeFromFeeRules(): void {
  log('测试21: 优惠从 FeeRules 读取 + 三种作用域（首期/全部/仅服务费）');

  const rulesA: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
    discounts: [{ type: 'fixed', amount: 200, applyTo: ['rent', 'service'], description: '首期减免200' }],
  };
  const schA = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01', leaseEndDate: '2026-03-31', moveInDate: '2026-01-01',
    rules: rulesA, billingPeriodMode: 'natural_month', discountScope: 'first_period',
    dueDateRule: { offsetDays: 0 },
  });
  console.log('-- discountScope=first_period 首期减免200 --');
  schA.items.filter(i => i.kind !== 'deposit').forEach(i => {
    console.log(`  第${i.periodIndex}期 优惠=${i.discountTotal},本期合计=${i.totalExpected}`);
  });

  const schB = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01', leaseEndDate: '2026-03-31', moveInDate: '2026-01-01',
    rules: rulesA, billingPeriodMode: 'natural_month', discountScope: 'all_periods',
    dueDateRule: { offsetDays: 0 },
  });
  console.log('-- discountScope=all_periods 每期都减200 --');
  schB.items.filter(i => i.kind !== 'deposit').forEach(i => {
    console.log(`  第${i.periodIndex}期 优惠=${i.discountTotal},本期合计=${i.totalExpected}`);
  });

  const rulesC: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
    discounts: [{ type: 'percentage', amount: 50, applyTo: ['service'], description: '服务费5折' }],
  };
  const schC = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01', leaseEndDate: '2026-03-31', moveInDate: '2026-01-01',
    rules: rulesC, billingPeriodMode: 'natural_month', discountScope: 'service_only',
    dueDateRule: { offsetDays: 0 },
  });
  console.log('-- discountScope=service_only 仅服务费5折，每期服务费从200→100 --');
  schC.items.filter(i => i.kind !== 'deposit').forEach(i => {
    console.log(`  第${i.periodIndex}期 物业费=${i.serviceFees[0]?.amount},优惠=${i.discountTotal},本期合计=${i.totalExpected}`);
  });
}

function testCustomDaysRentNotNatural(): void {
  log('测试12: 租金 — 自定义天数30天不要被识别自然整月');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
  };

  const inputCustom: CalculationInput = {
    leaseStartDate: '2026-01-15',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-15', endDate: '2026-02-13' },
    billingPeriodMode: 'custom_days',
    numberOfTenants: 1,
    rules,
  };
  const billCustom = sdk.generateBill(inputCustom);
  const rentCustom = billCustom.feeDetails.find(f => f.type === 'rent');
  console.log(sdk.getFeeBreakdown(billCustom));
  console.log(`\n验证: 30天自定义天数=1整月(按30天),金额=3000`);
  console.log(`  实际租金 = ${rentCustom?.amount}, 说明: ${rentCustom?.description}`);

  const inputNM: CalculationInput = { ...inputCustom, billingPeriodMode: 'natural_month' };
  const billNM = sdk.generateBill(inputNM);
  const rentNM = billNM.feeDetails.find(f => f.type === 'rent');
  console.log(`\n对比: 自然月口径下1月15-2月13日 = 1月17天+2月13天 ≈ 3000/31*17 + 3000/28*13 = ${(3000/31*17 + 3000/28*13).toFixed(2)}`);
  console.log(`  实际租金 = ${rentNM?.amount}, 说明: ${rentNM?.description}`);
}

function testQuarterPeriodMonthlyService(): void {
  log('测试13: 自然季度收款计划内的按月服务费 — 4-6月完整季度直接累计3个月');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
    ],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-04-01',
    leaseEndDate: '2026-09-30',
    moveInDate: '2026-04-01',
    rules,
    billingPeriodMode: 'natural_quarter',
    waterEstimatePerMonth: 50,
    electricityEstimatePerMonth: 100,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  const q2 = schedule.items.find(i => i.kind !== 'deposit' && i.period.startDate === '2026-04-01');
  console.log(`\n验证: Q2(4-6月)物业费 = 200×3 = 600, 实际=${q2?.serviceFees[0]?.amount}`);
  console.log(`验证: Q2(91天)月租金按3个整月=3000×3=9000, 实际=${q2?.rent}`);
}

function testPaymentScheduleFixedDayDue(): void {
  log('测试14: 收款计划 — 每月固定5号收款+提前3天收+中途入住修正');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 9000 },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-15',
    leaseEndDate: '2026-06-30',
    moveInDate: '2026-01-15',
    rules,
    billingPeriodMode: 'natural_month',
    dueDateRule: { offsetDays: 3, fixedDayOfMonth: 5, shiftHoliday: false },
    utilityEstimatePerMonth: 120,
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log(`\n验证: 首期(1月15-31日)应收日不早于入住日1月15日`);
  console.log(`验证: 2月期应收日=1月5日(固定日)？因offsetDays=3默认正数表示上期收`);
}

function testPaymentScheduleWithDiscounts(): void {
  log('测试15: 收款计划 — 含优惠抵扣的完整日历数据');

  const rules: FeeRules = {
    rent: { monthlyAmount: 3000, billingCycle: 'monthly', prorationMethod: 'by_day' },
    deposit: { amount: 6000 },
    services: [{ type: '物业费', amount: 200, cycle: 'monthly' }],
    discounts: [{ type: 'fixed', amount: 150, applyTo: ['rent'], description: '首月优惠' }],
  };

  const schedule = sdk.generatePaymentSchedule({
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-03-31',
    moveInDate: '2026-01-01',
    rules,
    billingPeriodMode: 'natural_month',
    dueDateRule: { offsetDays: 5 },
    waterEstimatePerMonth: 40,
    electricityEstimatePerMonth: 80,
    discountScope: 'first_period',
  });

  console.log(sdk.getPaymentScheduleText(schedule));
  console.log(`\n验证: 押金期独立，首期(1月)含优惠抵扣，水电拆水费预估+电费预估`);
}

function testHolidayShiftDueDate(): void {
  log('测试16: 节假日顺延 — 应收日遇周末顺延至周一');

  const r1 = sdk.computeDueDate('2026-06-01', { offsetDays: 0, shiftHoliday: true }, '2026-06-01', 'regular');
  console.log(`6月1日: 计算应收日 = ${r1} (6/1是周一,不延后)`);

  const r2 = sdk.computeDueDate('2026-06-06', { offsetDays: 0, shiftHoliday: true }, '2026-06-06', 'regular');
  console.log(`6月6日: 计算应收日 = ${r2} (6/6是周六,应顺延至6/8周一)`);

  const r3 = sdk.computeDueDate('2026-06-07', { offsetDays: 0, shiftHoliday: true }, '2026-06-07', 'regular');
  console.log(`6月7日: 计算应收日 = ${r3} (6/7是周日,应顺延至6/8周一)`);

  const r4 = sdk.computeDueDate('2026-06-08', { fixedDayOfMonth: 5, shiftHoliday: true }, '2026-06-01', 'regular');
  console.log(`账期6月8日起,固定5号收 = ${r4} (6月5日周五,不延后)`);

  const r5 = sdk.computeDueDate('2026-03-01', { fixedDayOfMonth: 1, shiftHoliday: true }, '2026-03-01', 'regular');
  console.log(`账期3月1日起,固定1号收 = ${r5} (3月1日是周日,应顺延至3/2周一)`);
}

runAllTests();
