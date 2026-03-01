export const adminNavigation = [
  { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
  { to: '/admin/users', label: 'User Management', icon: 'user' },
  { to: '/admin/content', label: 'Content', icon: 'sparkles' },
  { to: '/admin/sliders', label: 'Sliders', icon: 'star' },
  { to: '/admin/revenue', label: 'Revenue', icon: 'payments' },
  { to: '/admin/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/signals', label: 'Signals', icon: 'signal' },
  { to: '/tips', label: 'Tips', icon: 'tips' },
  { to: '/testimonials', label: 'Testimonials', icon: 'message' },
];

export const getAdminNavItems = (role) => {
  const normalized = String(role || '').toLowerCase();
  if (normalized !== 'trader_admin') {
    return adminNavigation;
  }
  return adminNavigation.filter((item) => !['/admin/users', '/admin/sliders'].includes(item.to));
};
