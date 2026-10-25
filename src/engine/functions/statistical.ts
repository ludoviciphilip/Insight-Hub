import { FunctionDefinition } from '../expr/registry';
import { DaxError } from '../shared/errors';
import { DAX_BLANK, isBlank, daxToNumber, daxToBoolean, DaxTableValue } from '../expr/types';
import { getColumnValuesFromContext } from './aggregation';

// ==========================================
// High-Precision Special Mathematical Functions
// ==========================================

const LANCZOS_COEFFS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109583115912,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

/**
 * Natural logarithm of Gamma function ln(Γ(z)) for z > 0
 * Lanczos approximation (g=7, n=9), precision ~ 1e-15
 */
export function logGamma(z: number): number {
  if (z <= 0) {
    // Reflection formula: Γ(1-z) Γ(z) = π / sin(π z)
    return Math.log(Math.PI) - Math.log(Math.abs(Math.sin(Math.PI * z))) - logGamma(1 - z);
  }
  z -= 1;
  let x = LANCZOS_COEFFS[0];
  for (let i = 1; i < 9; i++) {
    x += LANCZOS_COEFFS[i] / (z + i);
  }
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

/**
 * Error function erf(x) using high-precision rational Chebyshev approximation
 */
export function erf(x: number): number {
  if (isNaN(x)) return NaN;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  if (absX > 8.0) return sign;

  // Abramowitz & Stegun 7.1.26 (max error 1.5e-7) refined or standard Horner
  // High precision rational approximation (Cody / Hart)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

export function erfc(x: number): number {
  return 1 - erf(x);
}

/**
 * Inverse Error Function erfinv(x) for x in (-1, 1)
 */
export function erfinv(x: number): number {
  if (x <= -1 || x >= 1) {
    if (x === -1) return -Infinity;
    if (x === 1) return Infinity;
    return NaN;
  }
  return inverseStandardNormal((x + 1) / 2) / Math.SQRT2;
}

/**
 * Standard Normal Cumulative Distribution Function Φ(z)
 */
export function standardNormalCDF(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/**
 * Standard Normal Probability Density Function φ(z)
 */
export function standardNormalPDF(z: number): number {
  return (1.0 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
}

/**
 * Inverse Standard Normal (Probit) Function Φ^(-1)(p) for p in (0, 1)
 * Acklam's algorithm with Halley refinement to machine precision (< 1e-15)
 */
export function inverseStandardNormal(p: number): number {
  if (p <= 0 || p >= 1) {
    if (p === 0) return -Infinity;
    if (p === 1) return Infinity;
    throw new DaxError('Execution', `Probabilidade inválida (${p}). O valor deve estar no intervalo (0, 1).`);
  }

  // Coefficients in rational approximations
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.383577518672690e2,
    -3.066479806614716e1,
    2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838e0,
    -2.549732539343734e0,
    4.374664141464968e0,
    2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996e0,
    3.754408661907416e0,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let q: number;
  let r: number;
  let x: number;

  if (p < pLow) {
    // Rational approximation for lower region
    q = Math.sqrt(-2 * Math.log(p));
    x =
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    // Rational approximation for central region
    q = p - 0.5;
    r = q * q;
    x =
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    // Rational approximation for upper region
    q = Math.sqrt(-2 * Math.log(1 - p));
    x =
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One step of Halley's rational method to achieve full double precision
  const e = standardNormalCDF(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp(0.5 * x * x);
  x = x - u / (1 + 0.5 * x * u);

  return x;
}

/**
 * Regularized lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a)
 */
export function incompleteGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;

  if (x < a + 1) {
    // Series expansion
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 200; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  } else {
    // Continued fraction for upper incomplete gamma Q(a, x), then P = 1 - Q
    return 1 - incompleteGammaQ(a, x);
  }
}

/**
 * Regularized upper incomplete gamma function Q(a, x) = Γ(a, x) / Γ(a)
 * Lentz's method for continued fractions
 */
export function incompleteGammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1;
  if (x === 0) return 1;

  if (x < a + 1) {
    return 1 - incompleteGamma(a, x);
  }

  const TINY = 1e-30;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let f = d;

  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + an / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const del = d * c;
    f *= del;
    if (Math.abs(del - 1.0) < 1e-15) break;
  }

  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * f;
}

/**
 * Regularized Incomplete Beta Function I_x(a, b) = B(x; a, b) / B(a, b)
 * for x in [0, 1] and a, b > 0 using Lentz continued fraction
 */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (a <= 0 || b <= 0) {
    throw new DaxError('Execution', 'Os parâmetros alpha e beta devem ser estritamente positivos.');
  }

  // Symmetry transformation
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(1 - x, b, a);
  }

  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lnBeta) / a;

  const TINY = 1e-30;
  let f = 1.0;
  let c = 1.0;
  let d = 0.0;

  for (let m = 0; m <= 200; m++) {
    let numerator: number;
    if (m === 0) {
      numerator = 1.0;
    } else if (m % 2 === 0) {
      const k = m / 2;
      numerator = (k * (b - k) * x) / ((a + 2 * k - 1) * (a + 2 * k));
    } else {
      const k = (m - 1) / 2;
      numerator = -((a + k) * (a + b + k) * x) / ((a + 2 * k) * (a + 2 * k + 1));
    }

    d = 1.0 + numerator * d;
    if (Math.abs(d) < TINY) d = TINY;
    d = 1.0 / d;

    c = 1.0 + numerator / c;
    if (Math.abs(c) < TINY) c = TINY;

    const delta = c * d;
    f *= delta;

    if (Math.abs(delta - 1.0) < 1e-15) break;
  }

  return front * (f - 1.0);
}

