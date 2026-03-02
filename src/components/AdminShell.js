import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  getCountFromServer,
  getDocs,
  limit as limitQuery,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useTheme } from '../contexts/themeContext';
import { useAuth } from '../contexts/authContext';
import { firestore } from '../firebase/init';
import { isAdminOrTraderAdmin } from '../utils/roleHelpers';
import { formatDateTime, getSignalSessionBucket, normalizeSignal, timestampToDate } from '../utils/tradingData';
import { getAdminNavItems } from '../config/adminNavigation';
import {
  AppShell,
  BarChart,
  Breadcrumbs,
  Card,
  ErrorState,
  SkeletonLoader,
  Tabs,
  TrendChart,
} from './ui';
import AppIcon from './icons/AppIcon';

const WEEKS_WINDOW = 12;
const PAYMENT_WINDOW_DAYS = 84;
const EXPIRY_FORECAST_WEEKS = 8;
const RECENT_SIGNAL_LIMIT = 400;
const RECENT_PAYMENT_LIMIT = 320;
const SIGNAL_QUALITY_TABS = [
  { key: 'session', label: 'By Session' },
  { key: 'trader', label: 'By Trader' },
];

const AdminShell = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const adminUser = isAdminOrTraderAdmin(profile?.role);
  const dashboardNavItems = useMemo(() => getAdminNavItems(profile?.role), [profile?.role]);
  const [signalQualityTab, setSignalQualityTab] = useState('session');
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
  const [analytics, setAnalytics] = useState(() => emptyAnalytics());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadDashboard = useCallback(async () => {
    if (!adminUser) {
      return;
    }
    setLoading(true);
    setError('');

    try {
      const usersRef = collection(firestore, 'users');
      const signalsRef = collection(firestore, 'signals');
      const successPaymentsRef = collection(firestore, 'success_payment');
      const failedOrdersRef = collection(firestore, 'failed_order');
      const intentsRef = collection(firestore, 'payment_intents');

      const weeklyCutoff = startOfDay(new Date());
      weeklyCutoff.setDate(weeklyCutoff.getDate() - (WEEKS_WINDOW * 7 - 1));

      const paymentsCutoff = startOfDay(new Date());
      paymentsCutoff.setDate(paymentsCutoff.getDate() - PAYMENT_WINDOW_DAYS);

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
        recentPaymentsSnapshot,
        recentFailedOrdersSnapshot,
        paymentIntentsSnapshot,
        signalsAnalyticsSnapshot,
      ] = await Promise.all([
        getCountFromServer(query(usersRef)),
        getCountFromServer(query(usersRef, where('role', '==', 'trader'))),
        getCountFromServer(query(usersRef, where('role', '==', 'trader_admin'))),
        getCountFromServer(query(usersRef, where('role', '==', 'member'))),
        getCountFromServer(query(usersRef, where('role', '==', 'admin'))),
        getCountFromServer(query(signalsRef)),
        getDocs(query(usersRef, where('membership.status', '==', 'active'))),
        getCountFromServer(query(usersRef, where('membership.source', '==', 'trial'))),
        getDocs(query(usersRef, where('createdAt', '>=', weeklyCutoff), orderBy('createdAt', 'asc'))),
        getDocs(
          query(
            successPaymentsRef,
            where('createdAt', '>=', paymentsCutoff),
            orderBy('createdAt', 'desc'),
            limitQuery(RECENT_PAYMENT_LIMIT),
          ),
        ),
        getDocs(
          query(
            failedOrdersRef,
            where('createdAt', '>=', paymentsCutoff),
            orderBy('createdAt', 'desc'),
            limitQuery(RECENT_PAYMENT_LIMIT),
          ),
        ),
        getDocs(
          query(
            intentsRef,
            where('createdAt', '>=', paymentsCutoff),
            orderBy('createdAt', 'desc'),
            limitQuery(RECENT_PAYMENT_LIMIT),
          ),
        ),
        getDocs(query(signalsRef, orderBy('createdAt', 'desc'), limitQuery(RECENT_SIGNAL_LIMIT))),
      ]);

      const usersDates = usersGrowthSnapshot.docs
        .map((docSnap) => timestampToDate(docSnap.data()?.createdAt ?? docSnap.data()?.updatedAt))
        .filter((date) => date instanceof Date);
      const activeMembershipDocs = activeMembershipSnapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() ?? {}),
      }));
      const activeSubscriptions = activeMembershipDocs.filter((entry) => {
        const membership = entry.membership ?? {};
        const source = String(membership.source ?? '').toLowerCase();
        return source !== 'trial';
      }).length;

      const recentPayments = recentPaymentsSnapshot.docs.map((docSnap) => normalizePayment(docSnap.data() ?? {}));
      const recentFailedOrders = recentFailedOrdersSnapshot.docs.map((docSnap) => normalizeFailedOrder(docSnap.data() ?? {}));
      const paymentIntents = paymentIntentsSnapshot.docs.map((docSnap) => normalizePaymentIntent(docSnap.data() ?? {}));
      const signals = signalsAnalyticsSnapshot.docs.map((docSnap) => normalizeSignalWithOutcome(docSnap.id, docSnap.data() ?? {}));

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
      setAnalytics(
        buildAdminAnalytics({
          usersDates,
          payments: recentPayments,
          failedOrders: recentFailedOrders,
          paymentIntents,
          signals,
          activeMembershipDocs,
        }),
      );
      setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load admin analytics.');
    } finally {
      setLoading(false);
    }
  }, [adminUser]);

  useEffect(() => {
    if (!adminUser) {
      return;
    }
    loadDashboard();
  }, [adminUser, loadDashboard]);

  const usersDelta = useMemo(
    () => deltaFromPrevious(analytics.premiumConversion.series[0]?.data ?? []),
    [analytics.premiumConversion.series],
  );
  const coverageShare = summary.totalUsers > 0
    ? Math.round(((summary.traders + summary.traderAdmins) / summary.totalUsers) * 100)
    : 0;
  const subscriptionShare = summary.totalUsers > 0
    ? Math.round((summary.activeSubscriptions / summary.totalUsers) * 100)
    : 0;
  const trialShare = summary.totalUsers > 0
    ? Math.round((summary.trialAccounts / summary.totalUsers) * 100)
    : 0;
  const signalQualityData = signalQualityTab === 'session'
    ? analytics.signalQuality.bySession
    : analytics.signalQuality.byTrader;

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppShell
      pageTitle="Admin Console"
      pageDescription="Premium conversion, payment health, signal quality, and expiry pressure"
      navItems={dashboardNavItems}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
    >
      <Breadcrumbs items={[{ label: 'Admin' }]} />

      {error ? (
        <ErrorState
          title="Unable to load analytics"
          description={error}
          onRetry={loadDashboard}
        />
      ) : null}

      <section className="admin-summary-visual-grid">
        {loading ? (
          <>
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </>
        ) : (
          <>
            <RoleDistributionCard
              summary={summary}
              usersDelta={usersDelta}
              coverageShare={coverageShare}
            />
            <MembershipMixCard
              summary={summary}
              subscriptionShare={subscriptionShare}
              trialShare={trialShare}
            />
          </>
        )}
      </section>

      <section className="admin-dashboard-grid">
        <Card
          className="admin-analytics-card admin-panel-wide"
          title="Premium Conversion Trend"
          subtitle="Weekly new users, paid checkouts, and trial starts"
          hover
          headRight={
            <MetricChip
              icon="upgrade"
              label={`${formatCompact(analytics.premiumConversion.totalPaid)} paid conversions`}
            />
          }
        >
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <div className="admin-chart-stack">
              <TrendChart
                ariaLabel="Premium conversion trend"
                series={analytics.premiumConversion.series}
              />
              <div className="admin-legend-row">
                {analytics.premiumConversion.series.map((entry) => (
                  <LegendItem
                    key={entry.id}
                    tone={entry.tone}
                    label={entry.id}
                  />
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card"
          title="Membership Expiry Forecast"
          subtitle="Premium memberships due to end over the next eight weeks"
          hover
          headRight={
            <MetricChip
              icon="clock"
              label={`${formatCompact(analytics.expiryForecast.expiringSoon)} expiring soon`}
              tone="warning"
            />
          }
        >
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <div className="admin-chart-stack">
              <BarChart
                data={analytics.expiryForecast.data}
                keys={['count']}
                indexBy="label"
                ariaLabel="Membership expiry forecast"
                colorByKey={{ count: 'warning' }}
              />
              <div className="admin-insight-strip">
                <InsightItem
                  label="Active premium members"
                  value={formatCompact(analytics.expiryForecast.activePremium)}
                />
                <InsightItem
                  label="Next 14 days"
                  value={formatCompact(analytics.expiryForecast.next14Days)}
                />
              </div>
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card admin-panel-wide"
          title="Revenue By Plan And Failed Order Pressure"
          subtitle="Weekly collections split by plan with failed order volume tracked beneath"
          hover
          headRight={
            <MetricChip
              icon="payments"
              label={`${formatCompact(analytics.revenue.totalAmount)} TZS captured`}
              tone="success"
            />
          }
        >
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <div className="admin-chart-stack">
              <BarChart
                data={analytics.revenue.byPlan}
                keys={['Premium Daily', 'Premium Weekly', 'Premium Monthly']}
                indexBy="label"
                ariaLabel="Revenue by plan"
                groupMode="stacked"
                colorByKey={{
                  'Premium Daily': 'accent',
                  'Premium Weekly': 'primary',
                  'Premium Monthly': 'success',
                }}
                tooltipValueFormatter={(value) => `${formatCompact(value)} TZS`}
              />
              <div className="admin-legend-row">
                <LegendItem tone="accent" label="Premium Daily" />
                <LegendItem tone="primary" label="Premium Weekly" />
                <LegendItem tone="success" label="Premium Monthly" />
              </div>
              <div className="admin-subpanel">
                <div className="admin-subpanel-head">
                  <div>
                    <h3>Failed order pressure</h3>
                    <p>Order failures by week using the same payment window.</p>
                  </div>
                  <MetricChip
                    icon="alert"
                    label={`${formatCompact(analytics.revenue.failedTotal)} failed orders`}
                    tone="error"
                  />
                </div>
                <TrendChart
                  points={analytics.revenue.failedTrend}
                  tone="error"
                  ariaLabel="Failed order trend"
                />
              </div>
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card"
          title="Payment Provider Success Rate"
          subtitle="Provider-level conversion mix across paid, pending, and failed intents"
          hover
          headRight={
            <MetricChip
              icon="phone"
              label={`${analytics.providerSuccessRate.bestProvider} leading`}
              tone="accent"
            />
          }
        >
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <div className="admin-chart-stack">
              <BarChart
                data={analytics.providerSuccessRate.data}
                keys={['Paid', 'Pending', 'Failed']}
                indexBy="provider"
                ariaLabel="Payment provider success rate"
                groupMode="stacked"
                maxValue={100}
                colorByKey={{ Paid: 'success', Pending: 'accent', Failed: 'error' }}
                axisLeft={{
                  tickSize: 0,
                  tickPadding: 10,
                  tickValues: [0, 20, 40, 60, 80, 100],
                  format: (value) => `${value}%`,
                }}
                tooltipValueFormatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <div className="admin-legend-row">
                <LegendItem tone="success" label="Paid" />
                <LegendItem tone="accent" label="Pending" />
                <LegendItem tone="error" label="Failed" />
              </div>
              <div className="admin-subpanel admin-subpanel-tight">
                <div className="admin-subpanel-head">
                  <div>
                    <h3>Recent transactions</h3>
                    <p>Latest 3 successful payments from the current analytics window.</p>
                  </div>
                </div>
                <div className="admin-transaction-list">
                  {(analytics.providerSuccessRate.recentTransactions || []).map((transaction) => (
                    <article key={transaction.id} className="admin-transaction-row">
                      <div className="admin-transaction-main">
                        <div className="admin-transaction-provider">
                          <span className="admin-transaction-provider-dot" aria-hidden="true" />
                          <strong>{transaction.providerLabel}</strong>
                        </div>
                        <p>{planLabel(transaction.productId)}</p>
                      </div>
                      <div className="admin-transaction-side">
                        <strong>{formatCompact(transaction.amount)} TZS</strong>
                        <span>{formatDateTime(transaction.createdAtDate)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card admin-panel-wide"
          title="Signal Outcome Quality"
          subtitle="Resolved signal mix by session or by trader over the recent signal window"
          hover
          headRight={(
            <Tabs
              tabs={SIGNAL_QUALITY_TABS}
              activeKey={signalQualityTab}
              onChange={setSignalQualityTab}
              ariaLabel="Signal quality views"
              className="admin-inline-tabs"
            />
          )}
        >
          {loading ? (
            <SkeletonLoader size="xl" />
          ) : (
            <div className="admin-chart-stack">
              <BarChart
                data={signalQualityData}
                keys={['Win', 'Partial', 'Breakeven', 'Loss', 'Expired']}
                indexBy="label"
                ariaLabel={`Signal quality ${signalQualityTab}`}
                groupMode="stacked"
                layout={signalQualityTab === 'trader' ? 'horizontal' : 'vertical'}
                colorByKey={{
                  Win: 'success',
                  Partial: 'accent',
                  Breakeven: 'warning',
                  Loss: 'error',
                  Expired: 'neutral',
                }}
              />
              <div className="admin-legend-row">
                <LegendItem tone="success" label="Win" />
                <LegendItem tone="accent" label="Partial" />
                <LegendItem tone="warning" label="Breakeven" />
                <LegendItem tone="error" label="Loss" />
                <LegendItem tone="neutral" label="Expired" />
              </div>
            </div>
          )}
        </Card>

        <Card
          className="admin-analytics-card"
          title="Decision Snapshot"
          subtitle={lastUpdated ? `Last updated ${formatRelativeTime(lastUpdated)}` : 'Current operational readout'}
          hover
        >
          {loading ? (
            <div className="ui-stack">
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
              <SkeletonLoader size="md" />
            </div>
          ) : (
            <div className="admin-snapshot-list">
              <SnapshotLine
                icon="user"
                label="New users this week"
                value={latestValue(analytics.premiumConversion.series[0]?.data ?? [])}
              />
              <SnapshotLine
                icon="payments"
                label="Paid intents this week"
                value={latestValue(analytics.premiumConversion.series[1]?.data ?? [])}
              />
              <SnapshotLine
                icon="signal"
                label="Signals shared total"
                value={formatCompact(summary.totalSignals)}
              />
              <SnapshotLine
                icon="signal"
                label="Signals resolved in model"
                value={formatCompact(analytics.signalQuality.resolvedCount)}
              />
              <SnapshotLine
                icon="clock"
                label="Memberships expiring in 7 days"
                value={formatCompact(analytics.expiryForecast.next7Days)}
              />
              <SnapshotLine
                icon="phone"
                label="Best provider paid rate"
                value={`${analytics.providerSuccessRate.bestRate}%`}
              />
            </div>
          )}
        </Card>
      </section>
    </AppShell>
  );
};

export default AdminShell;

function emptyAnalytics() {
  return {
    premiumConversion: {
      totalPaid: 0,
      series: [
        { id: 'New users', tone: 'primary', data: [] },
        { id: 'Paid checkouts', tone: 'accent', data: [] },
        { id: 'Trial starts', tone: 'success', data: [] },
      ],
    },
    revenue: {
      totalAmount: 0,
      failedTotal: 0,
      byPlan: [],
      failedTrend: [],
    },
    signalVolumeTrend: [],
    providerSuccessRate: {
      bestProvider: 'None',
      bestRate: 0,
      data: [],
      recentTransactions: [],
    },
    expiryForecast: {
      activePremium: 0,
      expiringSoon: 0,
      next7Days: 0,
      next14Days: 0,
      data: [],
    },
    signalQuality: {
      resolvedCount: 0,
      bySession: [],
      byTrader: [],
    },
  };
}

function buildAdminAnalytics({
  usersDates = [],
  payments = [],
  failedOrders = [],
  paymentIntents = [],
  signals = [],
  activeMembershipDocs = [],
}) {
  const premiumConversion = buildPremiumConversion(usersDates, payments, activeMembershipDocs);
  const revenue = buildRevenueAnalytics(payments, failedOrders);
  const signalQuality = buildSignalQualityAnalytics(signals);

  return {
    premiumConversion,
    revenue,
    signalVolumeTrend: buildWeeklyTrend(
      signals
        .map((signal) => signal.createdAtDate)
        .filter((date) => date instanceof Date),
      WEEKS_WINDOW,
    ),
    providerSuccessRate: buildProviderSuccessRate(paymentIntents, payments),
    expiryForecast: buildMembershipExpiryForecast(activeMembershipDocs),
    signalQuality,
  };
}

function buildPremiumConversion(usersDates, payments, activeMembershipDocs) {
  const userTrend = buildWeeklyTrend(usersDates, WEEKS_WINDOW);
  const paymentTrend = buildWeeklyTrend(
    payments.map((payment) => payment.createdAtDate).filter((date) => date instanceof Date),
    WEEKS_WINDOW,
  );
  const trialTrend = buildWeeklyTrend(
    activeMembershipDocs
      .filter((entry) => {
        const membership = entry.membership ?? {};
        const source = String(membership.source ?? '').toLowerCase();
        return source === 'trial' || membership.trialUsed === true;
      })
      .map((entry) => timestampToDate(entry.membership?.startedAt ?? entry.createdAt ?? entry.updatedAt))
      .filter((date) => date instanceof Date),
    WEEKS_WINDOW,
  );

  return {
    totalPaid: payments.length,
    series: [
      { id: 'New users', tone: 'primary', data: userTrend },
      { id: 'Paid checkouts', tone: 'accent', data: paymentTrend },
      { id: 'Trial starts', tone: 'success', data: trialTrend },
    ],
  };
}

function buildRevenueAnalytics(payments, failedOrders) {
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const bins = createWeeklyBins(WEEKS_WINDOW);
  const failedTrend = createWeeklyBins(WEEKS_WINDOW);
  let totalAmount = 0;

  payments.forEach((payment) => {
    totalAmount += payment.amount;
    const date = payment.createdAtDate;
    if (!(date instanceof Date)) {
      return;
    }
    const index = binIndexForDate(date, bins);
    if (index < 0) {
      return;
    }
    const label = planLabel(payment.productId);
    bins[index][label] = Number(bins[index][label] ?? 0) + payment.amount;
  });

  failedOrders.forEach((order) => {
    const date = order.createdAtDate;
    if (!(date instanceof Date)) {
      return;
    }
    const index = binIndexForDate(date, failedTrend);
    if (index >= 0) {
      failedTrend[index].value += 1;
    }
  });

  return {
    totalAmount,
    failedTotal: failedOrders.length,
    byPlan: bins.map((bin) => ({
      label: format.format(bin.start),
      'Premium Daily': Number(bin['Premium Daily'] ?? 0),
      'Premium Weekly': Number(bin['Premium Weekly'] ?? 0),
      'Premium Monthly': Number(bin['Premium Monthly'] ?? 0),
    })),
    failedTrend: failedTrend.map((bin) => ({
      key: bin.start.toISOString(),
      label: format.format(bin.start),
      value: bin.value,
    })),
  };
}

function buildProviderSuccessRate(paymentIntents, payments = []) {
  const providers = ['airtel', 'vodacom', 'tigo', 'halopesa'];
  const totals = providers.reduce((acc, provider) => {
    acc[provider] = { paid: 0, pending: 0, failed: 0 };
    return acc;
  }, {});

  paymentIntents.forEach((intent) => {
    const provider = providers.includes(intent.provider) ? intent.provider : null;
    if (!provider) {
      return;
    }
    totals[provider][intent.statusBucket] += 1;
  });

  let bestProvider = 'None';
  let bestRate = 0;
  const data = providers.map((provider) => {
    const stats = totals[provider];
    const total = stats.paid + stats.pending + stats.failed;
    const paidRate = total ? Math.round((stats.paid / total) * 100) : 0;
    if (total > 0 && paidRate >= bestRate) {
      bestRate = paidRate;
      bestProvider = provider.toUpperCase();
    }
    return {
      provider: provider.toUpperCase(),
      Paid: total ? roundToOne((stats.paid / total) * 100) : 0,
      Pending: total ? roundToOne((stats.pending / total) * 100) : 0,
      Failed: total ? roundToOne((stats.failed / total) * 100) : 0,
    };
  });

  return {
    bestProvider,
    bestRate,
    data,
    recentTransactions: payments
      .filter((payment) => payment.createdAtDate instanceof Date)
      .sort((left, right) => right.createdAtDate.getTime() - left.createdAtDate.getTime())
      .slice(0, 3)
      .map((payment, index) => ({
        id: `${payment.provider}-${payment.productId}-${payment.createdAtDate?.getTime?.() ?? index}`,
        providerLabel: payment.provider ? payment.provider.toUpperCase() : 'UNKNOWN',
        productId: payment.productId,
        amount: payment.amount,
        createdAtDate: payment.createdAtDate,
      })),
  };
}

function buildMembershipExpiryForecast(activeMembershipDocs) {
  const today = startOfDay(new Date());
  const bins = Array.from({ length: EXPIRY_FORECAST_WEEKS }, (_, index) => {
    const start = new Date(today);
    start.setDate(today.getDate() + index * 7);
    return { start, label: weekWindowLabel(start), count: 0 };
  });

  let next7Days = 0;
  let next14Days = 0;
  let expiringSoon = 0;
  let activePremium = 0;

  activeMembershipDocs.forEach((entry) => {
    const membership = entry.membership ?? {};
    const tier = String(membership.tier ?? entry.membershipTier ?? '').toLowerCase();
    const status = String(membership.status ?? '').toLowerCase();
    const expiresAt = timestampToDate(membership.expiresAt);
    if (tier !== 'premium' || status !== 'active' || !(expiresAt instanceof Date)) {
      return;
    }
    if (expiresAt.getTime() <= Date.now()) {
      return;
    }
    activePremium += 1;
    const diffDays = Math.ceil((expiresAt.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays <= 7) {
      next7Days += 1;
    }
    if (diffDays <= 14) {
      next14Days += 1;
    }
    if (diffDays <= 30) {
      expiringSoon += 1;
    }
    const index = Math.floor(diffDays / 7);
    if (index >= 0 && index < bins.length) {
      bins[index].count += 1;
    }
  });

  return {
    activePremium,
    expiringSoon,
    next7Days,
    next14Days,
    data: bins.map((bin) => ({ label: bin.label, count: bin.count })),
  };
}

function buildSignalQualityAnalytics(signals) {
  const resolvedSignals = signals.filter((signal) => signal.outcomeBucket !== 'Expired');
  const bySessionMap = {
    Asia: createOutcomeBucket(),
    London: createOutcomeBucket(),
    'New York': createOutcomeBucket(),
    Weekend: createOutcomeBucket(),
  };
  const byTraderMap = new Map();

  signals.forEach((signal) => {
    const outcome = signal.outcomeBucket;
    const session = sessionLabel(getSignalSessionBucket(signal));
    if (bySessionMap[session]) {
      bySessionMap[session][outcome] += 1;
    }
    const traderName = sanitizeTraderName(signal.posterName);
    const existing = byTraderMap.get(traderName) || createOutcomeBucket();
    existing[outcome] += 1;
    byTraderMap.set(traderName, existing);
  });

  const bySession = Object.entries(bySessionMap).map(([label, values]) => ({
    label,
    ...values,
  }));

  const byTrader = [...byTraderMap.entries()]
    .map(([label, values]) => ({
      label,
      total: values.Win + values.Partial + values.Breakeven + values.Loss + values.Expired,
      ...values,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
    .map(({ total, ...entry }) => entry);

  return {
    resolvedCount: resolvedSignals.length,
    bySession,
    byTrader,
  };
}

function normalizeSignalWithOutcome(id, data = {}) {
  const signal = normalizeSignal(id, data);
  return {
    ...signal,
    raw: data,
    outcomeBucket: deriveSignalOutcome(data),
  };
}

function normalizePayment(data = {}) {
  return {
    productId: String(data.productId || '').trim(),
    provider: String(data.provider || '').trim().toLowerCase(),
    amount: toNumber(data.amount),
    createdAtDate: timestampToDate(data.createdAt),
  };
}

function normalizeFailedOrder(data = {}) {
  return {
    productId: String(data.productId || data.bookID || '').trim(),
    provider: String(data.provider || '').trim().toLowerCase(),
    status: String(data.transactionstatus || data.transactionStatus || data.status || 'failed').trim().toLowerCase(),
    createdAtDate: timestampToDate(data.createdAt),
  };
}

function normalizePaymentIntent(data = {}) {
  const status = String(data.status || '').trim().toLowerCase();
  return {
    provider: String(data.provider || '').trim().toLowerCase(),
    statusBucket: paymentStatusBucket(status),
    createdAtDate: timestampToDate(data.createdAt),
  };
}

function paymentStatusBucket(status) {
  if (status.includes('paid') || status.includes('success')) {
    return 'paid';
  }
  if (status.includes('pending') || status.includes('created') || status.includes('processing')) {
    return 'pending';
  }
  return 'failed';
}

function deriveSignalOutcome(data = {}) {
  const candidates = [
    data.finalOutcome,
    data.result,
    data.voteAgg?.consensusOutcome,
    data.outcome,
    data.status,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  for (const value of candidates) {
    if (value.includes('tp') || value.includes('win')) {
      return 'Win';
    }
    if (value.includes('partial')) {
      return 'Partial';
    }
    if (value.includes('break') || value.includes('breakeven') || value.includes('be')) {
      return 'Breakeven';
    }
    if (value.includes('sl') || value.includes('loss') || value.includes('stop')) {
      return 'Loss';
    }
    if (value.includes('no hit') || value.includes('expired') || value.includes('cancel')) {
      return 'Expired';
    }
  }

  const resolvedAt = timestampToDate(data.resolvedAt);
  if (resolvedAt instanceof Date) {
    return 'Expired';
  }
  return 'Expired';
}

function createOutcomeBucket() {
  return {
    Win: 0,
    Partial: 0,
    Breakeven: 0,
    Loss: 0,
    Expired: 0,
  };
}

function sanitizeTraderName(value) {
  const text = String(value || '').trim();
  return text || 'Unknown Trader';
}

function sessionLabel(value) {
  if (value === 'london') {
    return 'London';
  }
  if (value === 'newyork') {
    return 'New York';
  }
  if (value === 'weekend') {
    return 'Weekend';
  }
  return 'Asia';
}

function createWeeklyBins(weeks = 12) {
  const firstStart = startOfDay(new Date());
  firstStart.setDate(firstStart.getDate() - (weeks - 1) * 7);
  return Array.from({ length: weeks }, (_, index) => {
    const start = new Date(firstStart);
    start.setDate(firstStart.getDate() + index * 7);
    return {
      start,
      value: 0,
      'Premium Daily': 0,
      'Premium Weekly': 0,
      'Premium Monthly': 0,
    };
  });
}

function binIndexForDate(date, bins) {
  if (!(date instanceof Date) || !bins.length) {
    return -1;
  }
  const day = startOfDay(date);
  const start = bins[0].start;
  if (day.getTime() < start.getTime()) {
    return -1;
  }
  const index = Math.floor((day.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return index >= 0 && index < bins.length ? index : -1;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildWeeklyTrend(dates, weeks = 12) {
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const bins = createWeeklyBins(weeks);

  dates.forEach((date) => {
    const index = binIndexForDate(date, bins);
    if (index >= 0) {
      bins[index].value += 1;
    }
  });

  return bins.map(({ start, value }) => ({
    key: start.toISOString(),
    label: format.format(start),
    value,
  }));
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

function toNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundToOne(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}

function planLabel(productId) {
  const key = String(productId || '').toLowerCase();
  if (key.includes('daily')) {
    return 'Premium Daily';
  }
  if (key.includes('weekly')) {
    return 'Premium Weekly';
  }
  if (key.includes('monthly')) {
    return 'Premium Monthly';
  }
  return 'Premium Monthly';
}

function weekWindowLabel(start) {
  return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function MetricChip({ icon, label, tone = 'primary', className = '' }) {
  return (
    <span className={`admin-metric-chip tone-${tone} ${className}`.trim()}>
      <AppIcon name={icon} size={14} />
      {label}
    </span>
  );
}

function LegendItem({ tone, label }) {
  return (
    <span className="admin-legend-item">
      <span className={`admin-legend-dot tone-${tone}`.trim()} />
      {label}
    </span>
  );
}

function InsightItem({ label, value }) {
  return (
    <article className="admin-insight-item">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function RoleDistributionCard({ summary, usersDelta, coverageShare }) {
  const totalUsers = Math.max(0, Number(summary.totalUsers || 0));
  const segments = [
    {
      key: 'members',
      label: 'Members',
      value: Number(summary.members || 0),
      tone: '#1c386c',
    },
    {
      key: 'traders',
      label: 'Traders',
      value: Number(summary.traders || 0),
      tone: '#0f8a5f',
    },
    {
      key: 'traderAdmins',
      label: 'Trader Admins',
      value: Number(summary.traderAdmins || 0),
      tone: '#f2c45a',
    },
    {
      key: 'admins',
      label: 'Admins',
      value: Number(summary.admins || 0),
      tone: '#d95c5c',
    },
  ];

  return (
    <Card
      className="admin-role-distribution-card"
      title="User Role Distribution"
      subtitle={`${formatDeltaLabel(usersDelta)} • ${coverageShare}% market contributors`}
      hover
    >
      <div className="admin-role-users-chip-row">
        <MetricChip className="admin-role-users-chip" icon="user" label={`${formatCompact(totalUsers)} users`} />
      </div>
      <div className="admin-role-distribution-body">
        <InteractiveDonut
          segments={segments}
          total={totalUsers}
          centerLabel="Total Users"
          centerValue={formatCompact(totalUsers)}
        />

        <div className="admin-role-distribution-legend">
          {segments.map((segment) => {
            const share = totalUsers > 0 ? Math.round((segment.value / totalUsers) * 100) : 0;
            return (
              <article key={segment.key} className="admin-role-distribution-item">
                <div className="admin-role-distribution-item-head">
                  <span
                    className="admin-role-distribution-dot"
                    style={{ background: segment.tone }}
                    aria-hidden="true"
                  />
                  <p>{segment.label}</p>
                  <strong>{formatCompact(segment.value)}</strong>
                </div>
                <span className="admin-role-distribution-meta">{share}% of total users</span>
              </article>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

function MembershipMixCard({ summary, subscriptionShare, trialShare }) {
  const totalUsers = Math.max(0, Number(summary.totalUsers || 0));
  const freeUsers = Math.max(0, totalUsers - Number(summary.activeSubscriptions || 0) - Number(summary.trialAccounts || 0));
  const segments = [
    {
      key: 'premium',
      label: 'Subscriptions',
      value: Number(summary.activeSubscriptions || 0),
      tone: '#f2c45a',
      icon: 'upgrade',
      meta: `${subscriptionShare}% of user base`,
    },
    {
      key: 'trial',
      label: 'Trial Accounts',
      value: Number(summary.trialAccounts || 0),
      tone: '#1c386c',
      icon: 'clock',
      meta: `${trialShare}% of user base`,
    },
    {
      key: 'free',
      label: 'Free Users',
      value: freeUsers,
      tone: '#98a2b3',
      icon: 'user',
      meta: `${totalUsers > 0 ? Math.round((freeUsers / totalUsers) * 100) : 0}% of user base`,
    },
  ];

  return (
    <Card
      className="admin-membership-mix-card"
      title="Membership State"
      subtitle="Premium, trial, and free user distribution"
      hover
      headRight={<MetricChip className="admin-membership-premium-chip" icon="upgrade" label={`${formatCompact(summary.activeSubscriptions)} active premium`} tone="warning" />}
    >
      <div className="admin-role-distribution-body">
        <InteractiveDonut
          segments={segments}
          total={totalUsers}
          centerLabel="Membership"
          centerValue={formatCompact(totalUsers)}
        />

        <div className="admin-role-distribution-legend">
          {segments.map((segment) => (
            <article key={segment.key} className="admin-membership-distribution-item">
              <div className="admin-membership-distribution-head">
                <span
                  className="admin-membership-distribution-icon"
                  style={{ background: `color-mix(in srgb, ${segment.tone} 14%, transparent)`, color: segment.tone }}
                >
                  <AppIcon name={segment.icon} size={15} />
                </span>
                <div>
                  <p>{segment.label}</p>
                  <strong>{formatCompact(segment.value)}</strong>
                </div>
              </div>
              <span className="admin-role-distribution-meta">{segment.meta}</span>
            </article>
          ))}
        </div>
      </div>
    </Card>
  );
}

function InteractiveDonut({ segments, total, centerLabel, centerValue }) {
  const [activeKey, setActiveKey] = useState('');
  const outerRadius = 50;
  const innerRadius = 30;
  const visibleSegments = segments.filter((segment) => segment.value > 0);
  const activeSegment = visibleSegments.find((segment) => segment.key === activeKey) || null;
  let currentAngle = -90;

  return (
    <div className="admin-role-donut-shell">
      <div className="admin-role-donut">
        <svg className="admin-role-donut-svg" viewBox="0 0 120 120" role="img" aria-label={centerLabel}>
          {visibleSegments.map((segment) => {
            const sweep = total > 0 ? (segment.value / total) * 360 : 0;
            const startAngle = currentAngle;
            const endAngle = currentAngle + sweep;
            currentAngle = endAngle;
            const isActive = activeSegment?.key === segment.key;
            const path = describeDonutArcPath({
              cx: 60,
              cy: 60,
              innerRadius,
              outerRadius,
              startAngle,
              endAngle,
              gapDegrees: 2.8,
            });
            return (
              <path
                key={segment.key}
                className={`admin-role-donut-segment ${isActive ? 'is-active' : ''}`.trim()}
                d={path}
                fill={segment.tone}
                onMouseEnter={() => setActiveKey(segment.key)}
                onMouseLeave={() => setActiveKey('')}
                onFocus={() => setActiveKey(segment.key)}
                onBlur={() => setActiveKey('')}
                tabIndex={0}
                style={{ transformOrigin: '60px 60px' }}
              >
                <title>{`${segment.label}: ${formatCompact(segment.value)} (${total > 0 ? Math.round((segment.value / total) * 100) : 0}%)`}</title>
              </path>
            );
          })}
        </svg>
        <div className={`admin-role-donut-center ${activeSegment ? 'is-active' : ''}`.trim()}>
          <span>{activeSegment ? activeSegment.label : centerLabel}</span>
          <strong>{activeSegment ? formatCompact(activeSegment.value) : centerValue}</strong>
          <small>
            {activeSegment
              ? `${total > 0 ? Math.round((activeSegment.value / total) * 100) : 0}% share`
              : 'Hover chart for detail'}
          </small>
        </div>
      </div>
    </div>
  );
}

function describeDonutArcPath({ cx, cy, innerRadius, outerRadius, startAngle, endAngle, gapDegrees = 0 }) {
  const sweep = endAngle - startAngle;
  if (sweep <= 0) {
    return '';
  }
  const safeGap = sweep > gapDegrees ? gapDegrees / 2 : 0;
  const safeStart = startAngle + safeGap;
  const safeEnd = endAngle - safeGap;
  const outerStart = polarToCartesian(cx, cy, outerRadius, safeStart);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, safeEnd);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, safeEnd);
  const innerStart = polarToCartesian(cx, cy, innerRadius, safeStart);
  const largeArcFlag = safeEnd - safeStart > 180 ? 1 : 0;
  return [
    'M', outerStart.x, outerStart.y,
    'A', outerRadius, outerRadius, 0, largeArcFlag, 1, outerEnd.x, outerEnd.y,
    'L', innerEnd.x, innerEnd.y,
    'A', innerRadius, innerRadius, 0, largeArcFlag, 0, innerStart.x, innerStart.y,
    'Z',
  ].join(' ');
}

function polarToCartesian(cx, cy, radius, angleInDegrees) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

function SnapshotLine({ icon, label, value }) {
  return (
    <article className="admin-snapshot-line">
      <div className="admin-snapshot-line-label">
        <AppIcon name={icon} size={15} />
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </article>
  );
}
