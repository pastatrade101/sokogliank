const normalizeRole = (value) => (value ?? '').toString().toLowerCase().trim();

export const isAdmin = (value) => normalizeRole(value) === 'admin';

export const isTraderAdmin = (value) => normalizeRole(value) === 'trader_admin';

export const isAdminOrTraderAdmin = (value) => isAdmin(value) || isTraderAdmin(value);

export const isTrader = (value) => {
  const normalized = normalizeRole(value);
  return normalized === 'trader' || normalized === 'trader_admin';
};

export const isMember = (value) => normalizeRole(value) === 'member';

export const isMemberOrTrader = (value) => isMember(value) || isTrader(value);

export const roleLabel = (value) => {
  const normalized = normalizeRole(value);
  switch (normalized) {
    case 'admin':
      return 'Admin';
    case 'trader_admin':
      return 'Trader Admin';
    case 'trader':
      return 'Trader';
    case 'member':
      return 'Member';
    default:
      return 'Member';
  }
};

export const canSubmitTestimonials = (role, traderStatus) => {
  const normalized = normalizeRole(role);
  if (normalized === 'trader_admin') {
    return true;
  }
  if (normalized === 'trader') {
    return (traderStatus ?? '').toString().toLowerCase() === 'active';
  }
  return false;
};

const roleHelpers = {
  normalizeRole,
  isAdmin,
  isTraderAdmin,
  isAdminOrTraderAdmin,
  isTrader,
  isMember,
  isMemberOrTrader,
  roleLabel,
  canSubmitTestimonials,
};

export default roleHelpers;
