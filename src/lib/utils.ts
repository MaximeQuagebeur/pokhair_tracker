import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Unit } from './poker/stats';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function formatAmount(value: number, unit: Unit) {
  return unit === 'eur' ? eur.format(value) : `${num.format(value)} bb`;
}

export function formatNumber(value: number | null, digits = 1, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }) + suffix;
}
