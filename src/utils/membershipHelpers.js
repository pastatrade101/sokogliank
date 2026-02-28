import { isAdmin, isTrader } from './roleHelpers';

const toDate = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value.toDate) {
    return value.toDate();
  }
  const seconds = value.seconds ?? value._seconds;
  const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6));
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
};

export const normalizeMembership = (membership = {}, fallbackTier = 'free') => {
  const safe = membership && typeof membership === 'object' ? membership : {};
  return {
    tier: (safe.tier ?? fallbackTier ?? 'free').toString().toLowerCase(),
    status: (safe.status ?? 'inactive').toString().toLowerCase(),
    startedAt: toDate(safe.startedAt),
    expiresAt: toDate(safe.expiresAt),
    source: safe.source ? safe.source.toString() : '',
    trialUsed: safe.trialUsed === true,
  };
};

export const isPremiumActive = (profile) => {
  if (isAdmin(profile?.role) || isTrader(profile?.role)) {
    return true;
  }
  const membership = normalizeMembership(profile?.membership, profile?.membershipTier);
  if (membership.tier !== 'premium' || membership.status !== 'active') {
    const fallbackUntil = toDate(profile?.premiumFallbackExpiresAt);
    return Boolean(fallbackUntil && fallbackUntil.getTime() > Date.now());
  }
  if (!membership.expiresAt) {
    const fallbackUntil = toDate(profile?.premiumFallbackExpiresAt);
    return Boolean(fallbackUntil && fallbackUntil.getTime() > Date.now());
  }
  return membership.expiresAt.getTime() > Date.now();
};
