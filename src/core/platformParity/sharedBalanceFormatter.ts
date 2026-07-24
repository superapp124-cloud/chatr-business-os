export const normalizeCoinBalance = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
  }
  return 0;
};

export const formatCoinAmount = (value: unknown): string => {
  return normalizeCoinBalance(value).toLocaleString('en-IN');
};

export const formatCoinBalanceLabel = (value: unknown): string => {
  const amount = normalizeCoinBalance(value);
  return `${amount.toLocaleString('en-IN')} ${amount === 1 ? 'point' : 'points'}`;
};
