import { RentalFeeSDK, CalculationInput, FeeRules, Tenant } from '../src';

const sdk = new RentalFeeSDK({
  roundingMode: 'round',
  precision: 2,
  splitMode: 'average',
});

function log(title: string, data?: any): void {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  if (data !== undefined) {
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

function testBasicRentCalculation(): void {
  log('测试1: 整月租金计算');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getBillSummary(bill));
  console.log(sdk.getFeeBreakdown(bill));
  console.log(`验证：租金应为 3000 元，实际 ${bill.feeDetails[0].amount} 元`);
}

function testPartialMonthRent(): void {
  log('测试2: 非整月租金计算（入住中途）');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getBillSummary(bill));
  console.log(sdk.getFeeBreakdown(bill));
  console.log(`1月有31天，入住17天(15日到31日)，租金 = 3000 / 31 * 17 ≈ ${(3000 / 31 * 17).toFixed(2)} 元`);
  console.log(`实际租金: ${bill.feeDetails[0].amount} 元`);
}

function testUtilityWithTiers(): void {
  log('测试3: 阶梯水电费计算');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    water: {
      tiers: [
        { minUsage: 0, maxUsage: 10, pricePerUnit: 3.5 },
        { minUsage: 10, maxUsage: 30, pricePerUnit: 5.0 },
        { minUsage: 30, pricePerUnit: 8.0 },
      ],
      baseFee: 10,
    },
    electricity: {
      tiers: [
        { minUsage: 0, maxUsage: 200, pricePerUnit: 0.5 },
        { minUsage: 200, maxUsage: 400, pricePerUnit: 0.8 },
        { minUsage: 400, pricePerUnit: 1.2 },
      ],
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    meterReadings: {
      water: { previous: 100, current: 135 },
      electricity: { previous: 500, current: 850 },
    },
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const waterUsage = 135 - 100;
  const elecUsage = 850 - 500;
  console.log(`\n水费验证：用水${waterUsage}吨`);
  console.log(`  第一阶梯10吨: 10 * 3.5 = 35`);
  console.log(`  第二阶梯20吨: 20 * 5.0 = 100`);
  console.log(`  第三阶梯5吨: 5 * 8.0 = 40`);
  console.log(`  基础费: 10`);
  console.log(`  合计: 35 + 100 + 40 + 10 = 185 元`);

  console.log(`\n电费验证：用电${elecUsage}度`);
  console.log(`  第一阶梯200度: 200 * 0.5 = 100`);
  console.log(`  第二阶梯200度: 200 * 0.8 = 160`);
  console.log(`  第三阶梯0度`);
  console.log(`  合计: 100 + 160 = 260 元`);
}

function testServiceFees(): void {
  log('测试4: 固定服务费计算');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    services: [
      { type: '物业费', amount: 200, cycle: 'monthly' },
      { type: '网络费', amount: 50, cycle: 'monthly' },
      { type: '清洁费', amount: 30, cycle: 'one_time' },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  console.log('\n总金额应包含：租金3000 + 物业费200 + 网络费50 + 清洁费30 = 3280元');
  console.log(`实际总金额: ${bill.summary.totalAmount} 元`);
}

function testPenaltyAndLateFee(): void {
  log('测试5: 违约金与滞纳金计算');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    penalty: {
      enabled: true,
      percentage: 10,
      minAmount: 100,
    },
    lateFee: {
      enabled: true,
      dailyRate: 0.05,
      graceDays: 3,
      minAmount: 10,
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
    paymentDueDate: '2026-02-05',
    actualPaymentDate: '2026-02-15',
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));

  const lateDays = 15 - 5 - 3;
  console.log(`\n验证：`);
  console.log(`  违约金: 3000 * 10% = 300元`);
  console.log(`  逾期天数: 15日 - 5日 - 3天宽限 = ${lateDays}天`);
  console.log(`  滞纳金: 3000 * 0.05% * ${lateDays}天 = ${(3000 * 0.0005 * lateDays).toFixed(2)}元`);
}

function testDiscounts(): void {
  log('测试6: 优惠减免计算');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    water: {
      tiers: [{ minUsage: 0, pricePerUnit: 3.5 }],
    },
    discounts: [
      {
        type: 'percentage',
        amount: 10,
        applyTo: ['rent'],
        description: '新租客首月租金9折优惠',
      },
      {
        type: 'fixed',
        amount: 50,
        applyTo: ['water', 'electricity', 'gas'],
        description: '水电燃气减免',
      },
    ],
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    meterReadings: {
      water: { previous: 0, current: 20 },
    },
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  console.log(`\n验证：`);
  console.log(`  租金优惠: 3000 * 10% = 300元`);
  console.log(`  水费: 20 * 3.5 = 70元，减免50元，实收20元`);
}

function testDeposit(): void {
  log('测试7: 押金冻结与退还');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
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
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };

  const bill = sdk.generateBill(input);
  console.log(sdk.getFeeBreakdown(bill));
  console.log(sdk.getRefundSuggestion(bill));
  console.log(`\n验证：押金6000 - 墙面修复500 - 门锁更换200 = 应退5300元`);
}

