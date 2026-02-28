import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  getCountFromServer,
  getDocs,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useTheme } from '../contexts/themeContext';
import { useAuth } from '../contexts/authContext';
import { firestore } from '../firebase/init';
import { isAdmin } from '../utils/roleHelpers';
import { timestampToDate } from '../utils/tradingData';
import { adminNavigation } from '../config/adminNavigation';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  ErrorState,
  SkeletonLoader,
  StatCard,
  TrendChart,
} from './ui';
import AppIcon from './icons/AppIcon';

const WEEKS_WINDOW = 12;

const AdminShell = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const adminUser = isAdmin(profile?.role);
  const [summary, setSummary] = useState({
    totalUsers: 0,
    traders: 0,
    traderAdmins: 0,
    members: 0,
    admins: 0,
    totalSignals: 0,
    activeSubscriptions: 0,
    trialAccounts: 0,
  });
  const [usersTrend, setUsersTrend] = useState([]);
  const [signalsTrend, setSignalsTrend] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async (manual = false) => {
    if (!adminUser) {
      return;
    }
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const usersRef = collection(firestore, 'users');
      const signalsRef = collection(firestore, 'signals');
      const cutoffDate = startOfDay(new Date());
      cutoffDate.setDate(cutoffDate.getDate() - (WEEKS_WINDOW * 7 - 1));

      const [
        usersCount,
        tradersCount,
        traderAdminsCount,
        membersCount,
        adminsCount,
        signalsCount,
        activeMembershipSnapshot,
        trialAccountsCount,
        usersGrowthSnapshot,
        signalsGrowthSnapshot,
      ] = await Promise.all([
        getCountFromServer(query(usersRef)),
        getCountFromServer(query(usersRef, where('role', '==', 'trader'))),
        getCountFromServer(query(usersRef, where('role', '==', 'trader_admin'))),
        getCountFromServer(query(usersRef, where('role', '==', 'member'))),
        getCountFromServer(query(usersRef, where('role', '==', 'admin'))),
        getCountFromServer(query(signalsRef)),
        getDocs(query(usersRef, where('membership.status', '==', 'active'))),
        getCountFromServer(query(usersRef, where('membership.source', '==', 'trial'))),
        getDocs(query(usersRef, where('createdAt', '>=', cutoffDate), orderBy('createdAt', 'asc'))),
        getDocs(query(signalsRef, where('createdAt', '>=', cutoffDate), orderBy('createdAt', 'asc'))),
      ]);

      const usersDates = usersGrowthSnapshot.docs
        .map((docSnap) => timestampToDate(docSnap.data()?.createdAt ?? docSnap.data()?.updatedAt))
        .filter((date) => date instanceof Date);

      const signalsDates = signalsGrowthSnapshot.docs
        .map((docSnap) => timestampToDate(docSnap.data()?.createdAt ?? docSnap.data()?.updatedAt))
        .filter((date) => date instanceof Date);
      const activeSubscriptions = activeMembershipSnapshot.docs.filter((docSnap) => {
        const membership = docSnap.data()?.membership ?? {};
        const source = String(membership.source ?? '').toLowerCase();
        return source !== 'trial';
      }).length;

      setSummary({
        totalUsers: usersCount.data().count,
        traders: tradersCount.data().count,
        traderAdmins: traderAdminsCount.data().count,
        members: membersCount.data().count,
        admins: adminsCount.data().count,
        totalSignals: signalsCount.data().count,
        activeSubscriptions,
        trialAccounts: trialAccountsCount.data().count,
      });
      setUsersTrend(buildWeeklyTrend(usersDates, WEEKS_WINDOW));
      setSignalsTrend(buildWeeklyTrend(signalsDates, WEEKS_WINDOW));
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser) {
      return;
    }
    loadDashboard(false);
  }, [adminUser, loadDashboard]);

  const usersDelta = useMemo(() => deltaFromPrevious(usersTrend), [usersTrend]);
  const signalsDelta = useMemo(() => deltaFromPrevious(signalsTrend), [signalsTrend]);

  const roleDistribution = useMemo(() => {
    const total = Math.max(1, summary.totalUsers);
    return [
      { key: 'members', label: 'Members', value: summary.members, icon: 'user' },
      { key: 'traders', label: 'Traders', value: summary.traders, icon: 'chart' },
      { key: 'traderAdmins', label: 'Trader Admins', value: summary.traderAdmins, icon: 'sparkles' },
      { key: 'admins', label: 'Admins', value: summary.admins, icon: 'settings' },
    ].map((entry) => ({
      ...entry,
      percent: Math.round((entry.value / total) * 100),
    }));
  }, [summary]);

  const coverageShare = summary.totalUsers > 0
    ? Math.round(((summary.traders + summary.traderAdmins) / summary.totalUsers) * 100)
    : 0;
  const subscriptionShare = summary.totalUsers > 0
    ? Math.round((summary.activeSubscriptions / summary.totalUsers) * 100)
    : 0;
  const trialShare = summary.totalUsers > 0
    ? Math.round((summary.trialAccounts / summary.totalUsers) * 100)
    : 0;

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="Admin Console"
      pageDescription="User growth, role distribution, and signal velocity"
      navItems={adminNavigation}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
      topbarActions={(
        <Button size="sm" variant="secondary" onClick={() => loadDashboard(true)} disabled={refreshing}>
          <AppIcon name="refresh" size={14} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </Button>
      )}
    >
      <Breadcrumbs items={[{ label: 'Admin' }]} />

      {error ? (
        <ErrorState
          title="Unable to load analytics"
          description={error}
          onRetry={() => loadDashboard(true)}
        />
      ) : null}

      <section className="ui-grid cols-3 admin-kpi-grid">
        {loading ? (
          <>
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Users"
              value={formatCompact(summary.totalUsers)}
              trend={formatDeltaLabel(usersDelta)}
              trendDirection={usersDelta >= 0 ? 'positive' : 'negative'}
              icon="user"
            />
            <StatCard
              label="Traders"
              value={formatCompact(summary.traders)}
              trend={`${coverageShare}% market contributors`}
              trendDirection="positive"
              icon="chart"
            />
            <StatCard
              label="Trader Admins"
              value={formatCompact(summary.traderAdmins)}
              trend={`${Math.round((summary.traderAdmins / Math.max(1, summary.totalUsers)) * 100)}% of users`}
              trendDirection="positive"
              icon="sparkles"
            />
            <StatCard
              label="Signals Shared"
              value={formatCompact(summary.totalSignals)}
              trend={formatDeltaLabel(signalsDelta)}
              trendDirection={signalsDelta >= 0 ? 'positive' : 'negative'}
              icon="signal"
            />
            <StatCard
              label="Subscriptions"
              value={formatCompact(summary.activeSubscriptions)}
              trend={`${subscriptionShare}% of user base`}
              trendDirection="positive"
              icon="upgrade"
            />
            <StatCard
              label="Trial Accounts"
              value={formatCompact(summary.trialAccounts)}
              trend={`${trialShare}% of user base`}
              trendDirection="positive"
              icon="clock"
            />
          </>
        )}
      </section>

      <section className="admin-charts-grid">
        <Card className="admin-analytics-card" title="User Growth Trend" subtitle="New users per week (last 12 weeks)" hover>
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <TrendChart points={usersTrend} tone="primary" ariaLabel="User growth weekly trend chart" />
          )}
        </Card>

        <Card className="admin-analytics-card" title="Signals Shared Trend" subtitle="Signals posted per week (last 12 weeks)" hover>
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <TrendChart points={signalsTrend} tone="success" ariaLabel="Signals shared weekly trend chart" />
          )}
        </Card>
      </section>

      <section className="surface-split admin-surface-split">
        <Card className="admin-analytics-card admin-role-card" title="Role Distribution" subtitle="Current account mix by role" hover>
          {loading ? (
            <div className="ui-stack">
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
            </div>
          ) : (
            <div className="admin-role-list">
              {roleDistribution.map((entry) => (
                <article key={entry.key} className="admin-role-row">
                  <div className="admin-role-head">
                    <p>
                      <AppIcon name={entry.icon} size={14} />
                      {entry.label}
                    </p>
                    <strong>{formatCompact(entry.value)}</strong>
                  </div>
                  <progress className="admin-role-bar" max="100" value={entry.percent} aria-label={`${entry.label} share`} />
                  <p className="admin-role-meta">{entry.percent}%</p>
                </article>
              ))}
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card admin-snapshot-card"
          title="Snapshot"
          subtitle={lastUpdated ? `Last updated ${formatRelativeTime(lastUpdated)}` : 'Live operational snapshot'}
          hover
        >
          {loading ? (
            <div className="ui-stack">
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
            </div>
          ) : (
            <div className="admin-snapshot-grid">
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Users this week</p>
                <p className="admin-snapshot-value">{latestValue(usersTrend)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Signals this week</p>
                <p className="admin-snapshot-value">{latestValue(signalsTrend)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Members</p>
                <p className="admin-snapshot-value">{formatCompact(summary.members)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Subscriptions</p>
                <p className="admin-snapshot-value">{formatCompact(summary.activeSubscriptions)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Trial Accounts</p>
                <p className="admin-snapshot-value">{formatCompact(summary.trialAccounts)}</p>
              </article>
              <article className="admin-snapshot-item">
                <p className="admin-snapshot-label">Admins</p>
                <p className="admin-snapshot-value">{formatCompact(summary.admins)}</p>
              </article>
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  );
};

export default AdminShell;

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildWeeklyTrend(dates, weeks = 12) {
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const firstStart = startOfDay(new Date());
  firstStart.setDate(firstStart.getDate() - (weeks - 1) * 7);

  const bins = Array.from({ length: weeks }, (_, index) => {
    const start = new Date(firstStart);
    start.setDate(firstStart.getDate() + index * 7);
    return {
      key: start.toISOString(),
      label: format.format(start),
      value: 0,
      start,
    };
  });

  dates.forEach((date) => {
    if (!(date instanceof Date)) {
      return;
    }
    const day = startOfDay(date);
    if (day.getTime() < bins[0].start.getTime()) {
      return;
    }
    const index = Math.floor((day.getTime() - bins[0].start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (index >= 0 && index < bins.length) {
      bins[index].value += 1;
    }
  });

  return bins.map(({ key, label, value }) => ({ key, label, value }));
}

function deltaFromPrevious(points = []) {
  if (points.length < 2) {
    return 0;
  }
  const current = Number(points[points.length - 1]?.value ?? 0);
  const previous = Number(points[points.length - 2]?.value ?? 0);
  return current - previous;
}

function latestValue(points = []) {
  if (!points.length) {
    return 0;
  }
  return Number(points[points.length - 1]?.value ?? 0);
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  );
}

function formatDeltaLabel(delta) {
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta} vs last week`;
}

function formatRelativeTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / (1000 * 60)));
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}
