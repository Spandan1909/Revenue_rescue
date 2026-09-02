'use client';

export function formatCurrency(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(2) + 'Cr';
  if (amount >= 100000) return '₹' + (amount / 100000).toFixed(2) + 'L';
  if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
  return '₹' + Math.round(amount).toLocaleString('en-IN');
}

export function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
