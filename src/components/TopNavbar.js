import './TopNavbar.css';
import { NavLink } from 'react-router-dom';

const TopNavbar = ({ onSignOut, onToggleTheme, theme = 'dark' }) => {
  const nextThemeLabel =
    theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode';

  return (
    <header className={`top-navbar ${theme === 'light' ? 'is-light' : 'is-dark'}`}>
      <NavLink className="top-navbar-brand" to="/">
        <span className="top-navbar-mark" aria-hidden="true">
          ↗
        </span>
        <span>pastatrade</span>
      </NavLink>

      <nav className="top-navbar-nav" aria-label="Primary">
        <NavLink
          className={({ isActive }) => `top-navbar-link ${isActive ? 'is-active' : ''}`.trim()}
          to="/"
        >
          Home
        </NavLink>
        <NavLink
          className={({ isActive }) => `top-navbar-link ${isActive ? 'is-active' : ''}`.trim()}
          to="/signals"
        >
          Signals
        </NavLink>
        <NavLink
          className={({ isActive }) => `top-navbar-link ${isActive ? 'is-active' : ''}`.trim()}
          to="/tips"
        >
          Tips
        </NavLink>
        <button className="top-navbar-link is-muted" type="button">
          News
        </button>
      </nav>

      <div className="top-navbar-actions">
        <button
          className="top-navbar-icon"
          type="button"
          aria-label={nextThemeLabel}
          title={nextThemeLabel}
          onClick={onToggleTheme}
        >
          <TopIcon type={theme === 'light' ? 'moon' : 'sun'} />
        </button>
        <button className="top-navbar-icon" type="button" aria-label="Search">
          <TopIcon type="search" />
        </button>
        <button className="top-navbar-icon" type="button" aria-label="Notifications">
          <TopIcon type="bell" />
        </button>
        <button className="top-navbar-icon" type="button" aria-label="Settings">
          <TopIcon type="settings" />
        </button>
        <button className="top-navbar-signout" onClick={onSignOut} type="button">
          <TopIcon type="user" />
          <span>Sign out</span>
        </button>
      </div>
    </header>
  );
};

const TopIcon = ({ type }) => {
  if (type === 'sun') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
      </svg>
    );
  }
  if (type === 'moon') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8z" />
      </svg>
    );
  }
  if (type === 'search') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="6.5" />
        <line x1="16" y1="16" x2="21" y2="21" />
      </svg>
    );
  }
  if (type === 'bell') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 9a6 6 0 1 1 12 0v5l2 2H4l2-2z" />
        <path d="M10 18a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (type === 'settings') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  );
};

export default TopNavbar;
