import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decimalToMinorUnits,
  minorUnitsToDecimalString,
  formatCurrency,
  calculateFinanceSummary,
  SUPPORTED_CURRENCIES
} from '../src/finance.js';

test('Finance: Minor units conversion handles 2-decimal currencies accurately', () => {
  assert.equal(decimalToMinorUnits('19.99', 'USD'), 1999);
  assert.equal(decimalToMinorUnits('0.05', 'USD'), 5);
  assert.equal(decimalToMinorUnits('100', 'USD'), 10000);
  assert.equal(decimalToMinorUnits('100.5', 'USD'), 10050);
  assert.equal(decimalToMinorUnits(24.50, 'USD'), 2450);

  // Rejects invalid/zero/negative amounts
  assert.equal(decimalToMinorUnits('0', 'USD'), null);
  assert.equal(decimalToMinorUnits('-5.00', 'USD'), null);
  assert.equal(decimalToMinorUnits('abc', 'USD'), null);
});

test('Finance: Minor units conversion handles 0-decimal currencies (JPY)', () => {
  assert.equal(decimalToMinorUnits('1500', 'JPY'), 1500);
  assert.equal(decimalToMinorUnits('10000', 'JPY'), 10000);
  assert.equal(decimalToMinorUnits(2500, 'JPY'), 2500);
  assert.equal(decimalToMinorUnits('0', 'JPY'), null);
  assert.equal(decimalToMinorUnits('-100', 'JPY'), null);
});

test('Finance: Decimal string roundtrip is exact without floating point drift', () => {
  const testValues = ['0.01', '12.34', '99.99', '1234.56', '50000.00'];
  for (const val of testValues) {
    const minor = decimalToMinorUnits(val, 'USD');
    const str = minorUnitsToDecimalString(minor, 'USD');
    assert.equal(str, val);
  }
});

test('Finance: BDT (Bangladeshi Taka ৳) currency support and formatting', () => {
  assert.ok(SUPPORTED_CURRENCIES.BDT);
  assert.equal(SUPPORTED_CURRENCIES.BDT.code, 'BDT');
  assert.equal(SUPPORTED_CURRENCIES.BDT.symbol, '৳');
  assert.equal(SUPPORTED_CURRENCIES.BDT.decimals, 2);
  assert.equal(decimalToMinorUnits('500.50', 'BDT'), 50050);
  assert.equal(minorUnitsToDecimalString(50050, 'BDT'), '500.50');
  assert.equal(formatCurrency(50050, 'BDT'), '৳500.50');
  assert.equal(formatCurrency(-12000, 'BDT'), '-৳120.00');
});

test('Finance: Zero-decimal currency (JPY) formats without decimal points', () => {
  assert.equal(formatCurrency(1500, 'JPY'), '¥1,500');
  assert.equal(formatCurrency(25000, 'JPY'), '¥25,000');
  assert.equal(formatCurrency(-300, 'JPY'), '-¥300');
});

test('Finance: Summary correctly aggregates income, expenses, categories and budgets', () => {
  const transactions = [
    { id: 'tx1', type: 'income', amount: 500000, date: '2026-10-01', category: 'Salary' }, // $5000.00
    { id: 'tx2', type: 'expense', amount: 12550, date: '2026-10-04', category: 'Groceries' }, // $125.50
    { id: 'tx3', type: 'expense', amount: 7525, date: '2026-10-10', category: 'Dining' }, // $75.25
    { id: 'tx4', type: 'expense', amount: 8000, date: '2026-10-15', category: 'Groceries' }, // $80.00
    { id: 'tx5', type: 'expense', amount: 20000, date: '2026-09-28', category: 'Groceries' } // Previous month!
  ];

  const budgets = [
    { month: '2026-10', limit: 250000 } // $2500.00
  ];

  const summary = calculateFinanceSummary(transactions, '2026-10', budgets, 'USD');
  assert.equal(summary.income, 500000);
  assert.equal(summary.expense, 28075); // 12550 + 7525 + 8000
  assert.equal(summary.net, 471925);
  assert.equal(summary.categoryTotals['Groceries'], 20550);
  assert.equal(summary.categoryTotals['Dining'], 7525);
  assert.equal(summary.budgetLimit, 250000);
  assert.equal(summary.budgetRemaining, 221925);
});
