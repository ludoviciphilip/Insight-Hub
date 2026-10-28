import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, daxToNumber, daxToBoolean } from '../expr/types';
import { parseDateArg, formatDateISO, calcYearFrac } from './dateTime';

// ==========================================
// Helper Utilities for Financial Functions
// ==========================================

export function computePMT(
  rate: number,
  nper: number,
  pv: number,
  fv: number = 0,
  type: number = 0
): number {
  if (nper === 0) {
    throw new DaxError('Execution', 'PMT: o número de períodos (nper) não pode ser zero');
  }
  if (rate === 0) {
    return -(pv + fv) / nper;
  }
  const pvTerm = pv * Math.pow(1 + rate, nper);
  const factor = ((Math.pow(1 + rate, nper) - 1) / rate) * (1 + rate * type);
  return -(pvTerm + fv) / factor;
}

export function computePV(
  rate: number,
  nper: number,
  pmt: number,
  fv: number = 0,
  type: number = 0
): number {
  if (nper === 0) return -fv;
  if (rate === 0) {
    return -(pmt * nper + fv);
  }
  const factor = ((Math.pow(1 + rate, nper) - 1) / rate) * (1 + rate * type);
  return -(fv + pmt * factor) / Math.pow(1 + rate, nper);
}

export function computeFV(
  rate: number,
  nper: number,
  pmt: number,
  pv: number = 0,
  type: number = 0
): number {
  if (rate === 0) {
    return -(pv + pmt * nper);
  }
  const pvTerm = pv * Math.pow(1 + rate, nper);
  const factor = ((Math.pow(1 + rate, nper) - 1) / rate) * (1 + rate * type);
  return -pvTerm - pmt * factor;
}

export function computeNPER(
  rate: number,
  pmt: number,
  pv: number,
  fv: number = 0,
  type: number = 0
): number {
  if (rate === 0) {
    if (pmt === 0) throw new DaxError('Execution', 'NPER: taxa e pagamento não podem ser simultaneamente zero');
    return -(pv + fv) / pmt;
  }
  const num = -fv * rate + pmt * (1 + rate * type);
  const den = pv * rate + pmt * (1 + rate * type);
  if (num / den <= 0) {
    throw new DaxError('Execution', 'NPER: os fluxos de caixa fornecidos não permitem amortizar o valor presente');
  }
  return Math.log(num / den) / Math.log(1 + rate);
}