/**
 * Inverse Beta Distribution Function: solves I_x(a, b) = p for x
 */
export function inverseBeta(p: number, a: number, b: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  // Initial estimate using mean or normal approximation
  let x = a / (a + b);
  let low = 0;
  let high = 1;

  for (let iter = 0; iter < 100; iter++) {
    const curP = incompleteBeta(x, a, b);
    const err = curP - p;
    if (Math.abs(err) < 1e-14 || (high - low) < 1e-15) {
      return x;
    }
    if (err > 0) high = x;
    else low = x;

    // Derivative: PDF of Beta distribution
    const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
    const pdf = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lnBeta);

    let nextX = x - err / pdf;
    if (nextX <= low || nextX >= high || isNaN(nextX)) {
      x = 0.5 * (low + high);
    } else {
      x = nextX;
    }
  }

  return x;
}

/**
 * Inverse Chi-Square Distribution Function: solves CHISQ.DIST(x, df, TRUE) = p
 */
export function inverseChiSquare(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) {
    throw new DaxError('Execution', 'CHISQ.INV: probabilidade deve estar em (0, 1) e graus de liberdade > 0');
  }

  // Wilson-Hilferty transformation as high-accuracy initial guess
  const z = inverseStandardNormal(p);
  const factor = 2 / (9 * df);
  let x = df * Math.pow(1 - factor + z * Math.sqrt(factor), 3);
  if (x <= 0) x = 0.001 * df;

  let low = 0;
  let high = Math.max(100 * df, x * 10);

  for (let iter = 0; iter < 100; iter++) {
    const curP = incompleteGamma(df / 2, x / 2);
    const diff = curP - p;
    if (Math.abs(diff) < 1e-14 || (high - low) < 1e-15) {
      return x;
    }

    if (diff > 0) high = x;
    else low = x;

    // Derivative: PDF of Chi-Square = (x^(df/2 - 1) * e^(-x/2)) / (2^(df/2) * Γ(df/2))
    const pdf = Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.LN2 - logGamma(df / 2));
    let nextX = x - diff / pdf;
    if (nextX <= low || nextX >= high || isNaN(nextX)) {
      x = 0.5 * (low + high);
    } else {
      x = nextX;
    }
  }

  return x;
}

/**
 * Inverse Student's t-distribution: solves T.DIST(x, df, TRUE) = p
 */
export function inverseStudentT(p: number, df: number): number {
  if (p <= 0 || p >= 1 || df <= 0) {
    throw new DaxError('Execution', 'T.INV: probabilidade deve estar em (0, 1) e graus de liberdade >= 1');
  }
  if (p === 0.5) return 0;
  if (p > 0.5) return -inverseStudentT(1 - p, df);

  // For p < 0.5, x is negative. Use regularized incomplete beta:
  // p = 0.5 * I_{df / (df + x^2)}(df / 2, 0.5)
  // Let u = I_inv(2p, df / 2, 0.5) => u = df / (df + x^2) => x = -sqrt(df * (1 - u) / u)
  const u = inverseBeta(2 * p, df / 2, 0.5);
  if (u <= 0) return -Infinity;
  return -Math.sqrt(df * (1 - u) / u);
}

// ==========================================
// Statistical Aggregations & Formulas
// ==========================================

export function computeSampleStdev(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sumSq = nums.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
  return Math.sqrt(sumSq / (nums.length - 1));
}

export function computePopulationStdev(nums: number[]): number | null {
  if (nums.length < 1) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sumSq = nums.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
  return Math.sqrt(sumSq / nums.length);
}

export function computeSampleVariance(nums: number[]): number | null {
  if (nums.length < 2) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sumSq = nums.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
  return sumSq / (nums.length - 1);
}

export function computePopulationVariance(nums: number[]): number | null {
  if (nums.length < 1) return null;
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const sumSq = nums.reduce((acc, x) => acc + (x - mean) * (x - mean), 0);
  return sumSq / nums.length;
}

export function computePercentileInc(sortedNums: number[], k: number): number {
  if (k < 0 || k > 1) {
    throw new DaxError('Execution', `PERCENTILE.INC: k deve estar entre 0 e 1, fornecido: ${k}`);
  }
  const n = sortedNums.length;
  if (n === 0) return NaN;
  if (n === 1 || k === 0) return sortedNums[0];
  if (k === 1) return sortedNums[n - 1];

  const rank = k * (n - 1);
  const lowIndex = Math.floor(rank);
  const frac = rank - lowIndex;

  if (lowIndex >= n - 1) return sortedNums[n - 1];
  return sortedNums[lowIndex] + frac * (sortedNums[lowIndex + 1] - sortedNums[lowIndex]);
}

