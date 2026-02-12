import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in EUR
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/**
 * Format date in German format (DD.MM.YYYY)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('de-DE').format(d);
}

/**
 * Format datetime in German format (DD.MM.YYYY HH:MM)
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Calculate days until a date
 */
export function daysUntil(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = d.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get status color based on days until expiration
 */
export function getExpirationStatus(daysUntilExpiration: number): {
  status: 'valid' | 'warning' | 'critical' | 'expired';
  color: string;
  bgColor: string;
} {
  if (daysUntilExpiration < 0) {
    return { status: 'expired', color: 'text-red-700', bgColor: 'bg-red-100' };
  } else if (daysUntilExpiration <= 29) {
    return { status: 'critical', color: 'text-orange-700', bgColor: 'bg-orange-100' };
  } else if (daysUntilExpiration <= 90) {
    return { status: 'warning', color: 'text-yellow-700', bgColor: 'bg-yellow-100' };
  } else {
    return { status: 'valid', color: 'text-green-700', bgColor: 'bg-green-100' };
  }
}
