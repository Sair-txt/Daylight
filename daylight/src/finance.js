/**
 * Daylight — Currency-Aware Finance Calculations
 * Manages minor units (cents, pence, yen) without floating-point errors.
 */

export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', name: 'US Dollar ($)', symbol: '$', decimals: 2, factor: 100 },
  EUR: { code: 'EUR', name: 'Euro (€)', symbol: '€', decimals: 2, factor: 100 },
  GBP: { code: 'GBP', name: 'British Pound (£)', symbol: '£', decimals: 2, factor: 100 },
  JPY: { code: 'JPY', name: 'Japanese Yen (¥)', symbol: '¥', decimals: 0, factor: 1 },
  CAD: { code: 'CAD', name: 'Canadian Dollar (CA$)', symbol: 'CA$', decimals: 2, factor: 100 },
  AUD: { code: 'AUD', name: 'Australian Dollar (A$)', symbol: 'A$', decimals: 2, factor: 100 },
  CHF: { code: 'CHF', name: 'Swiss Franc (CHF)', symbol: 'CHF ', decimals: 2, factor: 100 },
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', decimals: 2, factor: 100 }
};

export function getCurrencyConfig(code = 'USD') {
  return SUPPORTED_CURRENCIES[code] || SUPPORTED_CURRENCIES.USD;
}

/**
 * Converts a decimal string or number (e.g. "12.34" or 12.34) into integer minor units.
 * Parses strings without IEEE 754 precision loss.
 */
export function decimalToMinorUnits(input, currencyCode = 'USD') {
  const config = getCurrencyConfig(currencyCode);
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) return null;
    input = input.toFixed(config.decimals);
  }
  if (typeof input !== 'string') return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  if (config.decimals === 0) {
    // Zero-decimal currencies like JPY
    if (!/^\d+$/.test(trimmed)) return null;
    const val = parseInt(trimmed, 10);
    return val > 0 ? val : null;
  }

  // Currencies with decimals
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) return null;

  const whole = match[1];
  let frac = match[2] || '';
  if (frac.length > config.decimals) {
    frac = frac.slice(0, config.decimals);
  } else {
    frac = frac.padEnd(config.decimals, '0');
  }

  const result = parseInt(whole + frac, 10);
  return result > 0 ? result : null;
}

/**
 * Formats integer minor units to user-facing currency string using Intl.NumberFormat.
 */
export function formatCurrency(minorUnits, currencyCode = 'USD') {
  const config = getCurrencyConfig(currencyCode);
  const units = typeof minorUnits === 'number' && Number.isFinite(minorUnits) ? Math.round(minorUnits) : 0;
  const major = units / config.factor;

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: config.code,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals
    }).format(major);
  } catch {
    // Fallback if Intl.NumberFormat does not support currency code
    return `${config.symbol}${major.toFixed(config.decimals)}`;
  }
}

export function minorUnitsToDecimalString(minorUnits, currencyCode = 'USD') {
  const config = getCurrencyConfig(currencyCode);
  const units = typeof minorUnits === 'number' ? Math.round(minorUnits) : 0;
  return (units / config.factor).toFixed(config.decimals);
}

export function calculateFinanceSummary(transactions = [], monthStr = '', budgets = [], currencyCode = 'USD') {
  let income = 0;
  let expense = 0;
  const categoryTotals = {};

  for (const tx of transactions) {
    if (tx.date && tx.date.startsWith(monthStr)) {
      if (tx.type === 'income') {
        income += tx.amount;
      } else if (tx.type === 'expense') {
        expense += tx.amount;
        const cat = tx.category || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + tx.amount;
      }
    }
  }

  const net = income - expense;
  const budgetObj = budgets.find(b => b.month === monthStr);
  const budgetLimit = budgetObj && typeof budgetObj.limit === 'number' ? budgetObj.limit : null;
  const budgetRemaining = budgetLimit !== null ? budgetLimit - expense : null;

  return {
    income,
    expense,
    net,
    categoryTotals,
    budgetLimit,
    budgetRemaining
  };
}