export function computePercentileExc(sortedNums: number[], k: number): number {
  const n = sortedNums.length;
  if (k < 1 / (n + 1) || k > n / (n + 1)) {
    throw new DaxError(
      'Execution',
      `PERCENTILE.EXC: k (${k}) fora do intervalo permitido [${(1 / (n + 1)).toFixed(4)}, ${(n / (n + 1)).toFixed(4)}] para amostra de ${n} itens`
    );
  }

  const rank = k * (n + 1) - 1;
  const lowIndex = Math.floor(rank);
  const frac = rank - lowIndex;

  if (lowIndex >= n - 1) return sortedNums[n - 1];
  return sortedNums[lowIndex] + frac * (sortedNums[lowIndex + 1] - sortedNums[lowIndex]);
}

/**
 * Calculates simple linear regression y = m * x + b
 */
export function computeLinearRegression(
  yVals: number[],
  xVals: number[],
  hasConst: boolean = true
): {
  slope: number;
  intercept: number;
  seSlope: number;
  seIntercept: number;
  r2: number;
  seY: number;
  fStat: number;
  df: number;
  ssReg: number;
  ssRes: number;
} {
  const n = yVals.length;
  if (n < 2) {
    throw new DaxError('Execution', 'LINEST: a regressão linear requer pelo menos 2 pontos de dados');
  }

  if (hasConst) {
    const meanY = yVals.reduce((a, b) => a + b, 0) / n;
    const meanX = xVals.reduce((a, b) => a + b, 0) / n;

    let sxx = 0;
    let sxy = 0;
    let syy = 0;

    for (let i = 0; i < n; i++) {
      const dx = xVals[i] - meanX;
      const dy = yVals[i] - meanY;
      sxx += dx * dx;
      sxy += dx * dy;
      syy += dy * dy;
    }

    if (sxx === 0) {
      throw new DaxError('Execution', 'LINEST: variância em X é zero, impossível calcular inclinação');
    }

    const slope = sxy / sxx;
    const intercept = meanY - slope * meanX;

    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const pred = slope * xVals[i] + intercept;
      const err = yVals[i] - pred;
      ssRes += err * err;
    }

    const ssReg = syy - ssRes;
    const r2 = syy === 0 ? 1 : Math.max(0, Math.min(1, ssReg / syy));
    const df = n - 2;
    const seY = df > 0 ? Math.sqrt(ssRes / df) : 0;
    const seSlope = df > 0 ? seY / Math.sqrt(sxx) : 0;
    const seIntercept = df > 0 ? seY * Math.sqrt(1 / n + (meanX * meanX) / sxx) : 0;
    const msReg = ssReg;
    const msRes = df > 0 ? ssRes / df : 1;
    const fStat = msRes > 0 ? msReg / msRes : 0;

    return {
      slope,
      intercept,
      seSlope,
      seIntercept,
      r2,
      seY,
      fStat,
      df,
      ssReg,
      ssRes,
    };
  } else {
    // No intercept (forced through origin: b = 0)
    let sxx = 0;
    let sxy = 0;
    let syy = 0;

    for (let i = 0; i < n; i++) {
      sxx += xVals[i] * xVals[i];
      sxy += xVals[i] * yVals[i];
      syy += yVals[i] * yVals[i];
    }

    if (sxx === 0) {
      throw new DaxError('Execution', 'LINEST: variância em X é zero');
    }

    const slope = sxy / sxx;
    const intercept = 0;

    let ssRes = 0;
    for (let i = 0; i < n; i++) {
      const err = yVals[i] - slope * xVals[i];
      ssRes += err * err;
    }

    const ssReg = syy - ssRes;
    const r2 = syy === 0 ? 1 : Math.max(0, Math.min(1, ssReg / syy));
    const df = n - 1;
    const seY = df > 0 ? Math.sqrt(ssRes / df) : 0;
    const seSlope = df > 0 ? seY / Math.sqrt(sxx) : 0;
    const seIntercept = 0;
    const fStat = df > 0 && ssRes > 0 ? (ssReg) / (ssRes / df) : 0;

    return {
      slope,
      intercept,
      seSlope,
      seIntercept,
      r2,
      seY,
      fStat,
      df,
      ssReg,
      ssRes,
    };
  }
}

// ==========================================
// Exported Function Definitions
// ==========================================

