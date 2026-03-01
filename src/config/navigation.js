export const memberNavigation = [
  { to: '/', label: 'Dashboard', icon: 'home', end: true },
  { to: '/signals', label: 'Signals', icon: 'signal' },
  { to: '/sessions', label: 'Sessions', icon: 'clock' },
  { to: '/tips', label: 'Tips', icon: 'tips' },
  { to: '/upgrade', label: 'Upgrade', icon: 'upgrade' },
];

export const traderAdminNavigation = [
  { to: '/signals', label: 'Signals', icon: 'signal', end: true },
  { to: '/sessions', label: 'Sessions', icon: 'clock' },
  { to: '/tips', label: 'Tips', icon: 'tips' },
];

export const appRoutes = [
  {
    path: '/',
    section: 'dashboard',
    title: 'Dashboard',
    description: 'Overview, activity, and quick actions',
  },
  {
    path: '/signals',
    section: 'signals',
    title: 'Signals',
    description: 'Live setups across sessions and instruments',
  },
  {
    path: '/sessions',
    section: 'sessions',
    title: 'Sessions',
    description: 'Live session board, overlaps, and trading windows',
  },
  {
    path: '/tips',
    section: 'tips',
    title: 'Trader Tips',
    description: 'Actionable lessons and market context',
  },
  {
    path: '/upgrade',
    section: 'upgrade',
    title: 'Premium',
    description: 'Membership, checkout, and payment status',
  },
];
