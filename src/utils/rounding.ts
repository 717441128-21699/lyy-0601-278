import { RoundingMode } from '../types';

export function roundAmount(
  amount: number,
  mode: RoundingMode = 'round',
  precision: number = 2
): number {
  const factor = Math.pow(10, precision);
  const value = amount * factor;
  let result: number;
  switch (mode) {
    case 'floor':
      result = Math.floor(value);
      break;
    case 'ceil':
      result = Math.ceil(value);
      break;
    case 'round':
    default:
      result = Math.round(value);
      break;
  }
  return result / factor;
}

export function sumAmounts(
  amounts: number[],
  mode: RoundingMode = 'round',
  precision: number = 2
): number {
  const sum = amounts.reduce((acc, val) => acc + val, 0);
  return roundAmount(sum, mode, precision);
}