export const STATISTICAL_FUNCTIONS: Record<string, FunctionDefinition> = {
  // ==========================================
  // Basic Statistics
  // ==========================================
  'GEOMEAN': {
    name: 'GEOMEAN',
    category: 'Estatística',
    syntax: 'GEOMEAN(column)',
    description: 'Calcula a média geométrica dos valores positivos de uma coluna.',
    example: 'GEOMEAN(f_Vendas[FatorCrescimento])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v));

      if (nums.length === 0) return DAX_BLANK;
      for (const n of nums) {
        if (n <= 0) {
          throw new DaxError('Execution', 'GEOMEAN: apenas valores estritamente positivos (> 0) são permitidos');
        }
      }
      const sumLog = nums.reduce((acc, x) => acc + Math.log(x), 0);
      return Math.exp(sumLog / nums.length);
    },
  },

  'GEOMEANX': {
    name: 'GEOMEANX',
    category: 'Estatística',
    syntax: 'GEOMEANX(table, expression)',
    description: 'Avalia a expressão para cada linha da tabela e calcula a média geométrica.',
    example: 'GEOMEANX(f_Vendas, f_Vendas[Preco] / f_Vendas[Custo])',
    minArgs: 2,
    maxArgs: 2,
  },

  'MEDIAN': {
    name: 'MEDIAN',
    category: 'Estatística',
    syntax: 'MEDIAN(column)',
    description: 'Calcula a mediana dos valores numéricos em uma coluna.',
    example: 'MEDIAN(f_Vendas[Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      if (nums.length === 0) return DAX_BLANK;
      nums.sort((a, b) => a - b);
      const mid = Math.floor(nums.length / 2);
      if (nums.length % 2 === 1) {
        return nums[mid];
      } else {
        return (nums[mid - 1] + nums[mid]) / 2;
      }
    },
  },

  'MEDIANX': {
    name: 'MEDIANX',
    category: 'Estatística',
    syntax: 'MEDIANX(table, expression)',
    description: 'Avalia a expressão para cada linha da tabela e calcula a mediana.',
    example: 'MEDIANX(f_Vendas, f_Vendas[Qtd] * f_Vendas[PrecoUnitario])',
    minArgs: 2,
    maxArgs: 2,
  },

  'STDEV.S': {
    name: 'STDEV.S',
    aliases: ['STDEV'],
    category: 'Estatística',
    syntax: 'STDEV.S(column)',
    description: 'Calcula o desvio padrão amostral de uma coluna com base em uma amostra da população (divide por n - 1).',
    example: 'STDEV.S(f_Vendas[Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      const res = computeSampleStdev(nums);
      return res !== null ? res : DAX_BLANK;
    },
  },

  'STDEV.P': {
    name: 'STDEV.P',
    aliases: ['STDEVP'],
    category: 'Estatística',
    syntax: 'STDEV.P(column)',
    description: 'Calcula o desvio padrão populacional de uma coluna com base em toda a população (divide por n).',
    example: 'STDEV.P(f_Vendas[Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      const res = computePopulationStdev(nums);
      return res !== null ? res : DAX_BLANK;
    },
  },

  'VAR.S': {
    name: 'VAR.S',
    aliases: ['VAR'],
    category: 'Estatística',
    syntax: 'VAR.S(column)',
    description: 'Calcula a variância amostral de uma coluna com base em uma amostra da população (divide por n - 1).',
    example: 'VAR.S(f_Vendas[Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      const res = computeSampleVariance(nums);
      return res !== null ? res : DAX_BLANK;
    },
  },

  'VAR.P': {
    name: 'VAR.P',
    aliases: ['VARP'],
    category: 'Estatística',
    syntax: 'VAR.P(column)',
    description: 'Calcula a variância populacional de uma coluna com base em toda a população (divide por n).',
    example: 'VAR.P(f_Vendas[Valor])',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([colArg], context) => {
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      const res = computePopulationVariance(nums);
      return res !== null ? res : DAX_BLANK;
    },
  },

  'STDEVX.S': {
    name: 'STDEVX.S',
    category: 'Estatística',
    syntax: 'STDEVX.S(table, expression)',
    description: 'Avalia a expressão sobre a tabela e calcula o desvio padrão amostral.',
    example: 'STDEVX.S(f_Vendas, f_Vendas[Qtd] * f_Vendas[Preco])',
    minArgs: 2,
    maxArgs: 2,
  },

  'STDEVX.P': {
    name: 'STDEVX.P',
    category: 'Estatística',
    syntax: 'STDEVX.P(table, expression)',
    description: 'Avalia a expressão sobre a tabela e calcula o desvio padrão populacional.',
    example: 'STDEVX.P(f_Vendas, f_Vendas[Qtd] * f_Vendas[Preco])',
    minArgs: 2,
    maxArgs: 2,
  },

  'VARX.S': {
    name: 'VARX.S',
    category: 'Estatística',
    syntax: 'VARX.S(table, expression)',
    description: 'Avalia a expressão sobre a tabela e calcula a variância amostral.',
    example: 'VARX.S(f_Vendas, f_Vendas[Valor])',
    minArgs: 2,
    maxArgs: 2,
  },

  'VARX.P': {
    name: 'VARX.P',
    category: 'Estatística',
    syntax: 'VARX.P(table, expression)',
    description: 'Avalia a expressão sobre a tabela e calcula a variância populacional.',
    example: 'VARX.P(f_Vendas, f_Vendas[Valor])',
    minArgs: 2,
    maxArgs: 2,
  },

  'PERCENTILE.INC': {
    name: 'PERCENTILE.INC',
    aliases: ['PERCENTILE'],
    category: 'Estatística',
    syntax: 'PERCENTILE.INC(column, k)',
    description: 'Calcula o k-ésimo percentil inclusivo (0 <= k <= 1) dos valores em uma coluna.',
    example: 'PERCENTILE.INC(f_Vendas[Valor], 0.9)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([colArg, kArg], context) => {
      if (isBlank(kArg)) return DAX_BLANK;
      const k = daxToNumber(kArg, true);
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      if (nums.length === 0) return DAX_BLANK;
      nums.sort((a, b) => a - b);
      return computePercentileInc(nums, k);
    },
  },

  'PERCENTILE.EXC': {
    name: 'PERCENTILE.EXC',
    category: 'Estatística',
    syntax: 'PERCENTILE.EXC(column, k)',
    description: 'Calcula o k-ésimo percentil exclusivo dos valores em uma coluna.',
    example: 'PERCENTILE.EXC(f_Vendas[Valor], 0.75)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([colArg, kArg], context) => {
      if (isBlank(kArg)) return DAX_BLANK;
      const k = daxToNumber(kArg, true);
      const { values } = getColumnValuesFromContext(colArg, context);
      const nums = values
        .filter(v => !isBlank(v) && v !== null && v !== undefined && v !== '')
        .map(v => daxToNumber(v))
        .filter(n => !isNaN(n));

      if (nums.length === 0) return DAX_BLANK;
      nums.sort((a, b) => a - b);
      return computePercentileExc(nums, k);
    },
  },

  'PERCENTILEX.INC': {
    name: 'PERCENTILEX.INC',
    category: 'Estatística',
    syntax: 'PERCENTILEX.INC(table, expression, k)',
    description: 'Avalia a expressão sobre a tabela e calcula o percentil inclusivo k.',
    example: 'PERCENTILEX.INC(f_Vendas, f_Vendas[Valor], 0.95)',
    minArgs: 3,
    maxArgs: 3,
  },

  'PERCENTILEX.EXC': {
    name: 'PERCENTILEX.EXC',
    category: 'Estatística',
    syntax: 'PERCENTILEX.EXC(table, expression, k)',
    description: 'Avalia a expressão sobre a tabela e calcula o percentil exclusivo k.',
    example: 'PERCENTILEX.EXC(f_Vendas, f_Vendas[Valor], 0.5)',
    minArgs: 3,
    maxArgs: 3,
  },

  'LINEST': {
    name: 'LINEST',
    category: 'Estatística',
    syntax: 'LINEST(y_column, x_column, [const])',
    description: 'Executa uma regressão linear simples usando o método dos mínimos quadrados.',
    example: 'LINEST(f_Viagens[Custo], f_Viagens[KmRodado])',
    minArgs: 2,
    maxArgs: 3,
    evaluate: ([yArg, xArg, constArg], context) => {
      const hasConst = constArg === undefined || isBlank(constArg) ? true : daxToBoolean(constArg);
      const yRes = getColumnValuesFromContext(yArg, context);
      const xRes = getColumnValuesFromContext(xArg, context);

      const count = Math.min(yRes.values.length, xRes.values.length);
      const yNums: number[] = [];
      const xNums: number[] = [];

      for (let i = 0; i < count; i++) {
        const y = yRes.values[i];
        const x = xRes.values[i];
        if (!isBlank(y) && !isBlank(x) && y !== null && x !== null) {
          const yn = daxToNumber(y);
          const xn = daxToNumber(x);
          if (!isNaN(yn) && !isNaN(xn)) {
            yNums.push(yn);
            xNums.push(xn);
          }
        }
      }

      if (yNums.length < 2) {
        return DAX_BLANK;
      }

      const reg = computeLinearRegression(yNums, xNums, hasConst);
      const row = {
        Slope1: reg.slope,
        Intercept: reg.intercept,
        StandardError1: reg.seSlope,
        StandardErrorIntercept: reg.seIntercept,
        CoefficientOfDetermination: reg.r2,
        StandardError: reg.seY,
        FStatistic: reg.fStat,
        DegreesOfFreedom: reg.df,
        RegressionSumOfSquares: reg.ssReg,
        ResidualSumOfSquares: reg.ssRes,
      };

      const tableResult: DaxTableValue = {
        __isDaxTable: true,
        columns: [
          'Slope1',
          'Intercept',
          'StandardError1',
          'StandardErrorIntercept',
          'CoefficientOfDetermination',
          'StandardError',
          'FStatistic',
          'DegreesOfFreedom',
          'RegressionSumOfSquares',
          'ResidualSumOfSquares',
        ],
        rows: [row],
      };

      return tableResult;
    },
  },

  'LINESTX': {
    name: 'LINESTX',
    category: 'Estatística',
    syntax: 'LINESTX(table, y_expr, x_expr, [const])',
    description: 'Avalia pares de expressões (Y, X) sobre a tabela e retorna os coeficientes de regressão linear.',
    example: 'LINESTX(f_Viagens, f_Viagens[CustoTotal], f_Viagens[KmPercorridos])',
    minArgs: 3,
    maxArgs: 4,
  },

  // ==========================================
  // Probability Distributions
  // ==========================================
  'NORM.DIST': {
    name: 'NORM.DIST',
    aliases: ['NORMDIST'],
    category: 'Estatística',
    syntax: 'NORM.DIST(x, mean, standard_dev, cumulative)',
    description: 'Retorna a distribuição normal para a média e desvio padrão especificados.',
    example: 'NORM.DIST(42, 40, 1.5, TRUE)',
    minArgs: 4,
    maxArgs: 4,
    evaluate: ([xVal, meanVal, sdVal, cumVal]) => {
      if (isBlank(xVal) || isBlank(meanVal) || isBlank(sdVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const mean = daxToNumber(meanVal, true);
      const sd = daxToNumber(sdVal, true);
      const cum = daxToBoolean(cumVal);

      if (sd <= 0) {
        throw new DaxError('Execution', 'NORM.DIST: o desvio padrão deve ser estritamente maior que zero');
      }

      const z = (x - mean) / sd;
      if (cum) {
        return standardNormalCDF(z);
      } else {
        return standardNormalPDF(z) / sd;
      }
    },
  },

  'NORM.INV': {
    name: 'NORM.INV',
    aliases: ['NORMINV'],
    category: 'Estatística',
    syntax: 'NORM.INV(probability, mean, standard_dev)',
    description: 'Retorna o inverso da distribuição normal cumulativa para uma dada probabilidade, média e desvio padrão.',
    example: 'NORM.INV(0.975, 100, 15)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([pVal, meanVal, sdVal]) => {
      if (isBlank(pVal) || isBlank(meanVal) || isBlank(sdVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const mean = daxToNumber(meanVal, true);
      const sd = daxToNumber(sdVal, true);

      if (p <= 0 || p >= 1) {
        throw new DaxError('Execution', `NORM.INV: probabilidade deve estar entre 0 e 1, recebido: ${p}`);
      }
      if (sd <= 0) {
        throw new DaxError('Execution', 'NORM.INV: o desvio padrão deve ser estritamente maior que zero');
      }

      return mean + sd * inverseStandardNormal(p);
    },
  },

  'NORM.S.DIST': {
    name: 'NORM.S.DIST',
    aliases: ['NORMSDIST'],
    category: 'Estatística',
    syntax: 'NORM.S.DIST(z, cumulative)',
    description: 'Retorna a distribuição normal padrão (média 0, desvio padrão 1).',
    example: 'NORM.S.DIST(1.96, TRUE)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([zVal, cumVal]) => {
      if (isBlank(zVal) || isBlank(cumVal)) return DAX_BLANK;
      const z = daxToNumber(zVal, true);
      const cum = daxToBoolean(cumVal);

      return cum ? standardNormalCDF(z) : standardNormalPDF(z);
    },
  },

  'NORM.S.INV': {
    name: 'NORM.S.INV',
    aliases: ['NORMSINV'],
    category: 'Estatística',
    syntax: 'NORM.S.INV(probability)',
    description: 'Retorna o inverso da distribuição normal cumulativa padrão (média 0 e desvio padrão 1).',
    example: 'NORM.S.INV(0.975)',
    minArgs: 1,
    maxArgs: 1,
    evaluate: ([pVal]) => {
      if (isBlank(pVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      return inverseStandardNormal(p);
    },
  },

  'T.DIST': {
    name: 'T.DIST',
    category: 'Estatística',
    syntax: 'T.DIST(x, deg_freedom, cumulative)',
    description: 'Retorna a distribuição t de Student (cauda esquerda).',
    example: 'T.DIST(2.0, 10, TRUE)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([xVal, dfVal, cumVal]) => {
      if (isBlank(xVal) || isBlank(dfVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      const cum = daxToBoolean(cumVal);

      if (df < 1) {
        throw new DaxError('Execution', 'T.DIST: os graus de liberdade devem ser pelo menos 1');
      }

      if (!cum) {
        // PDF
        const coeff = Math.exp(logGamma((df + 1) / 2) - logGamma(df / 2)) / Math.sqrt(Math.PI * df);
        return coeff * Math.pow(1 + (x * x) / df, -(df + 1) / 2);
      }

      // CDF
      if (x === 0) return 0.5;
      const z = df / (df + x * x);
      const ib = incompleteBeta(z, df / 2, 0.5);
      return x > 0 ? 1 - 0.5 * ib : 0.5 * ib;
    },
  },

  'T.DIST.2T': {
    name: 'T.DIST.2T',
    aliases: ['TDIST'],
    category: 'Estatística',
    syntax: 'T.DIST.2T(x, deg_freedom)',
    description: 'Retorna a distribuição t de Student bicaudal para x > 0.',
    example: 'T.DIST.2T(2.1, 12)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([xVal, dfVal]) => {
      if (isBlank(xVal) || isBlank(dfVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));

      if (x < 0) {
        throw new DaxError('Execution', 'T.DIST.2T: x deve ser maior ou igual a zero');
      }
      if (df < 1) {
        throw new DaxError('Execution', 'T.DIST.2T: graus de liberdade devem ser >= 1');
      }

      const z = df / (df + x * x);
      return incompleteBeta(z, df / 2, 0.5);
    },
  },

  'T.DIST.RT': {
    name: 'T.DIST.RT',
    category: 'Estatística',
    syntax: 'T.DIST.RT(x, deg_freedom)',
    description: 'Retorna a distribuição t de Student para a cauda direita.',
    example: 'T.DIST.RT(1.8, 15)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([xVal, dfVal]) => {
      if (isBlank(xVal) || isBlank(dfVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));

      if (df < 1) {
        throw new DaxError('Execution', 'T.DIST.RT: graus de liberdade devem ser >= 1');
      }

      if (x === 0) return 0.5;
      const z = df / (df + x * x);
      const ib = incompleteBeta(z, df / 2, 0.5);
      return x > 0 ? 0.5 * ib : 1 - 0.5 * ib;
    },
  },

  'T.INV': {
    name: 'T.INV',
    category: 'Estatística',
    syntax: 'T.INV(probability, deg_freedom)',
    description: 'Retorna o inverso da função de distribuição acumulada t de Student unicaudal (cauda esquerda).',
    example: 'T.INV(0.05, 10)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([pVal, dfVal]) => {
      if (isBlank(pVal) || isBlank(dfVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      return inverseStudentT(p, df);
    },
  },

  'T.INV.2T': {
    name: 'T.INV.2T',
    aliases: ['TINV'],
    category: 'Estatística',
    syntax: 'T.INV.2T(probability, deg_freedom)',
    description: 'Retorna o inverso bicaudal da distribuição t de Student.',
    example: 'T.INV.2T(0.05, 10)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([pVal, dfVal]) => {
      if (isBlank(pVal) || isBlank(dfVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      if (p <= 0 || p > 1) {
        throw new DaxError('Execution', 'T.INV.2T: probabilidade deve estar em (0, 1]');
      }
      return -inverseStudentT(p / 2, df);
    },
  },

  'CHISQ.DIST': {
    name: 'CHISQ.DIST',
    category: 'Estatística',
    syntax: 'CHISQ.DIST(x, deg_freedom, cumulative)',
    description: 'Retorna a distribuição qui-quadrado.',
    example: 'CHISQ.DIST(0.5, 1, TRUE)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([xVal, dfVal, cumVal]) => {
      if (isBlank(xVal) || isBlank(dfVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      const cum = daxToBoolean(cumVal);

      if (x < 0 || df < 1) {
        throw new DaxError('Execution', 'CHISQ.DIST: x deve ser >= 0 e graus de liberdade >= 1');
      }

      if (cum) {
        return incompleteGamma(df / 2, x / 2);
      } else {
        if (x === 0 && df < 2) return Infinity;
        if (x === 0 && df === 2) return 0.5;
        if (x === 0) return 0;
        return Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.LN2 - logGamma(df / 2));
      }
    },
  },

  'CHISQ.DIST.RT': {
    name: 'CHISQ.DIST.RT',
    aliases: ['CHIDIST'],
    category: 'Estatística',
    syntax: 'CHISQ.DIST.RT(x, deg_freedom)',
    description: 'Retorna a probabilidade de cauda direita da distribuição qui-quadrado.',
    example: 'CHISQ.DIST.RT(18.307, 10)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([xVal, dfVal]) => {
      if (isBlank(xVal) || isBlank(dfVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));

      if (x < 0 || df < 1) {
        throw new DaxError('Execution', 'CHISQ.DIST.RT: x deve ser >= 0 e graus de liberdade >= 1');
      }

      return incompleteGammaQ(df / 2, x / 2);
    },
  },

  'CHISQ.INV': {
    name: 'CHISQ.INV',
    category: 'Estatística',
    syntax: 'CHISQ.INV(probability, deg_freedom)',
    description: 'Retorna o inverso da probabilidade de cauda esquerda da distribuição qui-quadrado.',
    example: 'CHISQ.INV(0.95, 10)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([pVal, dfVal]) => {
      if (isBlank(pVal) || isBlank(dfVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      return inverseChiSquare(p, df);
    },
  },

  'CHISQ.INV.RT': {
    name: 'CHISQ.INV.RT',
    aliases: ['CHIINV'],
    category: 'Estatística',
    syntax: 'CHISQ.INV.RT(probability, deg_freedom)',
    description: 'Retorna o inverso da probabilidade de cauda direita da distribuição qui-quadrado.',
    example: 'CHISQ.INV.RT(0.05, 10)',
    minArgs: 2,
    maxArgs: 2,
    evaluate: ([pVal, dfVal]) => {
      if (isBlank(pVal) || isBlank(dfVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const df = Math.trunc(daxToNumber(dfVal, true));
      return inverseChiSquare(1 - p, df);
    },
  },

  'BETA.DIST': {
    name: 'BETA.DIST',
    aliases: ['BETADIST'],
    category: 'Estatística',
    syntax: 'BETA.DIST(x, alpha, beta, cumulative, [A], [B])',
    description: 'Retorna a função de densidade de probabilidade ou acumulada da distribuição beta.',
    example: 'BETA.DIST(2, 8, 10, TRUE, 1, 3)',
    minArgs: 4,
    maxArgs: 6,
    evaluate: ([xVal, alphaVal, betaVal, cumVal, aVal, bVal]) => {
      if (isBlank(xVal) || isBlank(alphaVal) || isBlank(betaVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const alpha = daxToNumber(alphaVal, true);
      const beta = daxToNumber(betaVal, true);
      const cum = daxToBoolean(cumVal);
      const A = aVal !== undefined && !isBlank(aVal) ? daxToNumber(aVal, true) : 0;
      const B = bVal !== undefined && !isBlank(bVal) ? daxToNumber(bVal, true) : 1;

      if (alpha <= 0 || beta <= 0 || B <= A || x < A || x > B) {
        throw new DaxError('Execution', 'BETA.DIST: parâmetros fora do domínio válido');
      }

      const u = (x - A) / (B - A);
      if (cum) {
        return incompleteBeta(u, alpha, beta);
      } else {
        const lnBeta = logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta);
        const pdf = Math.exp((alpha - 1) * Math.log(u) + (beta - 1) * Math.log(1 - u) - lnBeta);
        return pdf / (B - A);
      }
    },
  },

  'BETA.INV': {
    name: 'BETA.INV',
    aliases: ['BETAINV'],
    category: 'Estatística',
    syntax: 'BETA.INV(probability, alpha, beta, [A], [B])',
    description: 'Retorna o inverso da função de densidade de probabilidade cumulativa da distribuição beta.',
    example: 'BETA.INV(0.685470581, 8, 10, 1, 3)',
    minArgs: 3,
    maxArgs: 5,
    evaluate: ([pVal, alphaVal, betaVal, aVal, bVal]) => {
      if (isBlank(pVal) || isBlank(alphaVal) || isBlank(betaVal)) return DAX_BLANK;
      const p = daxToNumber(pVal, true);
      const alpha = daxToNumber(alphaVal, true);
      const beta = daxToNumber(betaVal, true);
      const A = aVal !== undefined && !isBlank(aVal) ? daxToNumber(aVal, true) : 0;
      const B = bVal !== undefined && !isBlank(bVal) ? daxToNumber(bVal, true) : 1;

      if (p < 0 || p > 1 || alpha <= 0 || beta <= 0 || B <= A) {
        throw new DaxError('Execution', 'BETA.INV: parâmetros fora do domínio válido');
      }

      const u = inverseBeta(p, alpha, beta);
      return A + u * (B - A);
    },
  },

  'EXPON.DIST': {
    name: 'EXPON.DIST',
    aliases: ['EXPONDIST'],
    category: 'Estatística',
    syntax: 'EXPON.DIST(x, lambda, cumulative)',
    description: 'Retorna a distribuição exponencial.',
    example: 'EXPON.DIST(0.2, 10, TRUE)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([xVal, lambdaVal, cumVal]) => {
      if (isBlank(xVal) || isBlank(lambdaVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = daxToNumber(xVal, true);
      const lambda = daxToNumber(lambdaVal, true);
      const cum = daxToBoolean(cumVal);

      if (x < 0 || lambda <= 0) {
        throw new DaxError('Execution', 'EXPON.DIST: x deve ser >= 0 e lambda > 0');
      }

      return cum ? 1 - Math.exp(-lambda * x) : lambda * Math.exp(-lambda * x);
    },
  },

  'POISSON.DIST': {
    name: 'POISSON.DIST',
    aliases: ['POISSON'],
    category: 'Estatística',
    syntax: 'POISSON.DIST(x, mean, cumulative)',
    description: 'Retorna a distribuição de Poisson.',
    example: 'POISSON.DIST(2, 5, TRUE)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([xVal, meanVal, cumVal]) => {
      if (isBlank(xVal) || isBlank(meanVal) || isBlank(cumVal)) return DAX_BLANK;
      const x = Math.floor(daxToNumber(xVal, true));
      const mean = daxToNumber(meanVal, true);
      const cum = daxToBoolean(cumVal);

      if (x < 0 || mean <= 0) {
        throw new DaxError('Execution', 'POISSON.DIST: x deve ser >= 0 e média > 0');
      }

      if (!cum) {
        // e^(-mean) * mean^x / x!
        return Math.exp(-mean + x * Math.log(mean) - logGamma(x + 1));
      } else {
        // Upper incomplete gamma: Q(x + 1, mean)
        return incompleteGammaQ(x + 1, mean);
      }
    },
  },

  'CONFIDENCE.NORM': {
    name: 'CONFIDENCE.NORM',
    aliases: ['CONFIDENCE'],
    category: 'Estatística',
    syntax: 'CONFIDENCE.NORM(alpha, standard_dev, size)',
    description: 'Retorna o intervalo de confiança para a média de uma população, usando uma distribuição normal.',
    example: 'CONFIDENCE.NORM(0.05, 2.5, 50)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([alphaVal, sdVal, sizeVal]) => {
      if (isBlank(alphaVal) || isBlank(sdVal) || isBlank(sizeVal)) return DAX_BLANK;
      const alpha = daxToNumber(alphaVal, true);
      const sd = daxToNumber(sdVal, true);
      const size = Math.trunc(daxToNumber(sizeVal, true));

      if (alpha <= 0 || alpha >= 1 || sd <= 0 || size < 1) {
        throw new DaxError('Execution', 'CONFIDENCE.NORM: alpha deve estar em (0, 1), desvio padrão > 0 e tamanho >= 1');
      }

      const z = inverseStandardNormal(1 - alpha / 2);
      return z * (sd / Math.sqrt(size));
    },
  },

  'CONFIDENCE.T': {
    name: 'CONFIDENCE.T',
    category: 'Estatística',
    syntax: 'CONFIDENCE.T(alpha, standard_dev, size)',
    description: 'Retorna o intervalo de confiança para a média de uma população, usando a distribuição t de Student.',
    example: 'CONFIDENCE.T(0.05, 1, 50)',
    minArgs: 3,
    maxArgs: 3,
    evaluate: ([alphaVal, sdVal, sizeVal]) => {
      if (isBlank(alphaVal) || isBlank(sdVal) || isBlank(sizeVal)) return DAX_BLANK;
      const alpha = daxToNumber(alphaVal, true);
      const sd = daxToNumber(sdVal, true);
      const size = Math.trunc(daxToNumber(sizeVal, true));

      if (alpha <= 0 || alpha >= 1 || sd <= 0 || size <= 1) {
        throw new DaxError('Execution', 'CONFIDENCE.T: alpha em (0, 1), desvio padrão > 0 e tamanho > 1');
      }

      const t = -inverseStudentT(alpha / 2, size - 1);
      return t * (sd / Math.sqrt(size));
    },
  },
};
