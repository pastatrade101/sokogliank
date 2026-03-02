import { useEffect, useMemo, useState } from 'react';
import { collection, limit as limitQuery, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { Navigate } from 'react-router-dom';
import { firestore } from '../firebase/init';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { isMember, isTrader } from '../utils/roleHelpers';
import { isPremiumActive } from '../utils/membershipHelpers';
import { useEngagementStore } from '../hooks/useEngagementStore';
import { fetchAnalysisHighlights } from '../services/newsAnalysisService';
import { buildSessions, formatCountdown, formatSessionTime, nextOverlap } from '../services/sessionsService';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  SkeletonLoader,
} from './ui';
import { memberNavigation } from '../config/navigation';
import {
  formatDate,
  isCurrentDay,
  isSignalLive,
  normalizeSignal,
  normalizeTip,
} from '../utils/tradingData';
import AppIcon from './icons/AppIcon';

const HomeShell = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { recentSignals, pinnedTips } = useEngagementStore();
  const [liveSignals, setLiveSignals] = useState([]);
  const [latestTips, setLatestTips] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [loadingTips, setLoadingTips] = useState(true);
  const [analysisCards, setAnalysisCards] = useState([]);
  const [loadingAnalysis, setLoadingAnalysis] = useState(true);
  const [searchValue, setSearchValue] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const signalsQuery = query(collection(firestore, 'signals'), orderBy('createdAt', 'desc'), limitQuery(20));
    const unsubscribeSignals = onSnapshot(
      signalsQuery,
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => normalizeSignal(docSnap.id, docSnap.data())).filter(isSignalLive);
        setLiveSignals(next);
        setLoadingSignals(false);
      },
      () => {
        setLoadingSignals(false);
      },
    );

    const tipsQuery = query(
      collection(firestore, 'trader_tips'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limitQuery(12),
    );

    const unsubscribeTips = onSnapshot(
      tipsQuery,
      (snapshot) => {
        setLatestTips(snapshot.docs.map((docSnap) => normalizeTip(docSnap.id, docSnap.data())));
        setLoadingTips(false);
      },
      () => {
        setLoadingTips(false);
      },
    );

    return () => {
      unsubscribeSignals();
      unsubscribeTips();
    };
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const items = await fetchAnalysisHighlights(4);
        if (active) {
          setAnalysisCards(items);
        }
      } catch (_) {
        if (active) {
          setAnalysisCards([]);
        }
      } finally {
        if (active) {
          setLoadingAnalysis(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const greetingName = profile?.displayName || profile?.email || 'Trader';
  const premiumActive = isPremiumActive(profile);

  const filteredSignals = useMemo(() => {
    const term = searchValue.trim().toLowerCase();
    if (!term) {
      return liveSignals;
    }
    return liveSignals.filter((signal) => {
      const haystack = `${signal.pair} ${signal.summary} ${signal.direction} ${signal.session}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [liveSignals, searchValue]);

  const activeSessions = useMemo(
    () => buildSessions(now).filter((session) => session.status === 'open'),
    [now],
  );
  const sessionOverlap = useMemo(() => nextOverlap(now), [now]);

  const tipsToday = useMemo(() => latestTips.filter((tip) => isCurrentDay(tip.createdAtDate)).length, [latestTips]);
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date()),
    [],
  );

  const nextBestAction = !premiumActive
    ? {
      title: 'Unlock premium execution data',
      description: 'Upgrade to reveal full entry zones, stop losses, and target ladders.',
      buttonLabel: 'Upgrade to Premium',
      to: '/upgrade',
      icon: 'upgrade',
    }
    : {
      title: 'Everything is configured',
      description: 'You are fully set. Review today’s high-confidence setups now.',
      buttonLabel: 'Open Signals',
      to: '/signals',
      icon: 'sparkles',
    };

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading dashboard...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMember(profile?.role)) {
    return <Navigate to={isTrader(profile?.role) ? '/signals' : '/auth'} replace />;
  }

  return (
    <AppShell
      pageTitle="Dashboard"
      pageDescription="Performance pulse, engagement, and next actions"
      hideTopbarDescriptionOnMobile
      navItems={memberNavigation}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      topbarActions={(
        !premiumActive ? (
          <Button variant="secondary" size="sm" to="/upgrade">
            <AppIcon name="upgrade" size={15} />
            Upgrade
          </Button>
        ) : null
      )}
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Dashboard' },
        ]}
      />

      <section className="dashboard-hero-grid">
        <article className="hero-banner hero-banner-premium">
          <div className="hero-kicker-row">
            <span className="hero-kicker-chip">
              <AppIcon name="sparkles" size={13} />
              Personal cockpit
            </span>
            <span className="hero-date-chip">{todayLabel}</span>
          </div>

          <h2>Welcome back, {greetingName}</h2>
          <p>
            Your market cockpit is ready. Track active sessions, focus on your best setups, and move through clear
            next actions.
          </p>

          <div className="quick-actions">
            <Button variant="primary" to="/signals">
              <AppIcon name="signal" size={15} />
              Open Live Signals
            </Button>
            <Button variant="secondary" to="/tips">
              <AppIcon name="tips" size={15} />
              Read Tips
            </Button>
            {!premiumActive ? (
              <Button variant="secondary" to="/upgrade">
                <AppIcon name="upgrade" size={15} />
                Unlock Premium
              </Button>
            ) : null}
          </div>

          <div className="hero-metric-grid hero-metric-grid-rich">
            <article className="hero-metric hero-metric-strong">
              <div className="hero-metric-head">
                <AppIcon name="signal" size={14} />
                <span>Live signals</span>
              </div>
              <p className="hero-metric-value">{filteredSignals.length}</p>
            </article>
            <article className="hero-metric hero-metric-strong">
              <div className="hero-metric-head">
                <AppIcon name="tips" size={14} />
                <span>Tips today</span>
              </div>
              <p className="hero-metric-value">{tipsToday}</p>
            </article>
            <article className="hero-metric hero-metric-strong">
              <div className="hero-metric-head">
                <AppIcon name="refresh" size={14} />
                <span>Recent views</span>
              </div>
              <p className="hero-metric-value">{recentSignals.length}</p>
            </article>
            <article className="hero-metric hero-metric-strong">
              <div className="hero-metric-head">
                <AppIcon name="pin" size={14} />
                <span>Pinned tips</span>
              </div>
              <p className="hero-metric-value">{pinnedTips.length}</p>
            </article>
          </div>
        </article>

        <aside className="dashboard-glance-card">
          <div className="dashboard-glance-head">
            <p className="dashboard-glance-title">Active Sessions</p>
            <span className="status-badge live">Market Clock</span>
          </div>

          <div className="dashboard-session-list">
            {activeSessions.length > 0 ? (
              activeSessions.map((session) => (
                <article key={session.key} className={`dashboard-session-item is-${session.status}`.trim()}>
                  <div className="dashboard-session-item-head">
                    <div>
                      <p className="dashboard-session-name">{session.name}</p>
                      <p className="dashboard-session-hours">
                        {formatSessionTime(session.opensAt)} - {formatSessionTime(session.closesAt)}
                      </p>
                    </div>
                    <span className={`session-status-pill is-${session.status}`.trim()}>
                      OPEN
                    </span>
                  </div>

                  <p className="dashboard-session-countdown">
                    {`Closes in ${formatCountdown(session.closesIn)}`}
                  </p>
                </article>
              ))
            ) : (
              <p className="ui-card-subtitle">No active sessions right now.</p>
            )}
          </div>

          <div className="dashboard-session-overlap">
            <p className="market-focus-title">Session overlap</p>
            {sessionOverlap ? (
              <div className="dashboard-session-overlap-card">
                <strong>{sessionOverlap.subtitle}</strong>
                <span>{sessionOverlap.countdownLabel}</span>
              </div>
            ) : (
              <p className="ui-card-subtitle">Weekend schedule. Session overlap resumes with the next market open.</p>
            )}
          </div>

          <div className="dashboard-session-footer">
            <span>Tanzania time reference</span>
            <Button variant="secondary" size="sm" to="/sessions">
              Open Sessions
            </Button>
          </div>
        </aside>
      </section>

      <Card
        title="Market Analysis"
        subtitle="Four special analysis cards from the same live RSS analysis feed"
        hover
      >
        {loadingAnalysis ? (
          <div className="analysis-dashboard-grid">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonLoader key={`analysis-skeleton-${index}`} size="md" />
            ))}
          </div>
        ) : analysisCards.length === 0 ? (
          <EmptyState
            title="No analysis available"
            description="Fresh market analysis cards will appear here when the RSS feed responds."
            actionLabel="Open News"
            actionTo="/signals"
            icon="sparkles"
          />
        ) : (
          <div className="analysis-dashboard-grid">
            {analysisCards.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`analysis-special-card tone-${index % 4}`.trim()}
                onClick={() => window.open(item.link, '_blank', 'noopener,noreferrer')}
              >
                <span className="analysis-special-chip">
                  <AppIcon name="sparkles" size={12} />
                  Analysis
                </span>
                <p className="analysis-special-title">{item.title}</p>
                <p className="analysis-special-copy">
                  {item.description || 'Open the full market analysis for the latest detailed breakdown.'}
                </p>
                <div className="analysis-special-foot">
                  <span>{formatRelativeAnalysisDate(item.publishedAt)}</span>
                  <AppIcon name="external" size={14} />
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <section className="surface-split">
        <Card title="Recently Viewed Signals" subtitle="Based on your latest interactions" hover>
          {recentSignals.length === 0 ? (
            <EmptyState
              title="No recent signals yet"
              description="Open Signals and select a setup. We’ll keep your recently viewed list here."
              actionLabel="Go to Signals"
              actionTo="/signals"
              icon="signal"
            />
          ) : (
            <div className="recent-list">
              {recentSignals.map((signal) => (
                <article key={signal.id} className="recent-item">
                  <div>
                    <p className="recent-item-title">{signal.pair}</p>
                    <p className="recent-item-meta">{formatDate(signal.createdAtDate)} • {signal.session}</p>
                  </div>
                  <span className={`signal-direction-chip ${String(signal.direction || '').toLowerCase()}`.trim()}>
                    {signal.directionLabel}
                  </span>
                </article>
              ))}
            </div>
          )}
        </Card>

        <div className="ui-stack">
          <Card title="Pinned Tips" subtitle="Knowledge you decided to keep handy" hover>
            {loadingTips ? (
              <div className="ui-stack">
                <SkeletonLoader size="sm" />
                <SkeletonLoader size="sm" />
                <SkeletonLoader size="sm" />
              </div>
            ) : pinnedTips.length === 0 ? (
              <EmptyState
                title="Nothing pinned"
                description="Pin tips from the Tips page to build your personal playbook."
                actionLabel="Explore Tips"
                actionTo="/tips"
                icon="pin"
              />
            ) : (
              <div className="recent-list">
                {pinnedTips.slice(0, 4).map((tip) => (
                  <article key={tip.id} className="recent-item">
                    <div>
                      <p className="recent-item-title">{tip.title || 'Untitled tip'}</p>
                      <p className="recent-item-meta">{tip.type}</p>
                    </div>
                    <AppIcon name="pin" size={14} />
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card title="Next Best Action" subtitle="Retention-oriented prompt" hover>
            <div className="dashboard-next-action">
              <p className="dashboard-next-action-title">
                <AppIcon name={nextBestAction.icon} size={15} />
                {nextBestAction.title}
              </p>
              <p className="ui-card-subtitle">{nextBestAction.description}</p>
              <Button to={nextBestAction.to} variant="primary" size="sm">
                {nextBestAction.buttonLabel}
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {(loadingSignals || loadingTips) && (
        <section className="ui-grid cols-2">
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
        </section>
      )}
    </AppShell>
  );
};

export default HomeShell;

function formatRelativeAnalysisDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return 'Latest analysis';
  }

  const diffMs = Date.now() - value.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)}h ago`;
  if (diffMinutes < 10080) return `${Math.floor(diffMinutes / 1440)}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(value);
}