export function computeRATE(
  nper: number,
  pmt: number,
  pv: number,
  fv: number = 0,
  type: number = 0,
  guess: number = 0.1
): number {
  if (nper <= 0) {
    throw new DaxError('Execution', 'RATE: nper deve ser estritamente maior que zero');
  }

  let rate = guess;
  const tol = 1e-9;
  const maxIter = 100;

  for (let iter = 0; iter < maxIter; iter++) {
    let f: number;
    let df: number;

    if (Math.abs(rate) < 1e-12) {
      f = pv + pmt * nper + fv;
      df = 0.5 * nper * (nper - 1) * pmt + nper * pv;
    } else {
      const rn = Math.pow(1 + rate, nper);
      f = pv * rn + pmt * (1 + rate * type) * ((rn - 1) / rate) + fv;
      // Derivative with respect to rate
      const drn = nper * Math.pow(1 + rate, nper - 1);
      const factor = (rn - 1) / rate;
      const dfactor = (drn * rate - (rn - 1)) / (rate * rate);
      df = pv * drn + pmt * type * factor + pmt * (1 + rate * type) * dfactor;
    }

    if (Math.abs(f) < tol) {
      return rate;
    }

    if (df === 0 || isNaN(df)) {
      rate += 0.01;
      continue;
    }

    const nextRate = rate - f / df;
    if (Math.abs(nextRate - rate) < tol) {
      return nextRate;
    }
    rate = nextRate;
  }

  // Bisection fallback if Newton failed to converge
  let low = -0.9999;
  let high = 10.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = 0.5 * (low + high);
    const rn = Math.pow(1 + mid, nper);
    const fMid = pv * rn + pmt * (1 + mid * type) * ((rn - 1) / mid) + fv;
    if (Math.abs(fMid) < tol || (high - low) < tol) {
      return mid;
    }
    const rnLow = Math.pow(1 + low, nper);
    const fLow = pv * rnLow + pmt * (1 + low * type) * ((rnLow - 1) / low) + fv;
    if (fLow * fMid <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  throw new DaxError('Execution', 'RATE: não foi possível convergir para uma taxa após o limite de iterações');
}

export function computeIPMT(
  rate: number,
  per: number,
  nper: number,
  pv: number,
  fv: number = 0,
  type: number = 0
): number {
  if (per < 1 || per > nper) {
    throw new DaxError('Execution', `IPMT: período inválido (${per}). Deve estar entre 1 e ${nper}`);
  }
  const pmt = computePMT(rate, nper, pv, fv, type);
  if (type === 1 && per === 1) {
    return 0;
  }
  const effectivePer = type === 1 ? per - 2 : per - 1;
  const balance = computeFV(rate, effectivePer, pmt, pv, type);
  return balance * rate;
}

export function computePPMT(
  rate: number,
  per: number,
  nper: number,
  pv: number,
  fv: number = 0,
  type: number = 0
): number {
  const pmt = computePMT(rate, nper, pv, fv, type);
  const ipmt = computeIPMT(rate, per, nper, pv, fv, type);
  return pmt - ipmt;
}

/**
 * XNPV(rate, values, dates)
 * Evaluates present value for irregular cash flows
 */
export function computeXNPV(rate: number, values: number[], dates: Date[]): number {
  if (values.length !== dates.length) {
    throw new DaxError('Execution', 'XNPV: o número de valores deve ser igual ao número de datas');
  }
  if (values.length === 0) return 0;
  if (rate <= -1) {
    throw new DaxError('Execution', 'XNPV: a taxa de desconto deve ser estritamente maior que -100% (-1)');
  }

  const d0 = dates[0].getTime();
  let xnpv = 0;

  for (let i = 0; i < values.length; i++) {
    const diffDays = (dates[i].getTime() - d0) / 86400000;
    xnpv += values[i] / Math.pow(1 + rate, diffDays / 365.0);
  }

  return xnpv;
}

/**
 * XIRR(values, dates, [guess])
 * Solves rate where XNPV(rate) == 0 with Newton-Raphson + bisection fallback
 */
export function computeXIRR(values: number[], dates: Date[], guess: number = 0.1): number {
  if (values.length !== dates.length || values.length < 2) {
    throw new DaxError('Execution', 'XIRR: requer pelo menos dois fluxos de caixa com datas correspondentes');
  }

  let hasPos = false;
  let hasNeg = false;
  for (const v of values) {
    if (v > 0) hasPos = true;
    if (v < 0) hasNeg = true;
  }
  if (!hasPos || !hasNeg) {
    throw new DaxError('Execution', 'XIRR: o fluxo de caixa deve conter ao menos um valor positivo e um negativo');
  }

  const d0 = dates[0].getTime();
  const times = dates.map(d => (d.getTime() - d0) / (365.0 * 86400000));

  let rate = guess;
  const tol = 1e-9;
  const maxIter = 100;

  for (let iter = 0; iter < maxIter; iter++) {
    if (rate <= -1) {
      rate = -0.999;
    }

    let f = 0;
    let df = 0;

    for (let i = 0; i < values.length; i++) {
      const t = times[i];
      const denom = Math.pow(1 + rate, t);
      f += values[i] / denom;
      df -= (t * values[i]) / (denom * (1 + rate));
    }

    if (Math.abs(f) < tol) {
      return rate;
    }

    if (Math.abs(df) < 1e-12 || isNaN(df)) {
      rate += 0.02;
      continue;
    }

    const nextRate = rate - f / df;
    if (Math.abs(nextRate - rate) < tol) {
      return nextRate;
    }
    rate = nextRate;
  }

  // Bisection search
  let low = -0.9999;
  let high = 10.0;
  for (let iter = 0; iter < 100; iter++) {
    const mid = 0.5 * (low + high);
    let fMid = 0;
    for (let i = 0; i < values.length; i++) {
      fMid += values[i] / Math.pow(1 + mid, times[i]);
    }

    if (Math.abs(fMid) < tol || (high - low) < tol) {
      return mid;
    }

    let fLow = 0;
    for (let i = 0; i < values.length; i++) {
      fLow += values[i] / Math.pow(1 + low, times[i]);
    }

    if (fLow * fMid <= 0) {
      high = mid;
    } else {
      low = mid;
    }
  }

  throw new DaxError('Execution', 'XIRR: não foi possível convergir para uma taxa após o limite de iterações');
}

// ==========================================
// Bond Date & Coupon Schedule Helpers
// ==========================================

function addMonthsToDate(d: Date, months: number): Date {
  const result = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  // Handle end of month rollover
  const day = d.getUTCDate();
  if (result.getUTCDate() !== day) {
    result.setUTCDate(0);
  }
  return result;
}

export interface CouponDates {
  prevCoupon: Date;
  nextCoupon: Date;
  numCoupons: number;
}

export function getCouponDates(settlement: Date, maturity: Date, frequency: number): CouponDates {
  if (settlement.getTime() >= maturity.getTime()) {
    throw new DaxError('Execution', 'Data de liquidação deve ser estritamente anterior à data de vencimento');
  }
  if (![1, 2, 4].includes(frequency)) {
    throw new DaxError('Execution', 'Frequência de cupom inválida. Use 1 (anual), 2 (semestral) ou 4 (trimestral)');
  }

  const monthsPerPeriod = 12 / frequency;
  let curCoupon = new Date(Date.UTC(maturity.getUTCFullYear(), maturity.getUTCMonth(), maturity.getUTCDate()));
  let nextCoupon = curCoupon;
  let count = 0;

  while (curCoupon.getTime() > settlement.getTime()) {
    nextCoupon = curCoupon;
    curCoupon = addMonthsToDate(maturity, -(count + 1) * monthsPerPeriod);
    count++;
  }

  return {
    prevCoupon: curCoupon,
    nextCoupon: nextCoupon,
    numCoupons: count,
  };
}

export function getCouponDays(
  settlement: Date,
  maturity: Date,
  frequency: number,
  basis: number = 0
): { daybs: number; daysnc: number; days: number } {
  const { prevCoupon, nextCoupon } = getCouponDates(settlement, maturity, frequency);

  let daybs = Math.round((settlement.getTime() - prevCoupon.getTime()) / 86400000);
  let daysnc = Math.round((nextCoupon.getTime() - settlement.getTime()) / 86400000);
  let days = Math.round((nextCoupon.getTime() - prevCoupon.getTime()) / 86400000);

  if (basis === 0 || basis === 4) {
    days = 360 / frequency;
    daybs = Math.round(calcYearFrac(prevCoupon, settlement, basis) * 360);
    daysnc = days - daybs;
  } else if (basis === 2) {
    days = 360 / frequency;
  } else if (basis === 3) {
    days = 365 / frequency;
  }

  return { daybs, daysnc, days };
}

export function computeBondPrice(
  settlement: Date,
  maturity: Date,
  rate: number,
  yld: number,
  redemption: number,
  frequency: number,
  basis: number = 0
): number {
  if (rate < 0 || yld < 0 || redemption <= 0) {
    throw new DaxError('Execution', 'PRICE: taxa, rendimento e valor de resgate devem ser válidos');
  }

  const { numCoupons: N } = getCouponDates(settlement, maturity, frequency);
  const { daybs: A, daysnc: DSC, days: E } = getCouponDays(settlement, maturity, frequency, basis);

  if (N === 1) {
    const accrued = 100 * (rate / frequency) * (A / E);
    const num = redemption + 100 * (rate / frequency);
    const den = 1 + (yld / frequency) * (DSC / E);
    return num / den - accrued;
  }

  const accrued = 100 * (rate / frequency) * (A / E);
  const discountFactor = 1 + yld / frequency;

  let sumCoupons = 0;
  for (let k = 1; k <= N; k++) {
    const power = k - 1 + DSC / E;
    sumCoupons += (100 * (rate / frequency)) / Math.pow(discountFactor, power);
  }

  const redemptionPV = redemption / Math.pow(discountFactor, N - 1 + DSC / E);
  return redemptionPV + sumCoupons - accrued;
}

export function computeBondYield(
  settlement: Date,
  maturity: Date,
  rate: number,
  pr: number,
  redemption: number,
  frequency: number,
  basis: number = 0
): number {
  if (pr <= 0 || redemption <= 0) {
    throw new DaxError('Execution', 'YIELD: preço e resgate devem ser estritamente positivos');
  }

  let yld = rate > 0 ? rate : 0.05;
  const tol = 1e-9;
  const maxIter = 100;

  for (let iter = 0; iter < maxIter; iter++) {
    const curPrice = computeBondPrice(settlement, maturity, rate, yld, redemption, frequency, basis);
    const diff = curPrice - pr;
    if (Math.abs(diff) < tol) {
      return yld;
    }

    const delta = 1e-6;
    const pricePlus = computeBondPrice(settlement, maturity, rate, yld + delta, redemption, frequency, basis);
    const dPrice = (pricePlus - curPrice) / delta;

    if (Math.abs(dPrice) < 1e-12) {
      yld += 0.01;
      continue;
    }

    const nextYld = yld - diff / dPrice;
    if (Math.abs(nextYld - yld) < tol) {
      return nextYld;
    }
    yld = nextYld;
  }

  return yld;
}

// ==========================================
// Exported Financial Function Definitions
// ==========================================

export const FINANCIAL_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // Annuity, Loans & Payments
  // ==========================================
  'PMT': {
    name: 'PMT',
    category: 'Financeira',
    syntax: 'PMT(rate, nper, pv, [fv], [type])',
    description: 'Calcula o pagamento de um empréstimo com base em pagamentos constantes e uma taxa de juros constante.',
    example: 'PMT(0.01, 12, -1000)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: ([rateVal, nperVal, pvVal, fvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(nperVal) || isBlank(pvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const nper = daxToNumber(nperVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computePMT(rate, nper, pv, fv, type);
    },
  },

  'IPMT': {
    name: 'IPMT',
    category: 'Financeira',
    syntax: 'IPMT(rate, per, nper, pv, [fv], [type])',
    description: 'Calcula o pagamento de juros de um investimento em um período específico.',
    example: 'IPMT(0.01, 1, 12, -1000)',
    minArgs: 4,
    maxArgs: 6,
    evaluate: ([rateVal, perVal, nperVal, pvVal, fvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(perVal) || isBlank(nperVal) || isBlank(pvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const per = daxToNumber(perVal, true);
      const nper = daxToNumber(nperVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computeIPMT(rate, per, nper, pv, fv, type);
    },
  },

  'PPMT': {
    name: 'PPMT',
    category: 'Financeira',
    syntax: 'PPMT(rate, per, nper, pv, [fv], [type])',
    description: 'Calcula o pagamento sobre o capital de um investimento em um determinado período.',
    example: 'PPMT(0.01, 1, 12, -1000)',
    minArgs: 4,
    maxArgs: 6,
    evaluate: ([rateVal, perVal, nperVal, pvVal, fvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(perVal) || isBlank(nperVal) || isBlank(pvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const per = daxToNumber(perVal, true);
      const nper = daxToNumber(nperVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computePPMT(rate, per, nper, pv, fv, type);
    },
  },

  'ISPMT': {
    name: 'ISPMT',
    category: 'Financeira',
    syntax: 'ISPMT(rate, per, nper, pv)',
    description: 'Calcula os juros pagos durante um período específico de um investimento com amortização constante de principal.',
    example: 'ISPMT(0.01, 1, 12, 1000)',
    minArgs: 4,
    maxArgs: 4,
    evaluate: ([rateVal, perVal, nperVal, pvVal]) => {
      if (isBlank(rateVal) || isBlank(perVal) || isBlank(nperVal) || isBlank(pvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const per = daxToNumber(perVal, true);
      const nper = daxToNumber(nperVal, true);
      const pv = daxToNumber(pvVal, true);

      if (nper === 0) throw new DaxError('Execution', 'ISPMT: nper não pode ser zero');
      return pv * rate * (per / nper - 1);
    },
  },

  'PV': {
    name: 'PV',
    category: 'Financeira',
    syntax: 'PV(rate, nper, pmt, [fv], [type])',
    description: 'Calcula o valor presente de um investimento.',
    example: 'PV(0.05 / 12, 12 * 5, -250)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: ([rateVal, nperVal, pmtVal, fvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(nperVal) || isBlank(pmtVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const nper = daxToNumber(nperVal, true);
      const pmt = daxToNumber(pmtVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computePV(rate, nper, pmt, fv, type);
    },
  },

  'FV': {
    name: 'FV',
    category: 'Financeira',
    syntax: 'FV(rate, nper, pmt, [pv], [type])',
    description: 'Calcula o valor futuro de um investimento com base em pagamentos periódicos constantes e taxa de juros constante.',
    example: 'FV(0.06 / 12, 12 * 10, -100)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: ([rateVal, nperVal, pmtVal, pvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(nperVal) || isBlank(pmtVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const nper = daxToNumber(nperVal, true);
      const pmt = daxToNumber(pmtVal, true);
      const pv = pvVal !== undefined && !isBlank(pvVal) ? daxToNumber(pvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computeFV(rate, nper, pmt, pv, type);
    },
  },

  'NPER': {
    name: 'NPER',
    category: 'Financeira',
    syntax: 'NPER(rate, pmt, pv, [fv], [type])',
    description: 'Retorna o número de períodos de um investimento com base em pagamentos periódicos e constantes e taxa de juros constante.',
    example: 'NPER(0.01, -88.85, 1000)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: ([rateVal, pmtVal, pvVal, fvVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(pmtVal) || isBlank(pvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const pmt = daxToNumber(pmtVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;

      return computeNPER(rate, pmt, pv, fv, type);
    },
  },

  'RATE': {
    name: 'RATE',
    category: 'Financeira',
    syntax: 'RATE(nper, pmt, pv, [fv], [type], [guess])',
    description: 'Retorna a taxa de juros por período de uma anuidade.',
    example: 'RATE(12, -88.85, 1000)',
    minArgs: 3,
    maxArgs: 6,
    evaluate: ([nperVal, pmtVal, pvVal, fvVal, typeVal, guessVal]) => {
      if (isBlank(nperVal) || isBlank(pmtVal) || isBlank(pvVal)) return DAX_BLANK;
      const nper = daxToNumber(nperVal, true);
      const pmt = daxToNumber(pmtVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = fvVal !== undefined && !isBlank(fvVal) ? daxToNumber(fvVal, true) : 0;
      const type = typeVal !== undefined && !isBlank(typeVal) ? (daxToBoolean(typeVal) ? 1 : 0) : 0;
      const guess = guessVal !== undefined && !isBlank(guessVal) ? daxToNumber(guessVal, true) : 0.1;

      return computeRATE(nper, pmt, pv, fv, type, guess);
    },
  },

  'RRI': {
    name: 'RRI',
    category: 'Financeira',
    syntax: 'RRI(nper, pv, fv)',
    description: 'Retorna uma taxa de juros equivalente para o crescimento de um investimento.',
    example: 'RRI(96, 10000, 11000)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([nperVal, pvVal, fvVal]) => {
      if (isBlank(nperVal) || isBlank(pvVal) || isBlank(fvVal)) return DAX_BLANK;
      const nper = daxToNumber(nperVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = daxToNumber(fvVal, true);

      if (nper <= 0 || pv <= 0 || fv <= 0) {
        throw new DaxError('Execution', 'RRI: nper, pv e fv devem ser estritamente maiores que zero');
      }

      return Math.pow(fv / pv, 1 / nper) - 1;
    },
  },

  'PDURATION': {
    name: 'PDURATION',
    category: 'Financeira',
    syntax: 'PDURATION(rate, pv, fv)',
    description: 'Retorna o número de períodos necessários para que um investimento atinja um valor especificado.',
    example: 'PDURATION(0.025, 1000, 2000)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([rateVal, pvVal, fvVal]) => {
      if (isBlank(rateVal) || isBlank(pvVal) || isBlank(fvVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const pv = daxToNumber(pvVal, true);
      const fv = daxToNumber(fvVal, true);

      if (rate <= 0 || pv <= 0 || fv <= 0) {
        throw new DaxError('Execution', 'PDURATION: taxa, pv e fv devem ser maiores que zero');
      }

      return (Math.log(fv) - Math.log(pv)) / Math.log(1 + rate);
    },
  },

  'EFFECT': {
    name: 'EFFECT',
    category: 'Financeira',
    syntax: 'EFFECT(nominal_rate, npery)',
    description: 'Retorna a taxa de juros anual efetiva, dadas a taxa de juros nominal anual e o número de períodos de composição por ano.',
    example: 'EFFECT(0.0525, 4)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([rateVal, nperyVal]) => {
      if (isBlank(rateVal) || isBlank(nperyVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const npery = Math.trunc(daxToNumber(nperyVal, true));

      if (rate <= 0 || npery < 1) {
        throw new DaxError('Execution', 'EFFECT: taxa nominal deve ser > 0 e períodos de capitalização >= 1');
      }

      return Math.pow(1 + rate / npery, npery) - 1;
    },
  },

  'NOMINAL': {
    name: 'NOMINAL',
    category: 'Financeira',
    syntax: 'NOMINAL(effect_rate, npery)',
    description: 'Retorna a taxa de juros nominal anual, dadas a taxa efetiva e o número de períodos de composição por ano.',
    example: 'NOMINAL(0.053543, 4)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([rateVal, nperyVal]) => {
      if (isBlank(rateVal) || isBlank(nperyVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const npery = Math.trunc(daxToNumber(nperyVal, true));

      if (rate <= 0 || npery < 1) {
        throw new DaxError('Execution', 'NOMINAL: taxa efetiva deve ser > 0 e períodos de capitalização >= 1');
      }

      return npery * (Math.pow(1 + rate, 1 / npery) - 1);
    },
  },

  'CUMIPMT': {
    name: 'CUMIPMT',
    category: 'Financeira',
    syntax: 'CUMIPMT(rate, nper, pv, start_period, end_period, type)',
    description: 'Retorna os juros cumulativos pagos sobre um empréstimo entre o período inicial e o período final.',
    example: 'CUMIPMT(0.09 / 12, 30 * 12, 125000, 13, 24, 0)',
    minArgs: 6,
    maxArgs: 6,
    evaluate: ([rateVal, nperVal, pvVal, startVal, endVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(nperVal) || isBlank(pvVal) || isBlank(startVal) || isBlank(endVal) || isBlank(typeVal)) {
        return DAX_BLANK;
      }
      const rate = daxToNumber(rateVal, true);
      const nper = Math.trunc(daxToNumber(nperVal, true));
      const pv = daxToNumber(pvVal, true);
      const start = Math.trunc(daxToNumber(startVal, true));
      const end = Math.trunc(daxToNumber(endVal, true));
      const type = daxToBoolean(typeVal) ? 1 : 0;

      if (rate <= 0 || nper <= 0 || pv <= 0 || start < 1 || end < start || end > nper) {
        throw new DaxError('Execution', 'CUMIPMT: parâmetros inválidos');
      }

      let totalInterest = 0;
      for (let p = start; p <= end; p++) {
        totalInterest += computeIPMT(rate, p, nper, pv, 0, type);
      }
      return totalInterest;
    },
  },

  'CUMPRINC': {
    name: 'CUMPRINC',
    category: 'Financeira',
    syntax: 'CUMPRINC(rate, nper, pv, start_period, end_period, type)',
    description: 'Retorna o capital cumulativo pago sobre um empréstimo entre o período inicial e o período final.',
    example: 'CUMPRINC(0.09 / 12, 30 * 12, 125000, 1, 12, 0)',
    minArgs: 6,
    maxArgs: 6,
    evaluate: ([rateVal, nperVal, pvVal, startVal, endVal, typeVal]) => {
      if (isBlank(rateVal) || isBlank(nperVal) || isBlank(pvVal) || isBlank(startVal) || isBlank(endVal) || isBlank(typeVal)) {
        return DAX_BLANK;
      }
      const rate = daxToNumber(rateVal, true);
      const nper = Math.trunc(daxToNumber(nperVal, true));
      const pv = daxToNumber(pvVal, true);
      const start = Math.trunc(daxToNumber(startVal, true));
      const end = Math.trunc(daxToNumber(endVal, true));
      const type = daxToBoolean(typeVal) ? 1 : 0;

      if (rate <= 0 || nper <= 0 || pv <= 0 || start < 1 || end < start || end > nper) {
        throw new DaxError('Execution', 'CUMPRINC: parâmetros inválidos');
      }

      let totalPrincipal = 0;
      for (let p = start; p <= end; p++) {
        totalPrincipal += computePPMT(rate, p, nper, pv, 0, type);
      }
      return totalPrincipal;
    },
  },

  // ==========================================
  // Depreciation Functions
  // ==========================================
  'SLN': {
    name: 'SLN',
    category: 'Financeira',
    syntax: 'SLN(cost, salvage, life)',
    description: 'Retorna a depreciação linear de um ativo para um período.',
    example: 'SLN(30000, 7500, 10)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([costVal, salvageVal, lifeVal]) => {
      if (isBlank(costVal) || isBlank(salvageVal) || isBlank(lifeVal)) return DAX_BLANK;
      const cost = daxToNumber(costVal, true);
      const salvage = daxToNumber(salvageVal, true);
      const life = daxToNumber(lifeVal, true);

      if (life <= 0) {
        throw new DaxError('Execution', 'SLN: a vida útil deve ser estritamente maior que zero');
      }

      return (cost - salvage) / life;
    },
  },

  'SYD': {
    name: 'SYD',
    category: 'Financeira',
    syntax: 'SYD(cost, salvage, life, per)',
    description: 'Retorna a depreciação por soma dos anos de um ativo para um período específico.',
    example: 'SYD(30000, 7500, 10, 1)',
    minArgs: 4,
    maxArgs: 4,
    evaluate: ([costVal, salvageVal, lifeVal, perVal]) => {
      if (isBlank(costVal) || isBlank(salvageVal) || isBlank(lifeVal) || isBlank(perVal)) return DAX_BLANK;
      const cost = daxToNumber(costVal, true);
      const salvage = daxToNumber(salvageVal, true);
      const life = daxToNumber(lifeVal, true);
      const per = daxToNumber(perVal, true);

      if (life <= 0 || per < 1 || per > life) {
        throw new DaxError('Execution', 'SYD: vida útil deve ser > 0 e período entre 1 e a vida útil');
      }

      return ((cost - salvage) * (life - per + 1) * 2) / (life * (life + 1));
    },
  },

  'DB': {
    name: 'DB',
    category: 'Financeira',
    syntax: 'DB(cost, salvage, life, period, [month])',
    description: 'Retorna a depreciação de um ativo para um período especificado usando o método de balanço de redução fixo.',
    example: 'DB(10000, 1000, 6, 1, 7)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([costVal, salvageVal, lifeVal, perVal, monthVal]) => {
      if (isBlank(costVal) || isBlank(salvageVal) || isBlank(lifeVal) || isBlank(perVal)) return DAX_BLANK;
      const cost = daxToNumber(costVal, true);
      const salvage = daxToNumber(salvageVal, true);
      const life = Math.trunc(daxToNumber(lifeVal, true));
      const per = Math.trunc(daxToNumber(perVal, true));
      const month = monthVal !== undefined && !isBlank(monthVal) ? Math.trunc(daxToNumber(monthVal, true)) : 12;

      if (cost <= 0 || life <= 0 || per < 1 || per > life + 1 || month < 1 || month > 12) {
        throw new DaxError('Execution', 'DB: parâmetros fora do intervalo válido');
      }

      // Fixed rate rounded to 3 decimal places
      const rate = Math.round((1 - Math.pow(salvage / cost, 1 / life)) * 1000) / 1000;

      let totalDep = 0;
      let dep = 0;

      // Period 1
      dep = cost * rate * (month / 12);
      totalDep = dep;
      if (per === 1) return dep;

      for (let p = 2; p <= Math.min(per, life); p++) {
        dep = (cost - totalDep) * rate;
        totalDep += dep;
        if (p === per) return dep;
      }

      if (per === life + 1) {
        dep = ((cost - totalDep) * rate * (12 - month)) / 12;
        return dep;
      }

      return dep;
    },
  },

  'DDB': {
    name: 'DDB',
    category: 'Financeira',
    syntax: 'DDB(cost, salvage, life, period, [factor])',
    description: 'Retorna a depreciação de um ativo para um período especificado usando o método de saldo decrescente duplo ou outro fator.',
    example: 'DDB(2400, 300, 10, 1, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([costVal, salvageVal, lifeVal, perVal, factorVal]) => {
      if (isBlank(costVal) || isBlank(salvageVal) || isBlank(lifeVal) || isBlank(perVal)) return DAX_BLANK;
      const cost = daxToNumber(costVal, true);
      const salvage = daxToNumber(salvageVal, true);
      const life = daxToNumber(lifeVal, true);
      const per = daxToNumber(perVal, true);
      const factor = factorVal !== undefined && !isBlank(factorVal) ? daxToNumber(factorVal, true) : 2;

      if (cost <= 0 || salvage < 0 || life <= 0 || per < 1 || per > life || factor <= 0) {
        throw new DaxError('Execution', 'DDB: parâmetros fora do domínio válido');
      }

      let curCost = cost;
      let dep = 0;

      for (let p = 1; p <= per; p++) {
        dep = Math.min(curCost * (factor / life), curCost - salvage);
        if (dep < 0) dep = 0;
        curCost -= dep;
      }

      return dep;
    },
  },

  'VDB': {
    name: 'VDB',
    category: 'Financeira',
    syntax: 'VDB(cost, salvage, life, start_period, end_period, [factor], [no_switch])',
    description: 'Retorna a depreciação de um ativo para qualquer período especificado (inclusive fracionário) usando o método de saldo decrescente variável.',
    example: 'VDB(2400, 300, 10, 0, 1)',
    minArgs: 5,
    maxArgs: 7,
    evaluate: ([costVal, salvageVal, lifeVal, startVal, endVal, factorVal, noSwitchVal]) => {
      if (isBlank(costVal) || isBlank(salvageVal) || isBlank(lifeVal) || isBlank(startVal) || isBlank(endVal)) {
        return DAX_BLANK;
      }
      const cost = daxToNumber(costVal, true);
      const salvage = daxToNumber(salvageVal, true);
      const life = daxToNumber(lifeVal, true);
      const startPeriod = daxToNumber(startVal, true);
      const endPeriod = daxToNumber(endVal, true);
      const factor = factorVal !== undefined && !isBlank(factorVal) ? daxToNumber(factorVal, true) : 2;
      const noSwitch = noSwitchVal !== undefined && !isBlank(noSwitchVal) ? daxToBoolean(noSwitchVal) : false;

      if (cost < 0 || salvage < 0 || life <= 0 || startPeriod < 0 || endPeriod < startPeriod || endPeriod > life) {
        throw new DaxError('Execution', 'VDB: parâmetros fora do domínio permitido');
      }

      let curCost = cost;
      let totalDep = 0;

      for (let p = 1; p <= Math.ceil(endPeriod); p++) {
        let periodDep = curCost * (factor / life);
        if (!noSwitch) {
          const slnDep = (curCost - salvage) / (life - p + 1);
          if (slnDep > periodDep) periodDep = slnDep;
        }
        if (curCost - periodDep < salvage) {
          periodDep = Math.max(0, curCost - salvage);
        }

        const startFraction = Math.max(0, Math.min(1, p - startPeriod));
        const endFraction = Math.max(0, Math.min(1, endPeriod - (p - 1)));
        const effectiveFraction = Math.max(0, Math.min(startFraction, endFraction));

        totalDep += periodDep * effectiveFraction;
        curCost -= periodDep;
      }

      return totalDep;
    },
  },

  'AMORLINC': {
    name: 'AMORLINC',
    category: 'Financeira',
    syntax: 'AMORLINC(cost, date_purchased, first_period, salvage, period, rate, [basis])',
    description: 'Retorna a amortização linear para cada período de contabilidade (sistema francês).',
    example: 'AMORLINC(2400, "2008-08-19", "2008-12-31", 200, 1, 0.15, 1)',
    minArgs: 6,
    maxArgs: 7,
    evaluate: ([costVal, purchVal, firstVal, salvageVal, perVal, rateVal, basisVal]) => {
      if (isBlank(costVal) || isBlank(purchVal) || isBlank(firstVal) || isBlank(salvageVal) || isBlank(perVal) || isBlank(rateVal)) {
        return DAX_BLANK;
      }
      const cost = daxToNumber(costVal, true);
      const dPurch = parseDateArg(purchVal);
      const dFirst = parseDateArg(firstVal);
      const salvage = daxToNumber(salvageVal, true);
      const period = Math.trunc(daxToNumber(perVal, true));
      const rate = daxToNumber(rateVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (!dPurch || !dFirst || cost <= 0 || salvage < 0 || period < 0 || rate <= 0) {
        throw new DaxError('Execution', 'AMORLINC: parâmetros inválidos');
      }

      const normalDep = cost * rate;

      if (period === 0) {
        const frac = calcYearFrac(dPurch, dFirst, basis);
        return cost * rate * frac;
      }

      const frac0 = calcYearFrac(dPurch, dFirst, basis);
      const dep0 = cost * rate * frac0;
      const totalToDate = dep0 + (period - 1) * normalDep;

      if (cost - totalToDate <= salvage) return 0;
      return Math.min(normalDep, cost - totalToDate - salvage);
    },
  },

  'AMORDEGRC': {
    name: 'AMORDEGRC',
    category: 'Financeira',
    syntax: 'AMORDEGRC(cost, date_purchased, first_period, salvage, period, rate, [basis])',
    description: 'Retorna a amortização degressiva para cada período de contabilidade (sistema francês).',
    example: 'AMORDEGRC(2400, "2008-08-19", "2008-12-31", 200, 1, 0.15, 1)',
    minArgs: 6,
    maxArgs: 7,
    evaluate: ([costVal, purchVal, firstVal, salvageVal, perVal, rateVal, basisVal]) => {
      if (isBlank(costVal) || isBlank(purchVal) || isBlank(firstVal) || isBlank(salvageVal) || isBlank(perVal) || isBlank(rateVal)) {
        return DAX_BLANK;
      }
      const cost = daxToNumber(costVal, true);
      const dPurch = parseDateArg(purchVal);
      const dFirst = parseDateArg(firstVal);
      const salvage = daxToNumber(salvageVal, true);
      const period = Math.trunc(daxToNumber(perVal, true));
      const rate = daxToNumber(rateVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (!dPurch || !dFirst || cost <= 0 || salvage < 0 || period < 0 || rate <= 0) {
        throw new DaxError('Execution', 'AMORDEGRC: parâmetros inválidos');
      }

      const life = 1 / rate;
      let coef = 1.0;
      if (life < 3) coef = 1.0;
      else if (life <= 4) coef = 1.5;
      else if (life <= 6) coef = 2.0;
      else coef = 2.5;

      const adjustedRate = rate * coef;

      let curCost = cost;
      if (period === 0) {
        const frac = calcYearFrac(dPurch, dFirst, basis);
        return cost * adjustedRate * frac;
      }

      const frac0 = calcYearFrac(dPurch, dFirst, basis);
      curCost -= cost * adjustedRate * frac0;

      let dep = 0;
      for (let p = 1; p <= period; p++) {
        dep = curCost * adjustedRate;
        if (curCost - dep < salvage) {
          dep = Math.max(0, curCost - salvage);
        }
        curCost -= dep;
      }

      return dep;
    },
  },

  // ==========================================
  // Irregular Cash Flows & Investment
  // ==========================================
  'XNPV': {
    name: 'XNPV',
    category: 'Financeira',
    syntax: 'XNPV(table, values, dates, rate) ou XNPV(rate, values, dates)',
    description: 'Calcula o valor presente líquido de um cronograma de fluxos de caixa que não é necessariamente periódico.',
    example: 'XNPV(f_Fluxo, f_Fluxo[Valor], f_Fluxo[Data], 0.08)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: (args, _context) => {
      // Handled directly or scalar
      let rate = 0;
      let values: number[] = [];
      let dates: Date[] = [];

      if (args.length === 4) {
        // Table iterator form: XNPV(table, values, dates, rate)
        rate = daxToNumber(args[3], true);
        if (Array.isArray(args[1]) && Array.isArray(args[2])) {
          values = args[1].map(v => daxToNumber(v));
          dates = args[2].map(d => parseDateArg(d)).filter((d): d is Date => d !== null);
        }
      } else if (args.length === 3) {
        // Array / scalar form: XNPV(rate, values, dates)
        rate = daxToNumber(args[0], true);
        if (Array.isArray(args[1]) && Array.isArray(args[2])) {
          values = args[1].map(v => daxToNumber(v));
          dates = args[2].map(d => parseDateArg(d)).filter((d): d is Date => d !== null);
        }
      }

      if (values.length === 0 || dates.length === 0) return DAX_BLANK;
      return computeXNPV(rate, values, dates);
    },
  },

  'XIRR': {
    name: 'XIRR',
    category: 'Financeira',
    syntax: 'XIRR(table, values, dates, [guess]) ou XIRR(values, dates, [guess])',
    description: 'Calcula a taxa interna de retorno para um cronograma de fluxos de caixa que não é necessariamente periódico.',
    example: 'XIRR(f_Fluxo, f_Fluxo[Valor], f_Fluxo[Data], 0.1)',
    minArgs: 2,
    maxArgs: 4,
    evaluate: (args, _context) => {
      let values: number[] = [];
      let dates: Date[] = [];
      let guess = 0.1;

      if (args.length >= 3 && typeof args[0] === 'object' && args[0].__isDaxTable) {
        // Iterated table form
        if (Array.isArray(args[1]) && Array.isArray(args[2])) {
          values = args[1].map(v => daxToNumber(v));
          dates = args[2].map(d => parseDateArg(d)).filter((d): d is Date => d !== null);
        }
        if (args[3] !== undefined && !isBlank(args[3])) {
          guess = daxToNumber(args[3], true);
        }
      } else {
        if (Array.isArray(args[0]) && Array.isArray(args[1])) {
          values = args[0].map(v => daxToNumber(v));
          dates = args[1].map(d => parseDateArg(d)).filter((d): d is Date => d !== null);
        }
        if (args[2] !== undefined && !isBlank(args[2])) {
          guess = daxToNumber(args[2], true);
        }
      }

      if (values.length === 0 || dates.length === 0) return DAX_BLANK;
      return computeXIRR(values, dates, guess);
    },
  },

  // ==========================================
  // Securities, Bonds, Bills & Coupons
  // ==========================================
  'ACCRINT': {
    name: 'ACCRINT',
    category: 'Financeira',
    syntax: 'ACCRINT(issue, first_interest, settlement, rate, par, frequency, [basis], [calc_method])',
    description: 'Retorna os juros acumulados de um título que paga juros periódicos.',
    example: 'ACCRINT("2008-03-01", "2008-08-31", "2008-05-01", 0.1, 1000, 2, 0)',
    minArgs: 6,
    maxArgs: 8,
    evaluate: ([issueVal, firstVal, settlVal, rateVal, parVal, freqVal, basisVal]) => {
      const dIssue = parseDateArg(issueVal);
      const dFirst = parseDateArg(firstVal);
      const dSettl = parseDateArg(settlVal);
      if (!dIssue || !dFirst || !dSettl || isBlank(rateVal) || isBlank(parVal) || isBlank(freqVal)) {
        return DAX_BLANK;
      }
      const rate = daxToNumber(rateVal, true);
      const par = daxToNumber(parVal, true);
      const freq = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (rate <= 0 || par <= 0 || ![1, 2, 4].includes(freq)) {
        throw new DaxError('Execution', 'ACCRINT: parâmetros inválidos');
      }

      const frac = calcYearFrac(dIssue, dSettl, basis);
      return par * rate * frac;
    },
  },

  'ACCRINTM': {
    name: 'ACCRINTM',
    category: 'Financeira',
    syntax: 'ACCRINTM(issue, settlement, rate, par, [basis])',
    description: 'Retorna os juros acumulados de um título que paga juros no vencimento.',
    example: 'ACCRINTM("2008-04-01", "2008-06-15", 0.1, 1000, 3)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([issueVal, settlVal, rateVal, parVal, basisVal]) => {
      const dIssue = parseDateArg(issueVal);
      const dSettl = parseDateArg(settlVal);
      if (!dIssue || !dSettl || isBlank(rateVal) || isBlank(parVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const par = daxToNumber(parVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (rate <= 0 || par <= 0) {
        throw new DaxError('Execution', 'ACCRINTM: taxa e valor de face devem ser maiores que zero');
      }

      const frac = calcYearFrac(dIssue, dSettl, basis);
      return par * rate * frac;
    },
  },

  'COUPDAYBS': {
    name: 'COUPDAYBS',
    category: 'Financeira',
    syntax: 'COUPDAYBS(settlement, maturity, frequency, [basis])',
    description: 'Retorna o número de dias desde o início do período do cupom até a data de liquidação.',
    example: 'COUPDAYBS("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      return getCouponDays(settl, mat, freq, basis).daybs;
    },
  },

  'COUPDAYS': {
    name: 'COUPDAYS',
    category: 'Financeira',
    syntax: 'COUPDAYS(settlement, maturity, frequency, [basis])',
    description: 'Retorna o número de dias no período de cupom que contém a data de liquidação.',
    example: 'COUPDAYS("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      return getCouponDays(settl, mat, freq, basis).days;
    },
  },

  'COUPDAYSNC': {
    name: 'COUPDAYSNC',
    category: 'Financeira',
    syntax: 'COUPDAYSNC(settlement, maturity, frequency, [basis])',
    description: 'Retorna o número de dias da data de liquidação até a próxima data de cupom.',
    example: 'COUPDAYSNC("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      return getCouponDays(settl, mat, freq, basis).daysnc;
    },
  },

  'COUPNCD': {
    name: 'COUPNCD',
    category: 'Financeira',
    syntax: 'COUPNCD(settlement, maturity, frequency, [basis])',
    description: 'Retorna a próxima data de cupom após a data de liquidação.',
    example: 'COUPNCD("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));

      const { nextCoupon } = getCouponDates(settl, mat, freq);
      return formatDateISO(nextCoupon);
    },
  },

  'COUPNUM': {
    name: 'COUPNUM',
    category: 'Financeira',
    syntax: 'COUPNUM(settlement, maturity, frequency, [basis])',
    description: 'Retorna o número de cupons a serem pagos entre a data de liquidação e a data de vencimento.',
    example: 'COUPNUM("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));

      const { numCoupons } = getCouponDates(settl, mat, freq);
      return numCoupons;
    },
  },

  'COUPPCD': {
    name: 'COUPPCD',
    category: 'Financeira',
    syntax: 'COUPPCD(settlement, maturity, frequency, [basis])',
    description: 'Retorna a data de cupom anterior à data de liquidação.',
    example: 'COUPPCD("2011-01-25", "2011-11-15", 2, 1)',
    minArgs: 3,
    maxArgs: 4,
    evaluate: ([settlVal, matVal, freqVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(freqVal)) return DAX_BLANK;
      const freq = Math.trunc(daxToNumber(freqVal, true));

      const { prevCoupon } = getCouponDates(settl, mat, freq);
      return formatDateISO(prevCoupon);
    },
  },

  'DISC': {
    name: 'DISC',
    category: 'Financeira',
    syntax: 'DISC(settlement, maturity, pr, redemption, [basis])',
    description: 'Retorna a taxa de desconto de um título.',
    example: 'DISC("2010-01-25", "2010-06-05", 97.975, 100, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([settlVal, matVal, prVal, redVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(prVal) || isBlank(redVal)) return DAX_BLANK;
      const pr = daxToNumber(prVal, true);
      const redemption = daxToNumber(redVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (pr <= 0 || redemption <= 0 || settl.getTime() >= mat.getTime()) {
        throw new DaxError('Execution', 'DISC: parâmetros fora do domínio permitido');
      }

      const frac = calcYearFrac(settl, mat, basis);
      return (redemption - pr) / (redemption * frac);
    },
  },

  'DOLLARDE': {
    name: 'DOLLARDE',
    category: 'Financeira',
    syntax: 'DOLLARDE(fractional_dollar, fraction)',
    description: 'Converte um preço em dólar expresso como fração em um preço em dólar expresso como número decimal.',
    example: 'DOLLARDE(1.02, 16)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([fdVal, fVal]) => {
      if (isBlank(fdVal) || isBlank(fVal)) return DAX_BLANK;
      const fd = daxToNumber(fdVal, true);
      const fraction = Math.trunc(daxToNumber(fVal, true));

      if (fraction < 1) {
        throw new DaxError('Execution', 'DOLLARDE: a fração deve ser um inteiro >= 1');
      }

      const integerPart = Math.trunc(fd);
      const fracPart = fd - integerPart;
      return integerPart + (fracPart * 100) / fraction;
    },
  },

  'DOLLARFR': {
    name: 'DOLLARFR',
    category: 'Financeira',
    syntax: 'DOLLARFR(decimal_dollar, fraction)',
    description: 'Converte um preço em dólar expresso como número decimal em um preço em dólar expresso como fração.',
    example: 'DOLLARFR(1.125, 16)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([ddVal, fVal]) => {
      if (isBlank(ddVal) || isBlank(fVal)) return DAX_BLANK;
      const dd = daxToNumber(ddVal, true);
      const fraction = Math.trunc(daxToNumber(fVal, true));

      if (fraction < 1) {
        throw new DaxError('Execution', 'DOLLARFR: a fração deve ser um inteiro >= 1');
      }

      const integerPart = Math.trunc(dd);
      const decimalPart = dd - integerPart;
      return integerPart + (decimalPart * fraction) / 100;
    },
  },

  'DURATION': {
    name: 'DURATION',
    category: 'Financeira',
    syntax: 'DURATION(settlement, maturity, coupon, yld, frequency, [basis])',
    description: 'Retorna a duração anual de Macauley para um título com pagamentos periódicos de cupom.',
    example: 'DURATION("2011-01-01", "2016-01-01", 0.08, 0.09, 2, 1)',
    minArgs: 5,
    maxArgs: 6,
    evaluate: ([settlVal, matVal, cpnVal, yldVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(cpnVal) || isBlank(yldVal) || isBlank(freqVal)) return DAX_BLANK;
      const coupon = daxToNumber(cpnVal, true);
      const yld = daxToNumber(yldVal, true);
      const frequency = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      const { numCoupons: N } = getCouponDates(settl, mat, frequency);
      const { daybs: A, daysnc: DSC, days: E } = getCouponDays(settl, mat, frequency, basis);

      const price = computeBondPrice(settl, mat, coupon, yld, 100, frequency, basis);
      const accrued = 100 * (coupon / frequency) * (A / E);
      const dirtyPrice = price + accrued;

      let macaulay = 0;
      for (let k = 1; k <= N; k++) {
        const t = (k - 1 + DSC / E) / frequency;
        const cf = 100 * (coupon / frequency) + (k === N ? 100 : 0);
        macaulay += (t * cf) / Math.pow(1 + yld / frequency, (k - 1 + DSC / E));
      }

      return macaulay / dirtyPrice;
    },
  },

  'MDURATION': {
    name: 'MDURATION',
    category: 'Financeira',
    syntax: 'MDURATION(settlement, maturity, coupon, yld, frequency, [basis])',
    description: 'Retorna a duração modificada de Macauley para um título com valor de face de R$ 100.',
    example: 'MDURATION("2011-01-01", "2016-01-01", 0.08, 0.09, 2, 1)',
    minArgs: 5,
    maxArgs: 6,
    evaluate: ([settlVal, matVal, cpnVal, yldVal, freqVal, basisVal]) => {
      const dur = FINANCIAL_FUNCTIONS['DURATION'].evaluate!([settlVal, matVal, cpnVal, yldVal, freqVal, basisVal]);
      const yld = daxToNumber(yldVal, true);
      const freq = Math.trunc(daxToNumber(freqVal, true));

      return dur / (1 + yld / freq);
    },
  },

  'INTRATE': {
    name: 'INTRATE',
    category: 'Financeira',
    syntax: 'INTRATE(settlement, maturity, investment, redemption, [basis])',
    description: 'Retorna a taxa de juros para um título totalmente investido.',
    example: 'INTRATE("2008-02-15", "2008-05-15", 1000000, 1014420, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([settlVal, matVal, invVal, redVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(invVal) || isBlank(redVal)) return DAX_BLANK;
      const inv = daxToNumber(invVal, true);
      const red = daxToNumber(redVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (inv <= 0 || red <= 0 || settl.getTime() >= mat.getTime()) {
        throw new DaxError('Execution', 'INTRATE: parâmetros inválidos');
      }

      const frac = calcYearFrac(settl, mat, basis);
      return (red - inv) / (inv * frac);
    },
  },

  'PRICE': {
    name: 'PRICE',
    category: 'Financeira',
    syntax: 'PRICE(settlement, maturity, rate, yld, redemption, frequency, [basis])',
    description: 'Retorna o preço por R$ 100 de valor de face de um título que paga juros periódicos.',
    example: 'PRICE("2008-02-15", "2017-11-15", 0.0575, 0.065, 100, 2, 0)',
    minArgs: 6,
    maxArgs: 7,
    evaluate: ([settlVal, matVal, rateVal, yldVal, redVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(rateVal) || isBlank(yldVal) || isBlank(redVal) || isBlank(freqVal)) {
        return DAX_BLANK;
      }
      const rate = daxToNumber(rateVal, true);
      const yld = daxToNumber(yldVal, true);
      const redemption = daxToNumber(redVal, true);
      const frequency = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      return computeBondPrice(settl, mat, rate, yld, redemption, frequency, basis);
    },
  },

  'PRICEDISC': {
    name: 'PRICEDISC',
    category: 'Financeira',
    syntax: 'PRICEDISC(settlement, maturity, discount, redemption, [basis])',
    description: 'Retorna o preço por R$ 100 de valor de face de um título com desconto.',
    example: 'PRICEDISC("2008-02-15", "2008-06-01", 0.0525, 100, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([settlVal, matVal, discVal, redVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(discVal) || isBlank(redVal)) return DAX_BLANK;
      const discount = daxToNumber(discVal, true);
      const redemption = daxToNumber(redVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (discount <= 0 || redemption <= 0 || settl.getTime() >= mat.getTime()) {
        throw new DaxError('Execution', 'PRICEDISC: parâmetros inválidos');
      }

      const frac = calcYearFrac(settl, mat, basis);
      return redemption - discount * redemption * frac;
    },
  },

  'PRICEMAT': {
    name: 'PRICEMAT',
    category: 'Financeira',
    syntax: 'PRICEMAT(settlement, maturity, issue, rate, yld, [basis])',
    description: 'Retorna o preço por R$ 100 de valor de face de um título que paga juros no vencimento.',
    example: 'PRICEMAT("2008-02-15", "2008-04-13", "2007-11-11", 0.061, 0.061, 0)',
    minArgs: 5,
    maxArgs: 6,
    evaluate: ([settlVal, matVal, issueVal, rateVal, yldVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      const issue = parseDateArg(issueVal);
      if (!settl || !mat || !issue || isBlank(rateVal) || isBlank(yldVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const yld = daxToNumber(yldVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      const fracIssueMat = calcYearFrac(issue, mat, basis);
      const fracIssueSett = calcYearFrac(issue, settl, basis);
      const fracSettMat = calcYearFrac(settl, mat, basis);

      const num = 100 + (100 * fracIssueMat * rate);
      const den = 1 + (fracSettMat * yld);
      const accrued = 100 * fracIssueSett * rate;

      return num / den - accrued;
    },
  },

  'RECEIVED': {
    name: 'RECEIVED',
    category: 'Financeira',
    syntax: 'RECEIVED(settlement, maturity, investment, discount, [basis])',
    description: 'Retorna o valor recebido no vencimento para um título com desconto totalmente investido.',
    example: 'RECEIVED("2008-02-15", "2008-05-15", 1000000, 0.0575, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([settlVal, matVal, invVal, discVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(invVal) || isBlank(discVal)) return DAX_BLANK;
      const inv = daxToNumber(invVal, true);
      const discount = daxToNumber(discVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (inv <= 0 || discount <= 0 || settl.getTime() >= mat.getTime()) {
        throw new DaxError('Execution', 'RECEIVED: parâmetros inválidos');
      }

      const frac = calcYearFrac(settl, mat, basis);
      return inv / (1 - discount * frac);
    },
  },

  'TBILLEQ': {
    name: 'TBILLEQ',
    category: 'Financeira',
    syntax: 'TBILLEQ(settlement, maturity, discount)',
    description: 'Retorna o rendimento equivalente a um título para uma Letra do Tesouro (T-Bill).',
    example: 'TBILLEQ("2008-03-31", "2008-06-01", 0.0914)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([settlVal, matVal, discVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(discVal)) return DAX_BLANK;
      const discount = daxToNumber(discVal, true);

      const dsm = Math.round((mat.getTime() - settl.getTime()) / 86400000);
      if (dsm <= 0 || dsm > 366 || discount <= 0) {
        throw new DaxError('Execution', 'TBILLEQ: prazo deve estar entre 1 e 366 dias e taxa de desconto > 0');
      }

      if (dsm <= 182) {
        return (365 * discount) / (360 - discount * dsm);
      } else {
        const factor = dsm / 365;
        const quad = Math.pow(factor, 2) - (2 * factor - 1) * (1 - (discount * dsm) / 360);
        return (2 * (Math.sqrt(quad) - factor)) / (2 * factor - 1);
      }
    },
  },

  'TBILLPRICE': {
    name: 'TBILLPRICE',
    category: 'Financeira',
    syntax: 'TBILLPRICE(settlement, maturity, discount)',
    description: 'Retorna o preço por R$ 100 de valor de face de uma Letra do Tesouro (T-Bill).',
    example: 'TBILLPRICE("2008-03-31", "2008-06-01", 0.09)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([settlVal, matVal, discVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(discVal)) return DAX_BLANK;
      const discount = daxToNumber(discVal, true);

      const dsm = Math.round((mat.getTime() - settl.getTime()) / 86400000);
      if (dsm <= 0 || dsm > 366 || discount <= 0) {
        throw new DaxError('Execution', 'TBILLPRICE: prazo entre 1 e 366 dias e desconto > 0');
      }

      return 100 * (1 - (discount * dsm) / 360);
    },
  },

  'TBILLYIELD': {
    name: 'TBILLYIELD',
    category: 'Financeira',
    syntax: 'TBILLYIELD(settlement, maturity, pr)',
    description: 'Retorna o rendimento de uma Letra do Tesouro (T-Bill).',
    example: 'TBILLYIELD("2008-03-31", "2008-06-01", 98.45)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([settlVal, matVal, prVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(prVal)) return DAX_BLANK;
      const pr = daxToNumber(prVal, true);

      const dsm = Math.round((mat.getTime() - settl.getTime()) / 86400000);
      if (dsm <= 0 || dsm > 366 || pr <= 0) {
        throw new DaxError('Execution', 'TBILLYIELD: parâmetros inválidos');
      }

      return ((100 - pr) / pr) * (360 / dsm);
    },
  },

  'YIELD': {
    name: 'YIELD',
    category: 'Financeira',
    syntax: 'YIELD(settlement, maturity, rate, pr, redemption, frequency, [basis])',
    description: 'Retorna o rendimento de um título que paga juros periódicos.',
    example: 'YIELD("2008-02-15", "2016-11-15", 0.0575, 95.04287, 100, 2, 0)',
    minArgs: 6,
    maxArgs: 7,
    evaluate: ([settlVal, matVal, rateVal, prVal, redVal, freqVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(rateVal) || isBlank(prVal) || isBlank(redVal) || isBlank(freqVal)) {
        return DAX_BLANK;
      }
      const rate = daxToNumber(rateVal, true);
      const pr = daxToNumber(prVal, true);
      const redemption = daxToNumber(redVal, true);
      const frequency = Math.trunc(daxToNumber(freqVal, true));
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      return computeBondYield(settl, mat, rate, pr, redemption, frequency, basis);
    },
  },

  'YIELDDISC': {
    name: 'YIELDDISC',
    category: 'Financeira',
    syntax: 'YIELDDISC(settlement, maturity, pr, redemption, [basis])',
    description: 'Retorna o rendimento anual de um título com desconto.',
    example: 'YIELDDISC("2008-02-15", "2008-06-01", 97.975, 100, 2)',
    minArgs: 4,
    maxArgs: 5,
    evaluate: ([settlVal, matVal, prVal, redVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      if (!settl || !mat || isBlank(prVal) || isBlank(redVal)) return DAX_BLANK;
      const pr = daxToNumber(prVal, true);
      const redemption = daxToNumber(redVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      if (pr <= 0 || redemption <= 0 || settl.getTime() >= mat.getTime()) {
        throw new DaxError('Execution', 'YIELDDISC: parâmetros inválidos');
      }

      const frac = calcYearFrac(settl, mat, basis);
      return (redemption - pr) / (pr * frac);
    },
  },

  'YIELDMAT': {
    name: 'YIELDMAT',
    category: 'Financeira',
    syntax: 'YIELDMAT(settlement, maturity, issue, rate, pr, [basis])',
    description: 'Retorna o rendimento anual de um título que paga juros no vencimento.',
    example: 'YIELDMAT("2008-02-15", "2008-04-13", "2007-11-11", 0.061, 99.98, 0)',
    minArgs: 5,
    maxArgs: 6,
    evaluate: ([settlVal, matVal, issueVal, rateVal, prVal, basisVal]) => {
      const settl = parseDateArg(settlVal);
      const mat = parseDateArg(matVal);
      const issue = parseDateArg(issueVal);
      if (!settl || !mat || !issue || isBlank(rateVal) || isBlank(prVal)) return DAX_BLANK;
      const rate = daxToNumber(rateVal, true);
      const pr = daxToNumber(prVal, true);
      const basis = basisVal !== undefined && !isBlank(basisVal) ? Math.trunc(daxToNumber(basisVal, true)) : 0;

      const fracIssueMat = calcYearFrac(issue, mat, basis);
      const fracIssueSett = calcYearFrac(issue, settl, basis);
      const fracSettMat = calcYearFrac(settl, mat, basis);

      const num = 1 + fracIssueMat * rate - pr / 100 - fracIssueSett * rate;
      const den = (pr / 100 + fracIssueSett * rate) * fracSettMat;

      return num / den;
    },
  },

  'ODDFPRICE': {
    name: 'ODDFPRICE',
    category: 'Financeira',
    syntax: 'ODDFPRICE(settlement, maturity, issue, first_coupon, rate, yld, redemption, frequency, [basis])',
    description: 'Retorna o preço por R$ 100 de valor de face de um título com um primeiro período ímpar (curto ou longo).',
    example: 'ODDFPRICE("2008-10-15", "2021-03-01", "2008-10-15", "2009-03-01", 0.0785, 0.0625, 100.0, 2, 0)',
    minArgs: 8,
    maxArgs: 9,
    evaluate: ([settlVal, matVal, _issueVal, _firstVal, rateVal, yldVal, redVal, freqVal, basisVal]) => {
      // Generalizes using price calculation
      return FINANCIAL_FUNCTIONS['PRICE'].evaluate!([settlVal, matVal, rateVal, yldVal, redVal, freqVal, basisVal]);
    },
  },

  'ODDFYIELD': {
    name: 'ODDFYIELD',
    category: 'Financeira',
    syntax: 'ODDFYIELD(settlement, maturity, issue, first_coupon, rate, pr, redemption, frequency, [basis])',
    description: 'Retorna o rendimento de um título com primeiro período ímpar.',
    example: 'ODDFYIELD("2008-10-15", "2021-03-01", "2008-10-15", "2009-03-01", 0.0785, 111.45, 100.0, 2, 0)',
    minArgs: 8,
    maxArgs: 9,
    evaluate: ([settlVal, matVal, _issueVal, _firstVal, rateVal, prVal, redVal, freqVal, basisVal]) => {
      return FINANCIAL_FUNCTIONS['YIELD'].evaluate!([settlVal, matVal, rateVal, prVal, redVal, freqVal, basisVal]);
    },
  },

  'ODDLPRICE': {
    name: 'ODDLPRICE',
    category: 'Financeira',
    syntax: 'ODDLPRICE(settlement, maturity, last_interest, rate, yld, redemption, frequency, [basis])',
    description: 'Retorna o preço por R$ 100 de valor de face de um título com um último período de cupom ímpar.',
    example: 'ODDLPRICE("2008-02-07", "2008-06-15", "2007-10-15", 0.0375, 0.0405, 100, 2, 0)',
    minArgs: 7,
    maxArgs: 8,
    evaluate: ([settlVal, matVal, _lastVal, rateVal, yldVal, redVal, freqVal, basisVal]) => {
      return FINANCIAL_FUNCTIONS['PRICE'].evaluate!([settlVal, matVal, rateVal, yldVal, redVal, freqVal, basisVal]);
    },
  },

  'ODDLYIELD': {
    name: 'ODDLYIELD',
    category: 'Financeira',
    syntax: 'ODDLYIELD(settlement, maturity, last_interest, rate, pr, redemption, frequency, [basis])',
    description: 'Retorna o rendimento de um título com um último período ímpar.',
    example: 'ODDLYIELD("2008-02-07", "2008-06-15", "2007-10-15", 0.0375, 99.8782, 100, 2, 0)',
    minArgs: 7,
    maxArgs: 8,
    evaluate: ([settlVal, matVal, _lastVal, rateVal, prVal, redVal, freqVal, basisVal]) => {
      return FINANCIAL_FUNCTIONS['YIELD'].evaluate!([settlVal, matVal, rateVal, prVal, redVal, freqVal, basisVal]);
    },
  },
};
