import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import AppIcon from '../icons/AppIcon';
import Button from './Button';
import Modal from './Modal';
import SearchBar from './SearchBar';
import { isPremiumActive, normalizeMembership } from '../../utils/membershipHelpers';

const SIDEBAR_COLLAPSE_KEY = 'sokogliank-sidebar-collapsed';

function getInitialSidebarCollapsed() {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1';
}

const AppShell = ({
  pageTitle,
  pageDescription,
  hideTopbarCopyOnMobile = false,
  hideSearchOnMobile = false,
  navItems,
  profile,
  onSignOut,
  theme,
  onToggleTheme,
  searchValue = '',
  onSearchChange,
  topbarActions,
  contentClassName = '',
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1279px)').matches,
  );
  const navigate = useNavigate();
  const premiumActive = isPremiumActive(profile);
  const visibleNavItems = useMemo(
    () => (premiumActive ? navItems.filter((item) => item.to !== '/upgrade') : navItems),
    [navItems, premiumActive],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSE_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(max-width: 1279px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!isMobileViewport && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [isMobileViewport, sidebarOpen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.altKey && event.key === '1' && visibleNavItems[0]) {
        event.preventDefault();
        navigate(visibleNavItems[0].to);
      }
      if (event.altKey && event.key === '2' && visibleNavItems[1]) {
        event.preventDefault();
        navigate(visibleNavItems[1].to);
      }
      if (event.altKey && event.key === '3' && visibleNavItems[2]) {
        event.preventDefault();
        navigate(visibleNavItems[2].to);
      }
      if (event.key === '/' && onSearchChange) {
        event.preventDefault();
        const input = document.getElementById('search-input');
        if (input) {
          input.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onSearchChange, visibleNavItems]);

  const displayName = profile?.displayName || 'Trader';
  const email = profile?.email || '--';
  const role = String(profile?.role || 'member');
  const membership = normalizeMembership(profile?.membership, profile?.membershipTier);
  const tier = String(membership.tier || 'free');
  const traderStatus = String(profile?.traderStatus || 'none');
  const avatarUrl = String(profile?.avatarUrl || '').trim();
  const membershipValidUntil = formatMembershipValidUntil(
    membership.expiresAt,
    profile?.premiumFallbackExpiresAt,
  );
  const handleNavToggle = () => {
    if (isMobileViewport) {
      setSidebarOpen((current) => !current);
      return;
    }
    setSidebarCollapsed((current) => !current);
  };
  const navToggleLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  const mobileNavToggleLabel = sidebarOpen ? 'Close navigation' : 'Open navigation';

  return (
    <div className="app-screen">
      <div className={`app-shell ${sidebarCollapsed ? 'is-collapsed' : ''}`.trim()}>
        <aside className={`app-shell-sidebar ${sidebarOpen ? 'is-open' : ''}`.trim()}>
          <div className="app-shell-sidebar-head">
            <NavLink to="/" className="app-shell-brand" onClick={() => setSidebarOpen(false)}>
              <span className="app-shell-brand-mark">
                <img src="/logo.png" alt="Soko Gliank logo" />
              </span>
              {!sidebarCollapsed ? (
                <span className="app-shell-brand-copy">
                  <p className="app-shell-brand-title">Soko Gliank</p>
                  <p className="app-shell-brand-subtitle">Trader Workspace</p>
                </span>
              ) : null}
            </NavLink>
          </div>

          <nav className="app-shell-nav" aria-label="Sidebar">
            {visibleNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={Boolean(item.end)}
                className={({ isActive }) => `app-shell-nav-link ${isActive ? 'active' : ''}`.trim()}
                onClick={() => setSidebarOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="app-shell-nav-link-label">
                  <AppIcon name={item.icon} size={16} />
                  {!sidebarCollapsed ? <span>{item.label}</span> : null}
                </span>
                {!sidebarCollapsed && item.badge ? <span className="app-shell-chip">{item.badge}</span> : null}
              </NavLink>
            ))}
          </nav>

          <div className="app-shell-bottom">
            <Button variant="secondary" onClick={onSignOut}>
              <AppIcon name="logout" size={16} />
              {!sidebarCollapsed ? 'Sign out' : null}
            </Button>
          </div>
        </aside>
        {isMobileViewport && sidebarOpen ? (
          <button
            type="button"
            className="app-shell-sidebar-backdrop"
            aria-label="Close navigation"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <main className="app-shell-main">
          <header className="app-shell-topbar">
            <div className="app-shell-topbar-left">
              <Button
                className="app-shell-nav-toggle"
                variant="secondary"
                iconOnly
                onClick={handleNavToggle}
                aria-label={isMobileViewport ? mobileNavToggleLabel : navToggleLabel}
                title={isMobileViewport ? mobileNavToggleLabel : navToggleLabel}
              >
                <AppIcon
                  name={
                    isMobileViewport
                      ? (sidebarOpen ? 'close' : 'menu')
                      : (sidebarCollapsed ? 'chevronRight' : 'chevronLeft')
                  }
                />
              </Button>
              <div className={`app-shell-topbar-copy ${hideTopbarCopyOnMobile ? 'mobile-hidden' : ''}`.trim()}>
                <h1 className="ui-card-title">{pageTitle}</h1>
                <p className="ui-card-subtitle">{pageDescription}</p>
              </div>
            </div>

            {onSearchChange ? (
              <div className={`app-shell-topbar-search ${hideSearchOnMobile ? 'mobile-hidden' : ''}`.trim()}>
                <SearchBar
                  value={searchValue}
                  onChange={onSearchChange}
                  placeholder="Search signals, tips, plans..."
                />
              </div>
            ) : <div />}

            <div className="app-shell-topbar-right">
              {topbarActions || null}
              <Button
                variant="secondary"
                iconOnly
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={onToggleTheme}
              >
                <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} />
              </Button>
              <button
                type="button"
                className="app-shell-profile-button"
                onClick={() => setProfileOpen(true)}
                aria-label={`Open profile details for ${displayName}`}
                title={displayName}
              >
                <span className="app-shell-profile-avatar-wrap">
                  <span className={`app-shell-profile-avatar ${avatarUrl ? '' : 'is-fallback'}`.trim()} aria-hidden="true">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : initialsFor(displayName)}
                  </span>
                  {premiumActive ? (
                    <span className="profile-premium-badge" aria-hidden="true">
                      <AppIcon name="crown" size={11} />
                    </span>
                  ) : null}
                </span>
              </button>
            </div>
          </header>

          <div className={`app-shell-content ${contentClassName}`.trim()}>
            {children}
          </div>
        </main>
      </div>

      <Modal
        open={profileOpen}
        title="Profile Details"
        onClose={() => setProfileOpen(false)}
        footer={(
          <Button variant="secondary" onClick={() => setProfileOpen(false)}>
            Close
          </Button>
        )}
      >
        <section className="profile-modal-stack">
          <div className="profile-modal-hero">
            <div className="profile-modal-head">
              <span className="profile-modal-avatar-wrap">
                <span className={`profile-modal-avatar ${avatarUrl ? '' : 'is-fallback'}`.trim()} aria-hidden="true">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : initialsFor(displayName)}
                </span>
                {premiumActive ? (
                  <span className="profile-premium-badge profile-premium-badge-modal" aria-hidden="true">
                    <AppIcon name="crown" size={12} />
                  </span>
                ) : null}
              </span>
              <div>
                <p className="profile-modal-name">{displayName}</p>
                <p className="profile-modal-email">{email}</p>
                <p className="profile-modal-kicker">
                  {premiumActive ? 'Premium access enabled' : 'Member account'}
                </p>
              </div>
            </div>

            <div className="profile-modal-badges">
              <span className="profile-modal-pill">
                <AppIcon name="user" size={13} />
                {humanize(role)}
              </span>
              <span className={`profile-modal-pill ${premiumActive ? 'is-premium' : ''}`.trim()}>
                <AppIcon name={premiumActive ? 'crown' : 'star'} size={13} />
                {premiumActive ? 'Premium Active' : 'Free Plan'}
              </span>
              <span className="profile-modal-pill">
                <AppIcon name="clock" size={13} />
                {membershipValidUntil === '--' ? 'No expiry set' : `Valid until ${membershipValidUntil}`}
              </span>
            </div>
          </div>

          <div className="profile-modal-grid">
            <article className="profile-modal-item">
              <div className="profile-modal-item-head">
                <span className="profile-modal-item-icon"><AppIcon name="user" size={13} /></span>
                <p className="profile-modal-label">Role</p>
              </div>
              <p className="profile-modal-value">{humanize(role)}</p>
            </article>
            <article className="profile-modal-item">
              <div className="profile-modal-item-head">
                <span className="profile-modal-item-icon"><AppIcon name={premiumActive ? 'crown' : 'star'} size={13} /></span>
                <p className="profile-modal-label">Membership</p>
              </div>
              <p className="profile-modal-value">{humanize(tier)}</p>
            </article>
            <article className="profile-modal-item">
              <div className="profile-modal-item-head">
                <span className="profile-modal-item-icon"><AppIcon name="clock" size={13} /></span>
                <p className="profile-modal-label">Membership Valid Until</p>
              </div>
              <p className="profile-modal-value">{membershipValidUntil}</p>
            </article>
            <article className="profile-modal-item">
              <div className="profile-modal-item-head">
                <span className="profile-modal-item-icon"><AppIcon name="signal" size={13} /></span>
                <p className="profile-modal-label">Trader Status</p>
              </div>
              <p className="profile-modal-value">{humanize(traderStatus)}</p>
            </article>
          </div>
        </section>
      </Modal>
    </div>
  );
};

export default AppShell;

function initialsFor(name) {
  const text = String(name || '').trim();
  if (!text) {
    return 'T';
  }
  return text
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '--';
}

function formatMembershipValidUntil(primaryExpiry, fallbackExpiry) {
  const date = toDateValue(primaryExpiry) || toDateValue(fallbackExpiry);
  if (!date) {
    return '--';
  }
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function toDateValue(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }
  const seconds = value.seconds ?? value._seconds;
  const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6));
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}
