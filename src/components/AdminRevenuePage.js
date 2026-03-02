import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore } from '../firebase/init';
import { getAdminNavItems } from '../config/adminNavigation';
import { isAdminOrTraderAdmin } from '../utils/roleHelpers';
import { formatDateTime, timestampToDate } from '../utils/tradingData';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Modal,
  SkeletonLoader,
  Table,
  Tabs,
  TrendChart,
  useToast,
} from './ui';

const USD_RATE = 2500;
const PAYMENT_LIMIT = 200;
const TABS = [
  { key: 'overview', label: 'Revenue' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'failed', label: 'Failed Orders' },
];
const RANGE_TABS = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const AdminRevenuePage = () => {
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const adminUser = isAdminOrTraderAdmin(profile?.role);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches,
  );
  const revenueNavItems = useMemo(() => getAdminNavItems(profile?.role), [profile?.role]);

  const [activeTab, setActiveTab] = useState('overview');
  const [trendRange, setTrendRange] = useState('daily');
  const [showUsd, setShowUsd] = useState(false);

  const [statsDoc, setStatsDoc] = useState(null);
  const [payments, setPayments] = useState([]);
  const [failedOrders, setFailedOrders] = useState([]);

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [loadingFailedOrders, setLoadingFailedOrders] = useState(true);

  const [errorStats, setErrorStats] = useState('');
  const [errorPayments, setErrorPayments] = useState('');
  const [errorFailedOrders, setErrorFailedOrders] = useState('');
  const [selectedFailedOrderId, setSelectedFailedOrderId] = useState('');
  const [selectedFailedOrderUser, setSelectedFailedOrderUser] = useState(null);
  const [loadingSelectedFailedOrderUser, setLoadingSelectedFailedOrderUser] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery = window.matchMedia('(max-width: 760px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    const unsubStats = onSnapshot(
      doc(firestore, 'revenue_stats', 'global'),
      (snapshot) => {
        const data = snapshot.exists() ? snapshot.data() ?? {} : {};
        setStatsDoc(normalizeRevenueStats(data));
        setLoadingStats(false);
        setErrorStats('');
      },
      (loadError) => {
        setErrorStats(loadError.message || 'Unable to load revenue summary.');
        setLoadingStats(false);
      },
    );

    const unsubPayments = onSnapshot(
      query(collection(firestore, 'success_payment'), orderBy('createdAt', 'desc'), limitQuery(PAYMENT_LIMIT)),
      (snapshot) => {
        const next = snapshot.docs.map((docSnap) => normalizePayment(docSnap.id, docSnap.data() ?? {}));
        setPayments(next);
        setLoadingPayments(false);
        setErrorPayments('');
      },
      (loadError) => {
        setErrorPayments(loadError.message || 'Unable to load transactions.');
        setLoadingPayments(false);
      },
    );

    const unsubFailedOrders = onSnapshot(
      collection(firestore, 'failed_order'),
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => normalizeFailedOrder(docSnap.id, docSnap.data() ?? {}))
          .sort((a, b) => {
            const aTime = a.updatedAtDate?.getTime?.() ?? a.createdAtDate?.getTime?.() ?? 0;
            const bTime = b.updatedAtDate?.getTime?.() ?? b.createdAtDate?.getTime?.() ?? 0;
            return bTime - aTime;
          });
        setFailedOrders(next);
        setLoadingFailedOrders(false);
        setErrorFailedOrders('');
      },
      (loadError) => {
        setErrorFailedOrders(loadError.message || 'Unable to load failed orders.');
        setLoadingFailedOrders(false);
      },
    );

    return () => {
      unsubStats();
      unsubPayments();
      unsubFailedOrders();
    };
  }, [adminUser]);

  const computedStats = useMemo(() => {
    const now = new Date();
    const todayKey = dateKeyInTz(now);
    const monthKey = monthKeyInTz(now);
    const fromDoc = statsDoc ?? emptyStats();

    let totalRevenue = Number(fromDoc.totalRevenue ?? 0);
    let totalPayments = Number(fromDoc.totalPayments ?? 0);
    let currentMonthRevenue = Number(fromDoc.currentMonthRevenue ?? 0);
    let currentMonthPayments = Number(fromDoc.currentMonthPayments ?? 0);
    let todayRevenue = Number(fromDoc.todayRevenue ?? 0);
    let todayPayments = Number(fromDoc.todayPayments ?? 0);

    if (!totalRevenue && payments.length) {
      totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0);
      totalPayments = payments.length;
    }

    if (payments.length) {
      currentMonthRevenue = payments.reduce((sum, payment) => {
        return monthKeyInTz(payment.createdAtDate) === monthKey ? sum + payment.amount : sum;
      }, 0);
      currentMonthPayments = payments.filter((payment) => monthKeyInTz(payment.createdAtDate) === monthKey).length;
      todayRevenue = payments.reduce((sum, payment) => {
        return dateKeyInTz(payment.createdAtDate) === todayKey ? sum + payment.amount : sum;
      }, 0);
      todayPayments = payments.filter((payment) => dateKeyInTz(payment.createdAtDate) === todayKey).length;
    }

    return {
      currency: String(fromDoc.currency || 'TZS').toUpperCase(),
      totalRevenue,
      totalPayments,
      currentMonthRevenue,
      currentMonthPayments,
      todayRevenue,
      todayPayments,
      updatedAtDate: fromDoc.updatedAtDate,
    };
  }, [payments, statsDoc]);

  const visibleCurrency = showUsd ? 'USD' : computedStats.currency;
  const amountDivisor = showUsd ? USD_RATE : 1;

  const trendData = useMemo(() => {
    return buildRevenueTrend(payments, trendRange, amountDivisor);
  }, [payments, trendRange, amountDivisor]);

  const trendDeltaLabel = useMemo(() => {
    const points = trendData.points;
    if (points.length < 2) {
      return 'No change baseline yet';
    }
    const latest = Number(points[points.length - 1]?.value ?? 0);
    const previous = Number(points[points.length - 2]?.value ?? 0);
    if (previous <= 0) {
      return 'No previous baseline';
    }
    const pct = ((latest - previous) / previous) * 100;
    const sign = pct >= 0 ? '+' : '';
    return `${sign}${pct.toFixed(1)}% vs previous period`;
  }, [trendData.points]);

  const subscriptionBreakdown = useMemo(() => {
    const plans = new Map([
      ['premium_daily', { key: 'premium_daily', label: 'Premium Daily', count: 0, amount: 0 }],
      ['premium_weekly', { key: 'premium_weekly', label: 'Premium Weekly', count: 0, amount: 0 }],
      ['premium_monthly', { key: 'premium_monthly', label: 'Premium Monthly', count: 0, amount: 0 }],
    ]);

    payments.forEach((payment) => {
      const key = String(payment.productId || '').toLowerCase();
      const row = plans.get(key);
      if (!row) {
        return;
      }
      row.count += 1;
      row.amount += payment.amount;
    });

    const rows = [...plans.values()].filter((entry) => entry.count > 0);
    const total = rows.reduce((sum, entry) => sum + entry.count, 0);

    return rows.map((entry) => ({
      ...entry,
      percent: total > 0 ? Math.round((entry.count / total) * 100) : 0,
      avgAmount: entry.count > 0 ? entry.amount / entry.count : 0,
    }));
  }, [payments]);

  const monthShareOfTotal = computedStats.totalRevenue > 0
    ? Math.round((computedStats.currentMonthRevenue / computedStats.totalRevenue) * 100)
    : 0;
  const todayShareOfMonth = computedStats.currentMonthRevenue > 0
    ? Math.round((computedStats.todayRevenue / computedStats.currentMonthRevenue) * 100)
    : 0;
  const totalAttempts = computedStats.totalPayments + failedOrders.length;
  const collectionHealth = useMemo(() => ([
    {
      key: 'successful',
      label: 'Successful',
      value: computedStats.totalPayments,
      tone: '#0f8a5f',
      meta: `${formatPercent(totalAttempts > 0 ? computedStats.totalPayments / totalAttempts : 0)} conversion`,
    },
    {
      key: 'failed',
      label: 'Failed',
      value: failedOrders.length,
      tone: '#d95c5c',
      meta: `${formatPercent(totalAttempts > 0 ? failedOrders.length / totalAttempts : 0)} fallout`,
    },
  ]), [computedStats.totalPayments, failedOrders.length, totalAttempts]);

  const selectedFailedOrder = useMemo(
    () => failedOrders.find((entry) => entry.id === selectedFailedOrderId) ?? null,
    [failedOrders, selectedFailedOrderId],
  );

  useEffect(() => {
    let cancelled = false;

    const loadUser = async () => {
      const uid = selectedFailedOrder?.uid;
      if (!uid) {
        setSelectedFailedOrderUser(null);
        setLoadingSelectedFailedOrderUser(false);
        return;
      }
      setLoadingSelectedFailedOrderUser(true);
      try {
        const snapshot = await getDoc(doc(firestore, 'users', uid));
        if (cancelled) {
          return;
        }
        setSelectedFailedOrderUser(
          snapshot.exists() ? normalizeRevenueUser(snapshot.id, snapshot.data() ?? {}) : null,
        );
      } catch {
        if (cancelled) {
          return;
        }
        setSelectedFailedOrderUser(null);
      } finally {
        if (!cancelled) {
          setLoadingSelectedFailedOrderUser(false);
        }
      }
    };

    loadUser();
    return () => {
      cancelled = true;
    };
  }, [selectedFailedOrder?.uid]);

  const failedOrderPhone = selectedFailedOrderUser?.phoneNumber || selectedFailedOrder?.msisdn || '';

  const closeFailedOrderModal = () => {
    setSelectedFailedOrderId('');
    setSelectedFailedOrderUser(null);
    setLoadingSelectedFailedOrderUser(false);
  };

  const handleCopyValue = async (value, label = 'Copied') => {
    const safeValue = String(value || '').trim();
    if (!safeValue) {
      pushToast({ type: 'error', title: 'Nothing to copy', message: 'Value is not available.' });
      return;
    }
    try {
      await navigator.clipboard.writeText(safeValue);
      pushToast({ type: 'success', title: label, message: safeValue });
    } catch {
      pushToast({ type: 'error', title: 'Copy failed', message: 'Clipboard is unavailable.' });
    }
  };

  const handlePhoneAction = (scheme, value) => {
    const normalized = normalizePhoneForUri(value);
    if (!normalized) {
      pushToast({ type: 'error', title: 'Invalid number', message: 'Phone number is missing or invalid.' });
      return;
    }
    try {
      window.location.href = `${scheme}:${normalized}`;
    } catch {
      pushToast({
        type: 'error',
        title: scheme === 'sms' ? 'SMS failed' : 'Call failed',
        message: 'Unable to open phone actions.',
      });
    }
  };

  const transactionsColumns = useMemo(() => {
    return [
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        sortValue: (row) => row.amount,
        render: (row) => (
          <div>
            <p className="revenue-table-title">{formatMoney(row.amount / amountDivisor, visibleCurrency)}</p>
            <p className="revenue-table-subtitle">{planLabel(row.productId)}</p>
          </div>
        ),
      },
      {
        key: 'provider',
        label: 'Provider',
        sortable: true,
        render: (row) => <span className="status-badge live">{(row.provider || '--').toUpperCase()}</span>,
      },
      {
        key: 'user',
        label: 'User',
        sortable: true,
        sortValue: (row) => row.uid,
        render: (row) => <span className="revenue-code">{row.uid || '--'}</span>,
      },
      {
        key: 'phone',
        label: 'Phone',
        sortable: true,
        sortValue: (row) => row.msisdn,
        render: (row) => row.msisdn || '--',
      },
      {
        key: 'time',
        label: 'Time',
        sortable: true,
        sortValue: (row) => row.createdAtDate?.getTime?.() ?? 0,
        render: (row) => (row.createdAtDate ? formatDateTime(row.createdAtDate) : '--'),
      },
    ];
  }, [amountDivisor, visibleCurrency]);

  const failedOrdersColumns = useMemo(() => {
    return [
      {
        key: 'amount',
        label: 'Amount',
        sortable: true,
        sortValue: (row) => row.amount,
        render: (row) => (
          <div>
            <p className="revenue-table-title">{formatMoney(row.amount / amountDivisor, visibleCurrency)}</p>
            <p className="revenue-table-subtitle">{planLabel(row.productId)}</p>
          </div>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        sortable: true,
        render: (row) => <span className={`status-badge ${statusTone(row.status)}`.trim()}>{humanizeStatus(row.status)}</span>,
      },
      {
        key: 'reason',
        label: 'Reason',
        sortable: true,
        sortValue: (row) => row.reason,
        render: (row) => row.reason || '--',
      },
      {
        key: 'provider',
        label: 'Provider',
        sortable: true,
        render: (row) => row.provider || '--',
      },
      {
        key: 'time',
        label: 'Updated',
        sortable: true,
        sortValue: (row) => row.updatedAtDate?.getTime?.() ?? row.createdAtDate?.getTime?.() ?? 0,
        render: (row) => {
          const date = row.updatedAtDate || row.createdAtDate;
          return date ? formatDateTime(date) : '--';
        },
      },
      {
        key: 'actions',
        label: 'Actions',
        render: (row) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={(event) => {
              event.stopPropagation();
              setSelectedFailedOrderId(row.id);
            }}
          >
            View
          </Button>
        ),
      },
    ];
  }, [amountDivisor, visibleCurrency]);

  if (!adminUser) {
    return <Navigate to="/" replace />;
  }

  const initialLoading = loadingStats && loadingPayments && loadingFailedOrders;
  const surfaceError = errorStats || errorPayments || errorFailedOrders;

  return (
    <AppShell
      pageTitle="Revenue"
      pageDescription="Sales performance, subscriptions, and failed orders"
      navItems={revenueNavItems}
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
          { label: 'Revenue' },
        ]}
      />

      {surfaceError ? (
        <ErrorState
          title="Some revenue data failed to load"
          description={surfaceError}
        />
      ) : null}

      <Tabs
        tabs={TABS}
        activeKey={activeTab}
        onChange={setActiveTab}
        ariaLabel="Revenue tabs"
        className="revenue-page-tabs"
      />

      <div className="revenue-content-toolbar">
        <div className="quick-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => downloadSalesReport(payments)}
            disabled={loadingPayments || payments.length === 0}
          >
            Download CSV
          </Button>
          <Button size="sm" variant={showUsd ? 'secondary' : 'primary'} onClick={() => setShowUsd(false)}>
            TZS
          </Button>
          <Button size="sm" variant={showUsd ? 'primary' : 'secondary'} onClick={() => setShowUsd(true)}>
            USD
          </Button>
        </div>
      </div>

      {activeTab === 'overview' ? (
        <section className="ui-stack">
          <section className="admin-summary-visual-grid revenue-summary-visual-grid">
            {initialLoading ? (
              <>
                <SkeletonLoader size="xl" />
                <SkeletonLoader size="xl" />
              </>
            ) : (
              <>
                <RevenuePulseCard
                  totalRevenue={formatMoney(computedStats.totalRevenue / amountDivisor, visibleCurrency)}
                  totalPayments={computedStats.totalPayments}
                  monthRevenue={formatMoney(computedStats.currentMonthRevenue / amountDivisor, visibleCurrency)}
                  monthPayments={computedStats.currentMonthPayments}
                  todayRevenue={formatMoney(computedStats.todayRevenue / amountDivisor, visibleCurrency)}
                  todayPayments={computedStats.todayPayments}
                  monthShareOfTotal={monthShareOfTotal}
                  todayShareOfMonth={todayShareOfMonth}
                  trendDeltaLabel={trendDeltaLabel}
                  visibleCurrency={visibleCurrency}
                />
                <CollectionHealthCard
                  segments={collectionHealth}
                  totalAttempts={totalAttempts}
                  failedOrders={failedOrders.length}
                  planBreakdown={subscriptionBreakdown}
                />
              </>
            )}
          </section>

          <Card
            className="admin-analytics-card"
            title="Revenue Trend"
            subtitle={trendData.subtitle}
            hover
            headRight={(
              <Tabs
                tabs={RANGE_TABS}
                activeKey={trendRange}
                onChange={setTrendRange}
                ariaLabel="Trend range"
                className="revenue-range-tabs"
              />
            )}
          >
            {loadingPayments ? (
              <SkeletonLoader size="xl" />
            ) : (
              <>
                <TrendChart
                  points={trendData.points}
                  tone="success"
                  ariaLabel={`Revenue ${trendRange} trend`}
                />
                <p className="ui-card-subtitle revenue-trend-footnote">
                  {trendDeltaLabel} • Totals shown in {visibleCurrency}
                </p>
              </>
            )}
          </Card>

          <Card
            className="admin-analytics-card"
            title="Recent Transactions"
            subtitle="Most recent successful payments"
            hover
          >
            {loadingPayments ? (
              <SkeletonLoader size="xl" />
            ) : payments.length === 0 ? (
              <EmptyState title="No successful payments yet" description="Transactions will appear here." icon="payments" />
            ) : isMobileViewport ? (
              <RevenueTransactionsMobileList
                rows={payments.slice(0, 8)}
                amountDivisor={amountDivisor}
                visibleCurrency={visibleCurrency}
              />
            ) : (
              <Table
                columns={transactionsColumns}
                rows={payments.slice(0, 8)}
                getRowId={(row) => row.id}
                pageSize={8}
              />
            )}
          </Card>
        </section>
      ) : null}

      {activeTab === 'transactions' ? (
        <Card
          className="admin-analytics-card"
          title="All Transactions"
          subtitle="Successful payments ordered by latest"
          hover
        >
          {errorPayments ? (
            <ErrorState title="Unable to load transactions" description={errorPayments} />
          ) : loadingPayments ? (
            <SkeletonLoader size="xl" />
          ) : payments.length === 0 ? (
            <EmptyState title="No transactions yet" description="Successful payments will appear here." icon="payments" />
          ) : isMobileViewport ? (
            <RevenueTransactionsMobileList
              rows={payments}
              amountDivisor={amountDivisor}
              visibleCurrency={visibleCurrency}
            />
          ) : (
            <Table
              columns={transactionsColumns}
              rows={payments}
              getRowId={(row) => row.id}
              pageSize={12}
            />
          )}
        </Card>
      ) : null}

      {activeTab === 'subscriptions' ? (
        <section className="surface-split">
          <Card
            className="admin-analytics-card"
            title="Plan Distribution"
            subtitle="Breakdown by subscription plan"
            hover
          >
            {loadingPayments ? (
              <SkeletonLoader size="xl" />
            ) : subscriptionBreakdown.length === 0 ? (
              <EmptyState title="No subscription data" description="Plan distribution appears once sales are available." icon="upgrade" />
            ) : (
              <div className="revenue-plan-list">
                {subscriptionBreakdown.map((row) => (
                  <article key={row.key} className="revenue-plan-row">
                    <div className="revenue-plan-head">
                      <p>{row.label}</p>
                      <strong>{row.count}</strong>
                    </div>
                    <progress className="admin-role-bar" max="100" value={row.percent} aria-label={`${row.label} share`} />
                    <p className="admin-role-meta">
                      {row.percent}% • Avg {formatMoney(row.avgAmount / amountDivisor, visibleCurrency)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </Card>

          <Card
            className="admin-analytics-card"
            title="Subscriptions Snapshot"
            subtitle={computedStats.updatedAtDate ? `Updated ${formatDateTime(computedStats.updatedAtDate)}` : 'Live snapshot'}
            hover
          >
            {loadingPayments ? (
              <SkeletonLoader size="xl" />
            ) : (
              <div className="admin-snapshot-grid">
                <article className="admin-snapshot-item">
                  <p className="admin-snapshot-label">Total revenue</p>
                  <p className="admin-snapshot-value">{formatMoney(computedStats.totalRevenue / amountDivisor, visibleCurrency)}</p>
                </article>
                <article className="admin-snapshot-item">
                  <p className="admin-snapshot-label">Total payments</p>
                  <p className="admin-snapshot-value">{formatCompact(computedStats.totalPayments)}</p>
                </article>
                <article className="admin-snapshot-item">
                  <p className="admin-snapshot-label">This month</p>
                  <p className="admin-snapshot-value">{formatMoney(computedStats.currentMonthRevenue / amountDivisor, visibleCurrency)}</p>
                </article>
                <article className="admin-snapshot-item">
                  <p className="admin-snapshot-label">Today</p>
                  <p className="admin-snapshot-value">{formatMoney(computedStats.todayRevenue / amountDivisor, visibleCurrency)}</p>
                </article>
              </div>
            )}
          </Card>
        </section>
      ) : null}

      {activeTab === 'failed' ? (
        <Card
          className="admin-analytics-card"
          title="Failed Orders"
          subtitle="Payment intents that did not complete"
          hover
        >
          {errorFailedOrders ? (
            <ErrorState title="Unable to load failed orders" description={errorFailedOrders} />
          ) : loadingFailedOrders ? (
            <SkeletonLoader size="xl" />
          ) : failedOrders.length === 0 ? (
            <EmptyState title="No failed orders" description="Failed payment intents will appear here." icon="check" />
          ) : isMobileViewport ? (
            <RevenueFailedOrdersMobileList
              rows={failedOrders}
              amountDivisor={amountDivisor}
              visibleCurrency={visibleCurrency}
              onView={(row) => setSelectedFailedOrderId(row.id)}
            />
          ) : (
            <Table
              columns={failedOrdersColumns}
              rows={failedOrders}
              getRowId={(row) => row.id}
              pageSize={12}
              onRowClick={(row) => setSelectedFailedOrderId(row.id)}
            />
          )}
        </Card>
      ) : null}

      <Modal
        open={Boolean(selectedFailedOrder)}
        title="Failed Order Details"
        onClose={closeFailedOrderModal}
        footer={(
          <Button type="button" variant="secondary" onClick={closeFailedOrderModal}>
            Close
          </Button>
        )}
      >
        {selectedFailedOrder ? (
          <section className="ui-stack">
            <div className="profile-modal-grid">
              <article className="profile-modal-item">
                <p className="profile-modal-label">Amount</p>
                <p className="profile-modal-value">{formatMoney(selectedFailedOrder.amount / amountDivisor, visibleCurrency)}</p>
                <p className="ui-card-subtitle">
                  {planLabel(selectedFailedOrder.productId)} • {(selectedFailedOrder.provider || '--').toUpperCase()}
                </p>
              </article>
              <article className="profile-modal-item">
                <p className="profile-modal-label">Status</p>
                <p className="profile-modal-value">
                  <span className={`status-badge ${statusTone(selectedFailedOrder.status)}`.trim()}>
                    {humanizeStatus(selectedFailedOrder.status)}
                  </span>
                </p>
                <p className="ui-card-subtitle">
                  {selectedFailedOrder.updatedAtDate || selectedFailedOrder.createdAtDate
                    ? formatDateTime(selectedFailedOrder.updatedAtDate || selectedFailedOrder.createdAtDate)
                    : '--'}
                </p>
              </article>
              <article className="profile-modal-item revenue-failed-modal-wide">
                <p className="profile-modal-label">Reason</p>
                <p className="profile-modal-value">{selectedFailedOrder.reason || 'No reason submitted.'}</p>
                {selectedFailedOrder.followUpQuestion ? (
                  <p className="ui-card-subtitle">Question: {selectedFailedOrder.followUpQuestion}</p>
                ) : null}
                {selectedFailedOrder.message ? (
                  <p className="ui-card-subtitle">Provider message: {selectedFailedOrder.message}</p>
                ) : null}
              </article>
            </div>

            <div className="profile-modal-grid">
              <article className="profile-modal-item">
                <p className="profile-modal-label">User</p>
                {loadingSelectedFailedOrderUser ? (
                  <p className="profile-modal-value">Loading user details...</p>
                ) : (
                  <>
                    <p className="profile-modal-value">
                      {selectedFailedOrderUser?.displayName || 'Unknown member'}
                    </p>
                    <p className="ui-card-subtitle">
                      {selectedFailedOrderUser?.username
                        ? `@${selectedFailedOrderUser.username}`
                        : (selectedFailedOrderUser?.email || '--')}
                    </p>
                    <p className="profile-modal-value profile-modal-value-mono">
                      UID: {selectedFailedOrder.uid || '--'}
                    </p>
                  </>
                )}
              </article>
              <article className="profile-modal-item">
                <p className="profile-modal-label">Contact</p>
                <p className="profile-modal-value profile-modal-value-mono">{failedOrderPhone || '--'}</p>
                <div className="quick-actions">
                  <Button size="sm" variant="secondary" onClick={() => handleCopyValue(failedOrderPhone, 'Phone copied')}>
                    Copy Number
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handlePhoneAction('tel', failedOrderPhone)}>
                    Call
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => handlePhoneAction('sms', failedOrderPhone)}>
                    SMS
                  </Button>
                </div>
              </article>
              <article className="profile-modal-item revenue-failed-modal-wide">
                <p className="profile-modal-label">Reference IDs</p>
                <div className="revenue-reference-list">
                  <p className="profile-modal-value profile-modal-value-mono">Intent ID: {selectedFailedOrder.id}</p>
                  <p className="profile-modal-value profile-modal-value-mono">
                    External ID: {selectedFailedOrder.externalId || '--'}
                  </p>
                  <p className="profile-modal-value profile-modal-value-mono">
                    Trans ID: {selectedFailedOrder.transid || '--'}
                  </p>
                  <p className="profile-modal-value profile-modal-value-mono">
                    MNO Ref: {selectedFailedOrder.mnoreference || '--'}
                  </p>
                </div>
              </article>
            </div>
          </section>
        ) : null}
      </Modal>
    </AppShell>
  );
};

export default AdminRevenuePage;

function RevenuePulseCard({
  totalRevenue,
  totalPayments,
  monthRevenue,
  monthPayments,
  todayRevenue,
  todayPayments,
  monthShareOfTotal,
  todayShareOfMonth,
  trendDeltaLabel,
  visibleCurrency,
}) {
  return (
    <Card
      className="admin-analytics-card revenue-visual-card"
      title="Revenue Pulse"
      subtitle={`${trendDeltaLabel} • Totals shown in ${visibleCurrency}`}
      hover
      headRight={<span className="admin-metric-chip tone-success">{formatCompact(totalPayments)} settled payments</span>}
    >
      <div className="revenue-pulse-grid">
        <section className="revenue-pulse-total">
          <span className="revenue-pulse-eyebrow">Collected revenue</span>
          <strong>{totalRevenue}</strong>
          <p>All successful payments captured across the workspace.</p>
        </section>

        <div className="revenue-pulse-tiles">
          <article className="revenue-pulse-tile">
            <p>This month</p>
            <strong>{monthRevenue}</strong>
            <span>{formatCompact(monthPayments)} payments</span>
          </article>
          <article className="revenue-pulse-tile">
            <p>Today</p>
            <strong>{todayRevenue}</strong>
            <span>{formatCompact(todayPayments)} payments</span>
          </article>
        </div>

        <div className="revenue-pulse-rail-list">
          <ProgressMetric
            label="Month contribution"
            value={`${monthShareOfTotal}% of total revenue`}
            percent={monthShareOfTotal}
            tone="accent"
          />
          <ProgressMetric
            label="Today contribution"
            value={`${todayShareOfMonth}% of monthly revenue`}
            percent={todayShareOfMonth}
            tone="primary"
          />
        </div>
      </div>
    </Card>
  );
}

function CollectionHealthCard({ segments, totalAttempts, failedOrders, planBreakdown }) {
  const topPlans = planBreakdown.slice(0, 3);

  return (
    <Card
      className="admin-analytics-card revenue-visual-card"
      title="Collection Health"
      subtitle="Successful and failed payment intent mix"
      hover
      headRight={(
        <span className={`admin-metric-chip ${failedOrders > 0 ? 'tone-error' : 'tone-success'}`.trim()}>
          {formatCompact(failedOrders)} failed orders
        </span>
      )}
    >
      <div className="revenue-health-grid">
        <InteractiveDonut
          segments={segments}
          total={totalAttempts}
          centerLabel="Attempts"
          centerValue={formatCompact(totalAttempts)}
        />

        <div className="revenue-health-side">
          <div className="revenue-health-legend">
            {segments.map((segment) => (
              <article key={segment.key} className="revenue-health-item">
                <div className="revenue-health-item-head">
                  <span className="admin-role-distribution-dot" style={{ background: segment.tone }} aria-hidden="true" />
                  <p>{segment.label}</p>
                  <strong>{formatCompact(segment.value)}</strong>
                </div>
                <span className="admin-role-distribution-meta">{segment.meta}</span>
              </article>
            ))}
          </div>

          <div className="revenue-plan-mini-list">
            <p className="revenue-plan-mini-title">Top plan mix</p>
            {topPlans.length > 0 ? (
              topPlans.map((row) => (
                <ProgressMetric
                  key={row.key}
                  label={row.label}
                  value={`${row.percent}% of sales`}
                  percent={row.percent}
                  tone="success"
                />
              ))
            ) : (
              <p className="ui-card-subtitle">No subscription mix yet.</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ProgressMetric({ label, value, percent, tone = 'primary' }) {
  const safePercent = Math.max(0, Math.min(100, Number(percent || 0)));
  return (
    <article className="revenue-progress-metric">
      <div className="revenue-progress-metric-head">
        <p>{label}</p>
        <span>{value}</span>
      </div>
      <div className="revenue-progress-track" aria-hidden="true">
        <span className={`revenue-progress-fill tone-${tone}`.trim()} style={{ width: `${safePercent}%` }} />
      </div>
    </article>
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
              : 'Tap or hover chart for detail'}
          </small>
        </div>
      </div>
    </div>
  );
}

function RevenueTransactionsMobileList({ rows, amountDivisor, visibleCurrency }) {
  return (
    <div className="revenue-mobile-list">
      {rows.map((row) => (
        <article key={row.id} className="revenue-mobile-card">
          <div className="revenue-mobile-card-head">
            <div className="revenue-mobile-card-copy">
              <p className="revenue-table-title">{formatMoney(row.amount / amountDivisor, visibleCurrency)}</p>
              <p className="revenue-table-subtitle">{planLabel(row.productId)}</p>
            </div>
            <span className="status-badge live">{(row.provider || '--').toUpperCase()}</span>
          </div>

          <div className="revenue-mobile-meta">
            <p>
              <span>User</span>
              <strong className="revenue-code">{row.uid || '--'}</strong>
            </p>
            <p>
              <span>Phone</span>
              <strong>{row.msisdn || '--'}</strong>
            </p>
            <p>
              <span>Time</span>
              <strong>{row.createdAtDate ? formatDateTime(row.createdAtDate) : '--'}</strong>
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

function RevenueFailedOrdersMobileList({ rows, amountDivisor, visibleCurrency, onView }) {
  return (
    <div className="revenue-mobile-list">
      {rows.map((row) => (
        <article key={row.id} className="revenue-mobile-card">
          <div className="revenue-mobile-card-head">
            <div className="revenue-mobile-card-copy">
              <p className="revenue-table-title">{formatMoney(row.amount / amountDivisor, visibleCurrency)}</p>
              <p className="revenue-table-subtitle">{planLabel(row.productId)}</p>
            </div>
            <div className="revenue-mobile-card-actions">
              <span className={`status-badge ${statusTone(row.status)}`.trim()}>{humanizeStatus(row.status)}</span>
              <Button size="sm" variant="secondary" onClick={() => onView(row)}>
                View
              </Button>
            </div>
          </div>

          <div className="revenue-mobile-meta">
            <p>
              <span>Reason</span>
              <strong>{row.reason || '--'}</strong>
            </p>
            <p>
              <span>Provider</span>
              <strong>{row.provider || '--'}</strong>
            </p>
            <p>
              <span>Updated</span>
              <strong>{row.updatedAtDate || row.createdAtDate ? formatDateTime(row.updatedAtDate || row.createdAtDate) : '--'}</strong>
            </p>
          </div>
        </article>
      ))}
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

function normalizeRevenueStats(data = {}) {
  return {
    currency: String(data.currency || 'TZS').toUpperCase(),
    totalRevenue: toNumber(data.totalRevenue),
    totalPayments: toInteger(data.totalPayments),
    currentMonthRevenue: toNumber(data.currentMonthRevenue),
    currentMonthPayments: toInteger(data.currentMonthPayments),
    todayRevenue: toNumber(data.todayRevenue),
    todayPayments: toInteger(data.todayPayments),
    updatedAtDate: timestampToDate(data.updatedAt),
  };
}

function normalizePayment(id, data = {}) {
  return {
    id,
    uid: String(data.uid || '').trim(),
    productId: String(data.productId || '').trim(),
    amount: toNumber(data.amount),
    currency: String(data.currency || 'TZS').toUpperCase(),
    provider: String(data.provider || '').trim(),
    msisdn: String(data.msisdn || '').trim(),
    createdAtDate: timestampToDate(data.createdAt),
  };
}

function normalizeFailedOrder(id, data = {}) {
  const followUp = isPlainObject(data.followUp) ? data.followUp : {};
  const reason = String(
    data.followUpReasonLabel
      || followUp.reasonLabel
      || data.message
      || data.transactionstatus
      || data.transactionStatus
      || data.status
      || 'No reason submitted.',
  ).trim();

  return {
    id,
    uid: String(data.uid || data.userId || '').trim(),
    productId: String(data.productId || data.bookID || '').trim(),
    amount: toNumber(data.amount),
    currency: String(data.currency || 'TZS').toUpperCase(),
    provider: String(data.provider || '').trim(),
    msisdn: String(data.msisdn || '').trim(),
    status: String(data.transactionstatus || data.transactionStatus || data.status || 'failed').trim().toLowerCase(),
    reason,
    followUpQuestion: toOptionalText(data.followUpQuestion || followUp.question),
    message: toOptionalText(data.message),
    externalId: toOptionalText(data.externalId),
    transid: toOptionalText(data.transid),
    mnoreference: toOptionalText(data.mnoreference || data.mnoReference),
    createdAtDate: timestampToDate(data.createdAt),
    updatedAtDate: timestampToDate(data.updatedAt),
  };
}

function normalizeRevenueUser(uid, data = {}) {
  return {
    uid,
    displayName: toOptionalText(data.displayName || data.username || data.email || 'Unknown member'),
    username: toOptionalText(data.username),
    email: toOptionalText(data.email),
    phoneNumber: toOptionalText(data.phoneNumber || data.msisdn),
  };
}

function emptyStats() {
  return {
    currency: 'TZS',
    totalRevenue: 0,
    totalPayments: 0,
    currentMonthRevenue: 0,
    currentMonthPayments: 0,
    todayRevenue: 0,
    todayPayments: 0,
    updatedAtDate: null,
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function toInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function formatMoney(value, currency = 'TZS') {
  const amount = Number(value || 0);
  const useDecimals = String(currency).toUpperCase() === 'USD';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: useDecimals ? 2 : 0,
    maximumFractionDigits: useDecimals ? 2 : 0,
  }).format(amount) + ` ${currency}`;
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value ?? 0),
  );
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function planLabel(productId) {
  const key = String(productId || '').toLowerCase();
  if (key === 'premium_daily') {
    return 'Premium Daily';
  }
  if (key === 'premium_weekly') {
    return 'Premium Weekly';
  }
  if (key === 'premium_monthly') {
    return 'Premium Monthly';
  }
  return key || 'Unknown Plan';
}

function humanizeStatus(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Failed';
}

function statusTone(status) {
  const key = String(status || '').toLowerCase();
  if (key.includes('paid') || key.includes('success')) {
    return 'paid';
  }
  if (key.includes('pending') || key.includes('created')) {
    return 'pending';
  }
  if (key.includes('cancel') || key.includes('expired') || key.includes('fail')) {
    return 'failed';
  }
  return 'error';
}

function dateKeyInTz(value, timeZone = 'Africa/Dar_es_Salaam') {
  const date = value instanceof Date ? value : timestampToDate(value);
  if (!date) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function monthKeyInTz(value, timeZone = 'Africa/Dar_es_Salaam') {
  const date = value instanceof Date ? value : timestampToDate(value);
  if (!date) {
    return '';
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  });
  return formatter.format(date);
}

function buildRevenueTrend(payments, range, divisor = 1) {
  const now = new Date();

  if (range === 'weekly') {
    return buildWeeklyTrend(payments, now, divisor);
  }
  if (range === 'monthly') {
    return buildMonthlyTrend(payments, now, divisor);
  }
  return buildDailyTrend(payments, now, divisor);
}

function buildDailyTrend(payments, now, divisor) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const rows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      key: date.toISOString(),
      dayStart: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      value: 0,
    };
  });

  payments.forEach((payment) => {
    const date = payment.createdAtDate;
    if (!(date instanceof Date)) {
      return;
    }
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.floor((day.getTime() - rows[0].dayStart.getTime()) / (24 * 60 * 60 * 1000));
    if (diff >= 0 && diff < rows.length) {
      rows[diff].value += payment.amount / divisor;
    }
  });

  return {
    subtitle: 'Last 7 days revenue performance',
    points: rows.map((row) => ({ key: row.key, label: row.label, value: roundTrendValue(row.value) })),
  };
}

function buildWeeklyTrend(payments, now, divisor) {
  const currentWeekStart = weekStart(now);
  const firstStart = new Date(currentWeekStart);
  firstStart.setDate(currentWeekStart.getDate() - 5 * 7);

  const rows = Array.from({ length: 6 }, (_, index) => {
    const start = new Date(firstStart);
    start.setDate(firstStart.getDate() + index * 7);
    return {
      key: start.toISOString(),
      start,
      label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: 0,
    };
  });

  payments.forEach((payment) => {
    const date = payment.createdAtDate;
    if (!(date instanceof Date)) {
      return;
    }
    const paymentWeekStart = weekStart(date);
    const diffWeeks = Math.floor((paymentWeekStart.getTime() - rows[0].start.getTime()) / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks >= 0 && diffWeeks < rows.length) {
      rows[diffWeeks].value += payment.amount / divisor;
    }
  });

  return {
    subtitle: 'Last 6 weeks revenue performance',
    points: rows.map((row) => ({ key: row.key, label: row.label, value: roundTrendValue(row.value) })),
  };
}

function buildMonthlyTrend(payments, now, divisor) {
  const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const rows = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return {
      key: monthDate.toISOString(),
      monthDate,
      label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
      value: 0,
    };
  });

  payments.forEach((payment) => {
    const date = payment.createdAtDate;
    if (!(date instanceof Date)) {
      return;
    }
    const monthIndex = (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
    if (monthIndex >= 0 && monthIndex < rows.length) {
      rows[monthIndex].value += payment.amount / divisor;
    }
  });

  return {
    subtitle: 'Last 6 months revenue performance',
    points: rows.map((row) => ({ key: row.key, label: row.label, value: roundTrendValue(row.value) })),
  };
}

function weekStart(value) {
  const date = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function roundTrendValue(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toOptionalText(value) {
  return String(value ?? '').trim();
}

function normalizePhoneForUri(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  const hasPlus = text.startsWith('+');
  const digitsOnly = text.replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    return '';
  }
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

function downloadSalesReport(rows = []) {
  if (typeof document === 'undefined' || !Array.isArray(rows) || rows.length === 0) {
    return;
  }

  const headers = [
    'paymentId',
    'uid',
    'productId',
    'amount',
    'currency',
    'provider',
    'msisdn',
    'createdAt',
  ];
  const lines = rows.map((row) => [
    row.id,
    row.uid,
    row.productId,
    String(row.amount ?? 0),
    row.currency,
    row.provider,
    row.msisdn,
    row.createdAtDate instanceof Date ? row.createdAtDate.toISOString() : '',
  ]);

  const csv = [headers, ...lines]
    .map((line) => line.map(escapeCsvValue).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `sales-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}