function testMultiTenantSplit(): void {
  log('测试8: 多人合租平均分摊');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 6000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    water: {
      tiers: [{ minUsage: 0, pricePerUnit: 3.5 }],
    },
    services: [
      { type: '物业费', amount: 300, cycle: 'monthly' },
    ],
  };

  const tenants: Tenant[] = [
    { id: 'T001', name: '张三' },
    { id: 'T002', name: '李四' },
    { id: 'T003', name: '王五' },
  ];

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 3,
    tenants,
    meterReadings: {
      water: { previous: 0, current: 30 },
    },
    rules,
  };

  const bill = sdk.generateBill(input, 'average');
  console.log(sdk.getSplitExplanation(bill));
  console.log(`\n总租金6000 + 水费105 + 物业费300 = 6405元`);
  console.log(`3人平均分摊: 6405 / 3 = 2135元/人`);
}

function testRatioSplit(): void {
  log('测试9: 按比例分摊');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 5000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
  };

  const tenants: Tenant[] = [
    { id: 'T001', name: '张三（主卧）', shareRatio: 50 },
    { id: 'T002', name: '李四（次卧）', shareRatio: 30 },
    { id: 'T003', name: '王五（小卧）', shareRatio: 20 },
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
  console.log(`\n按50%/30%/20%分摊5000元租金：`);
  console.log(`  张三: 5000 * 50% = 2500元`);
  console.log(`  李四: 5000 * 30% = 1500元`);
  console.log(`  王五: 5000 * 20% = 1000元`);
}

function testValidation(): void {
  log('测试10: 规则校验');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: -100,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-12-31',
    leaseEndDate: '2026-01-01',
    moveInDate: '2026-02-01',
    billingPeriod: { startDate: '2026-02-01', endDate: '2026-01-01' },
    numberOfTenants: 0,
    meterReadings: {
      water: { previous: 100, current: 50 },
    },
    rules,
  };

  const validation = sdk.validate(input);
  console.log('校验结果:', JSON.stringify(validation, null, 2));
  console.log(`\n预期发现的错误：`);
  console.log(`  1. 账期开始日期不能晚于结束日期`);
  console.log(`  2. 租约开始日期不能晚于结束日期`);
  console.log(`  3. 月租金金额必须大于0`);
  console.log(`  4. 入住人数必须大于0`);
  console.log(`  5. 水表当前抄数不能小于上次抄数`);
}

function testBillComparison(): void {
  log('测试11: 历史账单对比');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
    water: {
      tiers: [{ minUsage: 0, pricePerUnit: 3.5 }],
    },
  };

  const janInput: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-01',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    meterReadings: { water: { previous: 0, current: 10 } },
    rules,
  };

  const febInput: CalculationInput = {
    ...janInput,
    billingPeriod: { startDate: '2026-02-01', endDate: '2026-02-28' },
    meterReadings: { water: { previous: 10, current: 40 } },
    rules: {
      ...rules,
      discounts: [
        { type: 'fixed', amount: 100, applyTo: ['rent'], description: '春节优惠' },
      ],
    },
  };

  const janBill = sdk.generateBill(janInput);
  const febBill = sdk.generateBill(febInput);

  const comparison = sdk.compareBills({
    currentBill: febBill,
    previousBill: janBill,
  });

  console.log('1月账单总额:', janBill.summary.totalAmount, '(租金3000 + 水费35 = 3035)');
  console.log('2月账单总额:', febBill.summary.totalAmount, '(租金3000 - 优惠100 + 水费105 = 3005)');
  console.log('\n对比结果:', JSON.stringify(comparison, null, 2));
}

function testRoundingModes(): void {
  log('测试12: 不同四舍五入方式');

  const rules: FeeRules = {
    rent: {
      monthlyAmount: 3000,
      billingCycle: 'monthly',
      prorationMethod: 'by_day',
    },
  };

  const input: CalculationInput = {
    leaseStartDate: '2026-01-01',
    leaseEndDate: '2026-12-31',
    moveInDate: '2026-01-15',
    billingPeriod: { startDate: '2026-01-01', endDate: '2026-01-31' },
    numberOfTenants: 1,
    rules,
  };

  const sdkRound = new RentalFeeSDK({ roundingMode: 'round' });
  const sdkFloor = new RentalFeeSDK({ roundingMode: 'floor' });
  const sdkCeil = new RentalFeeSDK({ roundingMode: 'ceil' });

  const billRound = sdkRound.generateBill(input);
  const billFloor = sdkFloor.generateBill(input);
  const billCeil = sdkCeil.generateBill(input);

  const dailyRate = 3000 / 31;
  const exact = dailyRate * 17;

  console.log(`日租金精确值: 3000 / 31 = ${dailyRate}`);
  console.log(`17天租金精确值: ${exact}`);
  console.log(`\n四舍五入(round): ${billRound.feeDetails[0].amount} 元`);
  console.log(`向下取整(floor): ${billFloor.feeDetails[0].amount} 元`);
  console.log(`向上取整(ceil):  ${billCeil.feeDetails[0].amount} 元`);
}

function runAllTests(): void {
  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '租房费用计算 SDK 综合测试'.padStart(37).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60));

  testBasicRentCalculation();
  testPartialMonthRent();
  testUtilityWithTiers();
  testServiceFees();
  testPenaltyAndLateFee();
  testDiscounts();
  testDeposit();
  testMultiTenantSplit();
  testRatioSplit();
  testValidation();
  testBillComparison();
  testRoundingModes();

  console.log('\n' + '█'.repeat(60));
  console.log('█'.padEnd(58) + '█');
  console.log('█' + '所有测试执行完成！'.padStart(35).padEnd(58) + '█');
  console.log('█'.padEnd(58) + '█');
  console.log('█'.repeat(60) + '\n');
}

runAllTests();
