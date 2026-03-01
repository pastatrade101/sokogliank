import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  query,
  where,
} from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore } from '../firebase/init';
import { getAdminNavItems } from '../config/adminNavigation';
import { isAdmin } from '../utils/roleHelpers';
import { formatDateTime, timestampToDate } from '../utils/tradingData';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  ErrorState,
  SkeletonLoader,
  StatCard,
} from './ui';

const AdminContentManagementPage = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const adminUser = isAdmin(profile?.role);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [stats, setStats] = useState({
    totalSignals: 0,
    activeSignals: 0,
    resolvedSignals: 0,
    totalTips: 0,
    activeHighlights: 0,
    todayHighlight: null,
  });

  const loadContentMetrics = useCallback(async () => {
    if (!adminUser) {
      return;
    }
    setLoading(true);
    setError('');

    try {
      const todayKey = tanzaniaDateKey(new Date());
      const signalsRef = collection(firestore, 'signals');
      const tipsRef = collection(firestore, 'tips');
      const highlightsRef = collection(firestore, 'highlights');

      const [
        totalSignalsCount,
        activeSignalsCount,
        resolvedSignalsCount,
        totalTipsCount,
        activeHighlightsCount,
        todayHighlightDoc,
      ] = await Promise.all([
        getCountFromServer(query(signalsRef)),
        getCountFromServer(query(signalsRef, where('status', 'in', ['open', 'voting']))),
        getCountFromServer(query(signalsRef, where('status', '==', 'resolved'))),
        getCountFromServer(query(tipsRef)),
        getCountFromServer(query(highlightsRef, where('isActive', '==', true))),
        getDoc(doc(firestore, 'highlights', todayKey)),
      ]);

      const highlightData = todayHighlightDoc.exists() ? todayHighlightDoc.data() ?? {} : null;

      setStats({
        totalSignals: totalSignalsCount.data().count,
        activeSignals: activeSignalsCount.data().count,
        resolvedSignals: resolvedSignalsCount.data().count,
        totalTips: totalTipsCount.data().count,
        activeHighlights: activeHighlightsCount.data().count,
        todayHighlight: highlightData
          ? {
              id: todayHighlightDoc.id,
              title: String(highlightData.title || 'Untitled').trim(),
              subtitle: String(highlightData.subtitle || '').trim(),
              type: String(highlightData.type || 'signal').trim(),
              targetId: String(highlightData.targetId || '').trim(),
              isActive: highlightData.isActive === true,
              updatedAtDate: timestampToDate(highlightData.updatedAt),
            }
          : null,
      });
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load content metrics.');
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser) {
      return;
    }
    loadContentMetrics();
  }, [adminUser, loadContentMetrics]);

  const todayHighlightMeta = useMemo(() => {
    const highlight = stats.todayHighlight;
    if (!highlight) {
      return 'No highlight configured for today.';
    }
    const type = humanize(highlight.type);
    const updated = highlight.updatedAtDate ? `Updated ${formatDateTime(highlight.updatedAtDate)}` : 'Updated just now';
    return `${type} • ${highlight.isActive ? 'Active' : 'Inactive'} • ${updated}`;
  }, [stats.todayHighlight]);

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="Content Management"
      pageDescription="Moderate signals, tips, and editorial highlights"
      navItems={getAdminNavItems(profile?.role)}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
    >
      <Breadcrumbs
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Content' },
        ]}
      />

      {error ? (
        <ErrorState
          title="Unable to load content tools"
          description={error}
          onRetry={loadContentMetrics}
        />
      ) : null}

      <section className="ui-grid cols-3 admin-kpi-grid">
        {loading ? (
          <>
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </>
        ) : (
          <>
            <StatCard
              label="Total Signals"
              value={formatCompact(stats.totalSignals)}
              trend={`${formatCompact(stats.activeSignals)} active`}
              trendDirection="positive"
              icon="signal"
            />
            <StatCard
              label="Resolved Signals"
              value={formatCompact(stats.resolvedSignals)}
              trend="Signal outcomes tracked"
              trendDirection="positive"
              icon="check"
            />
            <StatCard
              label="Trader Tips"
              value={formatCompact(stats.totalTips)}
              trend="Editorial feed inventory"
              trendDirection="positive"
              icon="tips"
            />
            <StatCard
              label="Active Highlights"
              value={formatCompact(stats.activeHighlights)}
              trend={lastUpdated ? `Updated ${formatRelativeTime(lastUpdated)}` : 'Live snapshot'}
              trendDirection="positive"
              icon="sparkles"
            />
          </>
        )}
      </section>

      <section className="surface-split">
        <Card
          className="admin-analytics-card"
          title="Content Tools"
          subtitle="Equivalent admin controls aligned with the Flutter admin workflow"
          hover
        >
          <div className="content-tools-grid">
            <article className="content-tool-item">
              <div>
                <p className="content-tool-title">Signals Moderation</p>
                <p className="content-tool-copy">Manage live signals and review signal outcomes.</p>
              </div>
              <Button to="/signals" variant="primary" size="sm">Open Signals</Button>
            </article>

            <article className="content-tool-item">
              <div>
                <p className="content-tool-title">Tips Management</p>
                <p className="content-tool-copy">Review and maintain the trader tips feed.</p>
              </div>
              <Button to="/tips" variant="primary" size="sm">Open Tips</Button>
            </article>

            <article className="content-tool-item">
              <div>
                <p className="content-tool-title">Session Settings</p>
                <p className="content-tool-copy">Session configuration workflow parity with mobile admin.</p>
              </div>
              <span className="status-badge pending">Coming Soon</span>
            </article>

            <article className="content-tool-item">
              <div>
                <p className="content-tool-title">Testimonials / Brokers</p>
                <p className="content-tool-copy">Extended content modules from Flutter admin.</p>
              </div>
              <span className="status-badge pending">Coming Soon</span>
            </article>
          </div>
        </Card>

        <Card
          className="admin-analytics-card"
          title="Today Highlight"
          subtitle="Daily highlight status"
          hover
        >
          <div className="content-highlight-box">
            {stats.todayHighlight ? (
              <>
                <p className="content-highlight-title">{stats.todayHighlight.title}</p>
                <p className="content-highlight-subtitle">{stats.todayHighlight.subtitle || 'No subtitle'}</p>
                <p className="content-highlight-meta">{todayHighlightMeta}</p>
                <p className="content-highlight-meta">Target ID: <span className="revenue-code">{stats.todayHighlight.targetId || '--'}</span></p>
              </>
            ) : (
              <p className="content-highlight-meta">No highlight configured for today in `highlights/{tanzaniaDateKey(new Date())}`.</p>
            )}
          </div>
        </Card>
      </section>
    </AppShell>
  );
};

export default AdminContentManagementPage;

function tanzaniaDateKey(value) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '--';
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  );
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
