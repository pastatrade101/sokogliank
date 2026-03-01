import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { isMember, isTrader } from '../utils/roleHelpers';
import { AppShell, Breadcrumbs, Card } from './ui';
import { memberNavigation, traderAdminNavigation } from '../config/navigation';
import AppIcon from './icons/AppIcon';
import {
  buildSessions,
  formatCountdown,
  formatSessionTime,
  isWeekend,
  nextOverlap,
} from '../services/sessionsService';

const SessionsPage = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sessions = useMemo(() => buildSessions(now), [now]);
  const overlap = useMemo(() => nextOverlap(now), [now]);
  const navItems = isTrader(profile?.role) ? traderAdminNavigation : memberNavigation;

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading sessions...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMember(profile?.role) && !isTrader(profile?.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="Sessions"
      pageDescription="Live session clock, overlap timing, and market hours in Tanzania"
      navItems={navItems}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: isTrader(profile?.role) ? '/signals' : '/' },
          { label: 'Sessions' },
        ]}
      />

      {overlap ? (
        <section className="sessions-overlap-wrap">
          <article className="sessions-overlap-card">
            <p className="sessions-overlap-kicker">{overlap.title}</p>
            <h2>{overlap.subtitle}</h2>
            <p>{overlap.countdownLabel}</p>
          </article>
        </section>
      ) : null}

      <section className="sessions-page-head">
        <div>
          <p className="sessions-page-kicker">Trading Sessions</p>
          <h2>Session board</h2>
        </div>
        <span className={`status-badge ${isWeekend(now) ? '' : 'live'}`.trim()}>
          {isWeekend(now) ? 'Weekend schedule' : 'Live clock'}
        </span>
      </section>

      <section className="sessions-dashboard-grid">
        {sessions.map((session) => (
          <Card key={session.key} className={`session-status-card is-${session.status}`.trim()} hover>
            <div className="session-status-head">
              <span className="session-status-icon">
                <AppIcon name="chart" size={16} />
              </span>
              <div>
                <p className="session-status-name">{session.name}</p>
                <p className="session-status-type">Session</p>
              </div>
              <span className={`session-status-pill is-${session.status}`.trim()}>
                {session.status === 'open' ? 'OPEN' : (session.status === 'upcoming' ? 'OPENS IN' : 'CLOSED')}
              </span>
            </div>

            <div className="session-status-time-grid">
              <div className="session-time-block">
                <p className="session-time-label">
                  <AppIcon name="clock" size={13} />
                  Opens
                </p>
                <p className="session-time-value">{formatSessionTime(session.opensAt)}</p>
              </div>
              <div className="session-time-block">
                <p className="session-time-label">
                  <AppIcon name="clock" size={13} />
                  Closes
                </p>
                <p className="session-time-value">{formatSessionTime(session.closesAt)}</p>
              </div>
            </div>

            <div className="session-status-countdown">
              <AppIcon name="sparkles" size={15} />
              <span>
                {session.status === 'open'
                  ? `Closes in ${formatCountdown(session.closesIn)}`
                  : `Opens in ${formatCountdown(session.opensIn)}`}
              </span>
            </div>

            {session.status === 'open' ? (
              <div className="session-status-live">
                <span className="session-status-live-dot" />
                Live Trading
              </div>
            ) : null}
          </Card>
        ))}
      </section>

      <Card title="Timezone" subtitle="Matching the Flutter app schedule" hover>
        <p className="ui-card-subtitle">Times shown in Tanzania (Africa/Dar_es_Salaam).</p>
      </Card>
    </AppShell>
  );
};

export default SessionsPage;
