import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { addDoc, collection, limit as limitQuery, onSnapshot, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestore, storage } from '../firebase/init';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { isAdmin, isMember, isTrader } from '../utils/roleHelpers';
import { isPremiumActive } from '../utils/membershipHelpers';
import { useEngagementStore } from '../hooks/useEngagementStore';
import useSignalPremiumDetails from '../hooks/useSignalPremiumDetails';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FiltersPanel,
  Input,
  Modal,
  Select,
  SkeletonLoader,
  Tabs,
  Textarea,
  Toggle,
  useToast,
} from './ui';
import { memberNavigation, traderAdminNavigation } from '../config/navigation';
import {
  formatDateTime,
  getSignalSessionBucket,
  normalizeSignal,
  SESSION_TABS,
} from '../utils/tradingData';
import AppIcon from './icons/AppIcon';
import { adminNavigation } from '../config/adminNavigation';

const SIGNAL_DIRECTION_OPTIONS = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
];

const SIGNAL_SESSION_OPTIONS = [
  { value: 'ASIA', label: 'Asia' },
  { value: 'LONDON', label: 'London' },
  { value: 'NEW_YORK', label: 'New York' },
];

const SIGNAL_ENTRY_TYPE_OPTIONS = [
  { value: 'Market', label: 'Market' },
  { value: 'Limit', label: 'Limit' },
  { value: 'Breakout', label: 'Breakout' },
];

const SIGNAL_RISK_OPTIONS = [
  { value: 'Low', label: 'Low' },
  { value: 'Medium', label: 'Medium' },
  { value: 'High', label: 'High' },
];

const SIGNAL_PAIR_OPTIONS = [
  { value: '', label: 'Select pair' },
  { value: 'EURUSD', label: 'EUR/USD' },
  { value: 'GBPUSD', label: 'GBP/USD' },
  { value: 'USDJPY', label: 'USD/JPY' },
  { value: 'USDCHF', label: 'USD/CHF' },
  { value: 'AUDUSD', label: 'AUD/USD' },
  { value: 'USDCAD', label: 'USD/CAD' },
  { value: 'NZDUSD', label: 'NZD/USD' },
  { value: 'EURGBP', label: 'EUR/GBP' },
  { value: 'EURJPY', label: 'EUR/JPY' },
  { value: 'EURCHF', label: 'EUR/CHF' },
  { value: 'EURAUD', label: 'EUR/AUD' },
  { value: 'EURCAD', label: 'EUR/CAD' },
  { value: 'EURNZD', label: 'EUR/NZD' },
  { value: 'GBPJPY', label: 'GBP/JPY' },
  { value: 'GBPCHF', label: 'GBP/CHF' },
  { value: 'GBPAUD', label: 'GBP/AUD' },
  { value: 'GBPCAD', label: 'GBP/CAD' },
  { value: 'GBPNZD', label: 'GBP/NZD' },
  { value: 'AUDJPY', label: 'AUD/JPY' },
  { value: 'AUDNZD', label: 'AUD/NZD' },
  { value: 'AUDCAD', label: 'AUD/CAD' },
  { value: 'AUDCHF', label: 'AUD/CHF' },
  { value: 'CADJPY', label: 'CAD/JPY' },
  { value: 'CADCHF', label: 'CAD/CHF' },
  { value: 'NZDJPY', label: 'NZD/JPY' },
  { value: 'NZDCHF', label: 'NZD/CHF' },
  { value: 'CHFJPY', label: 'CHF/JPY' },
  { value: 'USDZAR', label: 'USD/ZAR' },
  { value: 'USDTRY', label: 'USD/TRY' },
  { value: 'USDMXN', label: 'USD/MXN' },
  { value: 'USDSEK', label: 'USD/SEK' },
  { value: 'USDNOK', label: 'USD/NOK' },
  { value: 'USDDKK', label: 'USD/DKK' },
  { value: 'USDPLN', label: 'USD/PLN' },
  { value: 'USDHUF', label: 'USD/HUF' },
  { value: 'USDCZK', label: 'USD/CZK' },
  { value: 'USDSGD', label: 'USD/SGD' },
  { value: 'USDHKD', label: 'USD/HKD' },
  { value: 'USDILS', label: 'USD/ILS' },
  { value: 'USDTHB', label: 'USD/THB' },
  { value: 'USDCNH', label: 'USD/CNH' },
  { value: 'EURTRY', label: 'EUR/TRY' },
  { value: 'EURZAR', label: 'EUR/ZAR' },
  { value: 'EURMXN', label: 'EUR/MXN' },
  { value: 'GBPTRY', label: 'GBP/TRY' },
  { value: 'US30', label: 'US30 — Dow Jones (CFD)' },
  { value: 'SPX500', label: 'SPX500 — S&P 500 (CFD)' },
  { value: 'NAS100', label: 'NAS100 — Nasdaq 100 (CFD)' },
  { value: 'US2000', label: 'US2000 — Russell 2000 (CFD)' },
  { value: 'UK100', label: 'UK100 — FTSE 100 (CFD)' },
  { value: 'GER30', label: 'GER30 — Germany 30 / DAX (CFD)' },
  { value: 'FRA40', label: 'FRA40 — France 40 / CAC (CFD)' },
  { value: 'EUSTX50', label: 'EUSTX50 — Euro Stoxx 50 (CFD)' },
  { value: 'ESP35', label: 'ESP35 — Spain 35 / IBEX (CFD)' },
  { value: 'JPN225', label: 'JPN225 — Japan 225 / Nikkei (CFD)' },
  { value: 'HKG33', label: 'HKG33 — Hong Kong / Hang Seng (CFD)' },
  { value: 'CHN50', label: 'CHN50 — China A50 (CFD)' },
  { value: 'AUS200', label: 'AUS200 — Australia 200 (CFD)' },
  { value: 'XAUUSD', label: 'XAU/USD (Gold)' },
  { value: 'OIL', label: 'OIL — Crude Oil (CFD)' },
  { value: 'BTCUSD', label: 'BTC/USD' },
  { value: 'ETHUSDT', label: 'ETH/USDT' },
  { value: 'SOLUSDT', label: 'SOL/USDT' },
  { value: 'XRPUSDT', label: 'XRP/USDT' },
];

const SignalsPage = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { saveRecentSignal } = useEngagementStore();
  const { pushToast } = useToast();

  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [activeSession, setActiveSession] = useState('asia');
  const [liveOnly, setLiveOnly] = useState(true);
  const [previewSignal, setPreviewSignal] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [composerOpen, setComposerOpen] = useState(false);
  const [submittingSignal, setSubmittingSignal] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [pairValue, setPairValue] = useState('');
  const [directionValue, setDirectionValue] = useState('Buy');
  const [entryTypeValue, setEntryTypeValue] = useState('Market');
  const [riskLevelValue, setRiskLevelValue] = useState('Medium');
  const [sessionValue, setSessionValue] = useState('ASIA');
  const [validityStartValue, setValidityStartValue] = useState(() => defaultValidityRange().start);
  const [validityEndValue, setValidityEndValue] = useState(() => defaultValidityRange().end);
  const [useEntryRange, setUseEntryRange] = useState(false);
  const [entryPriceValue, setEntryPriceValue] = useState('');
  const [entryMinValue, setEntryMinValue] = useState('');
  const [entryMaxValue, setEntryMaxValue] = useState('');
  const [stopLossValue, setStopLossValue] = useState('');
  const [tp1Value, setTp1Value] = useState('');
  const [tp2Value, setTp2Value] = useState('');
  const [reasoningValue, setReasoningValue] = useState('');
  const [tagsValue, setTagsValue] = useState('');
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [localImageFile, setLocalImageFile] = useState(null);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState('');
  const [premiumOnly, setPremiumOnly] = useState(false);

  useEffect(() => {
    const signalsQuery = query(collection(firestore, 'signals'), orderBy('createdAt', 'desc'), limitQuery(120));

    const unsubscribe = onSnapshot(
      signalsQuery,
      (snapshot) => {
        setSignals(snapshot.docs.map((docSnap) => normalizeSignal(docSnap.id, docSnap.data())));
        setLoading(false);
        setError('');
      },
      (err) => {
        setError(err.message || 'Failed to load signals.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!localImageFile) {
      setLocalImagePreviewUrl('');
      return undefined;
    }
    const nextUrl = URL.createObjectURL(localImageFile);
    setLocalImagePreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [localImageFile]);

  const premiumActive = isPremiumActive(profile);
  const adminUser = isAdmin(profile?.role);
  const traderUser = isTrader(profile?.role);
  const traderActive = traderUser && String(profile?.traderStatus || '').toLowerCase() === 'active';
  const canViewPremiumSignals = premiumActive || adminUser || traderUser;
  const navItems = adminUser ? adminNavigation : (traderUser ? traderAdminNavigation : memberNavigation);

  const visibleSignals = useMemo(() => {
    let next = [...signals];

    if (liveOnly) {
      next = next.filter((signal) => isSignalLiveAt(signal, nowMs));
    }

    next = next.filter((signal) => getSignalSessionBucket(signal) === activeSession);

    const term = searchValue.trim().toLowerCase();
    if (term) {
      next = next.filter((signal) => {
        const haystack = `${signal.pair} ${signal.summary} ${signal.direction} ${signal.session} ${signal.status}`.toLowerCase();
        return haystack.includes(term);
      });
    }

    return next;
  }, [activeSession, liveOnly, nowMs, searchValue, signals]);

  const sessionCounts = useMemo(() => {
    const initial = { asia: 0, london: 0, newyork: 0, weekend: 0 };
    signals.filter((signal) => (liveOnly ? isSignalLiveAt(signal, nowMs) : true)).forEach((signal) => {
      const bucket = getSignalSessionBucket(signal);
      initial[bucket] += 1;
    });
    return initial;
  }, [signals, liveOnly, nowMs]);

  const hasLockedSignals = useMemo(
    () => visibleSignals.some((signal) => signal.premiumOnly && !canViewPremiumSignals),
    [canViewPremiumSignals, visibleSignals],
  );

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading signals...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!isMember(profile.role) && !adminUser && !traderUser) {
    return <Navigate to="/" replace />;
  }

  const resetComposer = () => {
    setComposerError('');
    setPairValue('');
    setDirectionValue('Buy');
    setEntryTypeValue('Market');
    setRiskLevelValue('Medium');
    setSessionValue('ASIA');
    const nextRange = defaultValidityRange();
    setValidityStartValue(nextRange.start);
    setValidityEndValue(nextRange.end);
    setUseEntryRange(false);
    setEntryPriceValue('');
    setEntryMinValue('');
    setEntryMaxValue('');
    setStopLossValue('');
    setTp1Value('');
    setTp2Value('');
    setReasoningValue('');
    setTagsValue('');
    setImageUrlValue('');
    setLocalImageFile(null);
    setLocalImagePreviewUrl('');
    setPremiumOnly(false);
  };

  const closeComposer = () => {
    if (!submittingSignal) {
      setComposerOpen(false);
      setComposerError('');
    }
  };

  const handleLocalImageChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setLocalImageFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setComposerError('Only image files are allowed.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setComposerError('Image must be smaller than 5MB.');
      event.target.value = '';
      return;
    }
    setComposerError('');
    setLocalImageFile(file);
  };

  const handleCreateSignal = async (event) => {
    event.preventDefault();
    if (!user || !traderActive || submittingSignal) {
      return;
    }

    const safePair = pairValue.trim().toUpperCase();
    const safeReasoning = reasoningValue.trim();
    const validFromMs = Date.parse(validityStartValue);
    const validUntilMs = Date.parse(validityEndValue);
    const validFrom = Number.isFinite(validFromMs) ? new Date(validFromMs) : null;
    const validUntil = Number.isFinite(validUntilMs) ? new Date(validUntilMs) : null;
    const entryPrice = toFiniteNumber(entryPriceValue);
    const entryMin = toFiniteNumber(entryMinValue);
    const entryMax = toFiniteNumber(entryMaxValue);
    const stopLoss = toFiniteNumber(stopLossValue);
    const tp1 = toFiniteNumber(tp1Value);
    const tp2 = tp2Value.trim() ? toFiniteNumber(tp2Value) : null;

    if (!safePair) {
      setComposerError('Pair is required.');
      return;
    }
    if (!safeReasoning) {
      setComposerError('Reasoning is required.');
      return;
    }
    if (!(validFrom instanceof Date) || !(validUntil instanceof Date)) {
      setComposerError('Validity start and end times are required.');
      return;
    }
    if (validUntil.getTime() <= validFrom.getTime()) {
      setComposerError('Validity end must be later than start.');
      return;
    }
    if (!Number.isFinite(stopLoss) || !Number.isFinite(tp1)) {
      setComposerError('Stop loss and TP1 are required.');
      return;
    }
    if (useEntryRange) {
      if (!Number.isFinite(entryMin) || !Number.isFinite(entryMax)) {
        setComposerError('Entry range min and max are required.');
        return;
      }
      if (entryMin > entryMax) {
        setComposerError('Entry range min must be less than or equal to max.');
        return;
      }
    } else if (!Number.isFinite(entryPrice)) {
      setComposerError('Entry price is required.');
      return;
    }
    if (tp2Value.trim() && !Number.isFinite(tp2)) {
      setComposerError('TP2 must be a valid number.');
      return;
    }

    const entryPoint = useEntryRange ? ((entryMin + entryMax) / 2) : entryPrice;
    if (directionValue === 'Buy' && (tp1 <= entryPoint || stopLoss >= entryPoint)) {
      setComposerError('For buy signals, TP1 must be above entry and SL below entry.');
      return;
    }
    if (directionValue === 'Sell' && (tp1 >= entryPoint || stopLoss <= entryPoint)) {
      setComposerError('For sell signals, TP1 must be below entry and SL above entry.');
      return;
    }

    const tagList = tagsValue
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12);
    const posterName = profile?.displayName || profile?.username || user.displayName || user.email || 'Trader';

    setSubmittingSignal(true);
    setComposerError('');
    try {
      let resolvedImageUrl = imageUrlValue.trim();
      if (localImageFile) {
        resolvedImageUrl = await uploadSignalImageFile({
          uid: user.uid,
          file: localImageFile,
        });
      }

      const payload = {
        uid: user.uid,
        posterNameSnapshot: posterName,
        posterVerifiedSnapshot: false,
        pair: safePair,
        direction: directionValue,
        entryType: entryTypeValue,
        stopLoss,
        tp1,
        tp2,
        premiumOnly,
        riskLevel: riskLevelValue,
        session: sessionValue,
        validFrom,
        reasoning: safeReasoning,
        summary: safeReasoning,
        tags: tagList,
        imageUrl: resolvedImageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        status: 'open',
        lockVotes: false,
        likesCount: 0,
        dislikesCount: 0,
        voteAgg: { tp: 0, sl: 0, be: 0, partial: 0, total: 0, confidence: 0 },
        preview: {
          pair: safePair,
          direction: directionValue,
          session: sessionValue,
          createdAt: validFrom,
          validUntil,
        },
      };

      if (useEntryRange) {
        payload.entryRange = { min: entryMin, max: entryMax };
      } else {
        payload.entryPrice = entryPrice;
      }

      await addDoc(collection(firestore, 'signals'), payload);
      pushToast({
        type: 'success',
        title: 'Signal posted',
        message: `${safePair} ${directionValue.toUpperCase()} was published.`,
      });
      setComposerOpen(false);
      resetComposer();
    } catch (submitError) {
      setComposerError(submitError instanceof Error ? submitError.message : 'Unable to post signal right now.');
    } finally {
      setSubmittingSignal(false);
    }
  };

  return (
    <AppShell
      pageTitle="Signals"
      pageDescription="Session-based opportunities with clean execution context"
      hideTopbarCopyOnMobile
      hideSearchOnMobile
      navItems={navItems.map((item) => (
        item.to === '/signals'
          ? { ...item, badge: String(visibleSignals.length) }
          : item
      ))}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      contentClassName="signals-page-content"
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Signals' },
        ]}
      />

      <div className="signals-content-head">
        <div className="signals-content-actions">
          {traderUser ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setComposerOpen(true)}
              disabled={!traderActive}
              title={traderActive ? 'Post a new signal' : 'Only active traders can post signals'}
            >
              <AppIcon name="signal" size={14} />
              Post Signal
            </Button>
          ) : null}
        </div>
      </div>

      {hasLockedSignals ? (
        <Card hover>
          <EmptyState
            title="Premium unlocks premium-only signals"
            description="Standard signals remain visible. Upgrade to reveal premium-only entry, SL, TP, and reasoning details."
            actionLabel="Upgrade Membership"
            actionTo="/upgrade"
            icon="upgrade"
          />
        </Card>
      ) : null}

      <FiltersPanel
        title="Session Filters"
        actions={(
          <Toggle checked={liveOnly} onChange={setLiveOnly} label="Live only" />
        )}
      >
        <Tabs
          tabs={SESSION_TABS.map((tab) => ({ key: tab.key, label: `${tab.label} (${sessionCounts[tab.key] || 0})` }))}
          activeKey={activeSession}
          onChange={setActiveSession}
          ariaLabel="Signal sessions"
        />
      </FiltersPanel>

      <Card
        title="Signal Board"
        subtitle="Live setup cards with clean execution context"
        hover
      >
        {loading ? (
          <section className="signals-card-grid">
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </section>
        ) : error ? (
          <ErrorState description={error} onRetry={() => window.location.reload()} />
        ) : visibleSignals.length === 0 ? (
          <EmptyState
            title="No signals in this view"
            description="Try another session or disable the live-only filter."
            actionLabel={premiumActive ? 'Refresh' : 'Open Premium'}
            actionTo={premiumActive ? undefined : '/upgrade'}
            onAction={premiumActive ? () => window.location.reload() : undefined}
            icon="filter"
          />
        ) : (
          <section className="signals-card-grid">
            {visibleSignals.map((signal) => {
              return (
                <SignalBoardCard
                  key={signal.id}
                  signal={signal}
                  nowMs={nowMs}
                  canViewPremiumSignals={canViewPremiumSignals}
                  onPreviewSignal={(nextSignal) => {
                    saveRecentSignal({
                      id: nextSignal.id,
                      pair: nextSignal.pair,
                      direction: nextSignal.direction,
                      directionLabel: nextSignal.directionLabel,
                      session: nextSignal.session,
                      createdAtDate: nextSignal.createdAtDate,
                    });
                    setPreviewSignal(nextSignal);
                  }}
                />
              );
            })}
          </section>
        )}
      </Card>

      <Modal
        open={composerOpen}
        title="Post Signal"
        onClose={closeComposer}
      >
        <form className="signal-compose-form" onSubmit={handleCreateSignal}>
          <div className="signal-compose-grid">
            <SearchablePairField
              id="signal-compose-pair"
              label="Pair"
              value={pairValue}
              onChange={setPairValue}
              options={SIGNAL_PAIR_OPTIONS}
              required
            />
            <Select
              id="signal-compose-direction"
              label="Direction"
              value={directionValue}
              onChange={(event) => setDirectionValue(event.target.value)}
              options={SIGNAL_DIRECTION_OPTIONS}
            />
            <Select
              id="signal-compose-session"
              label="Session"
              value={sessionValue}
              onChange={(event) => setSessionValue(event.target.value)}
              options={SIGNAL_SESSION_OPTIONS}
            />
            <Select
              id="signal-compose-entry-type"
              label="Entry Type"
              value={entryTypeValue}
              onChange={(event) => setEntryTypeValue(event.target.value)}
              options={SIGNAL_ENTRY_TYPE_OPTIONS}
            />
            <Select
              id="signal-compose-risk"
              label="Risk Level"
              value={riskLevelValue}
              onChange={(event) => setRiskLevelValue(event.target.value)}
              options={SIGNAL_RISK_OPTIONS}
            />
            <Input
              id="signal-compose-validity-start"
              label="Validity Start"
              type="datetime-local"
              value={validityStartValue}
              onChange={(event) => setValidityStartValue(event.target.value)}
              required
            />
            <Input
              id="signal-compose-validity-end"
              label="Validity End"
              type="datetime-local"
              value={validityEndValue}
              onChange={(event) => setValidityEndValue(event.target.value)}
              required
            />
          </div>

          <div className="signal-compose-toggle-row">
            <Toggle checked={useEntryRange} onChange={setUseEntryRange} label="Use entry range" />
            <Toggle checked={premiumOnly} onChange={setPremiumOnly} label="Premium only" />
          </div>

          <div className="signal-compose-grid">
            {useEntryRange ? (
              <>
                <Input
                  id="signal-compose-entry-min"
                  label="Entry Min"
                  type="number"
                  inputMode="decimal"
                  value={entryMinValue}
                  onChange={(event) => setEntryMinValue(event.target.value)}
                  required
                />
                <Input
                  id="signal-compose-entry-max"
                  label="Entry Max"
                  type="number"
                  inputMode="decimal"
                  value={entryMaxValue}
                  onChange={(event) => setEntryMaxValue(event.target.value)}
                  required
                />
              </>
            ) : (
              <Input
                id="signal-compose-entry-price"
                label="Entry Price"
                type="number"
                inputMode="decimal"
                value={entryPriceValue}
                onChange={(event) => setEntryPriceValue(event.target.value)}
                required
              />
            )}
            <Input
              id="signal-compose-sl"
              label="Stop Loss"
              type="number"
              inputMode="decimal"
              value={stopLossValue}
              onChange={(event) => setStopLossValue(event.target.value)}
              required
            />
            <Input
              id="signal-compose-tp1"
              label="TP1"
              type="number"
              inputMode="decimal"
              value={tp1Value}
              onChange={(event) => setTp1Value(event.target.value)}
              required
            />
            <Input
              id="signal-compose-tp2"
              label="TP2 (Optional)"
              type="number"
              inputMode="decimal"
              value={tp2Value}
              onChange={(event) => setTp2Value(event.target.value)}
            />
          </div>

          <Textarea
            id="signal-compose-reasoning"
            label="Reasoning"
            rows={4}
            placeholder="Explain setup logic, confluence, and invalidation."
            value={reasoningValue}
            onChange={(event) => setReasoningValue(event.target.value)}
            required
          />
          <Input
            id="signal-compose-tags"
            label="Tags (comma separated)"
            placeholder="London, breakout, trend"
            value={tagsValue}
            onChange={(event) => setTagsValue(event.target.value)}
          />
          <label className="ui-field" htmlFor="signal-compose-image-file">
            <span className="ui-field-label">Chart Image (upload from device)</span>
            <input
              id="signal-compose-image-file"
              type="file"
              accept="image/*"
              className="ui-input"
              onChange={handleLocalImageChange}
            />
            <span className="ui-card-subtitle">PNG, JPG, WEBP up to 5MB.</span>
          </label>
          {localImagePreviewUrl ? (
            <div className="signal-compose-image-preview-wrap">
              <img src={localImagePreviewUrl} alt="Selected signal chart preview" className="signal-compose-image-preview" />
            </div>
          ) : null}
          <Input
            id="signal-compose-image-url"
            label="Chart Image URL (optional fallback)"
            placeholder="https://..."
            value={imageUrlValue}
            onChange={(event) => setImageUrlValue(event.target.value)}
            hint="Used only when no local file is selected."
          />

          {composerError ? <p className="error-text">{composerError}</p> : null}

          <div className="signal-compose-actions">
            <Button type="button" variant="ghost" onClick={closeComposer} disabled={submittingSignal}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submittingSignal}>
              {submittingSignal ? 'Posting...' : 'Post Signal'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(previewSignal)}
        title={previewSignal ? `${previewSignal.pair} chart image` : 'Signal image'}
        onClose={() => setPreviewSignal(null)}
      >
        {previewSignal?.imageUrl ? (
          <div className="signal-image-preview-wrap">
            <img
              src={previewSignal.imageUrl}
              alt={`${previewSignal.pair} signal chart`}
              className="signal-image-preview"
            />
          </div>
        ) : (
          <EmptyState
            title="No image available"
            description="This signal has no attached chart image."
            icon="alert"
          />
        )}
      </Modal>
    </AppShell>
  );
};

export default SignalsPage;

function SignalBoardCard({ signal, nowMs, canViewPremiumSignals, onPreviewSignal }) {
  const shouldLoadPremiumDetails = signal.premiumOnly && canViewPremiumSignals;
  const { details, loading } = useSignalPremiumDetails(signal.id, shouldLoadPremiumDetails);
  const effectiveSignal = useMemo(() => ({
    ...signal,
    entryType: details?.entryType || signal.entryType,
    entryPrice: details?.entryPrice ?? signal.entryPrice,
    entryRange: details?.entryRange ?? signal.entryRange,
    stopLoss: details?.stopLoss ?? signal.stopLoss,
    tp1: details?.tp1 ?? signal.tp1,
    tp2: details?.tp2 ?? signal.tp2,
    summary: details?.reason || signal.summary,
  }), [details, signal]);
  const isLocked = signal.premiumOnly && !canViewPremiumSignals;
  const entryValue = isLocked ? '••••••' : formatSignalEntry(effectiveSignal);
  const stopLossValue = isLocked ? '••••••' : formatSignalPoint(effectiveSignal.stopLoss);
  const tp1Value = isLocked ? '••••••' : formatSignalPoint(effectiveSignal.tp1);
  const tp2Value = isLocked ? '••••••' : formatSignalPoint(effectiveSignal.tp2);
  const displayStatus = resolveDisplayStatus(signal, nowMs);
  const rawValidityPercent = calculateValidityPercent(signal, nowMs);
  const isExpired = displayStatus.className === 'expired';
  const forceExpiredValidity = isExpired;
  const validityPercent = forceExpiredValidity ? 0 : rawValidityPercent;
  const hasValidity = Number.isFinite(rawValidityPercent) || forceExpiredValidity;
  const cardToneClass = resolveSignalCardTone(signal.direction);
  const validityToneClass = resolveValidityTone(validityPercent);
  const summaryText = isLocked
    ? 'Upgrade to unlock this premium-only signal summary and full setup rationale.'
    : (loading && signal.premiumOnly ? 'Loading premium details...' : effectiveSignal.summary);

  return (
    <article className={`signal-board-card ${cardToneClass} ${validityToneClass}`.trim()}>
      <header className="signal-board-card-head">
        <div>
          <span className="signal-board-chip">
            <AppIcon name="sparkles" size={12} />
            {signal.premiumOnly ? 'Premium setup' : 'Live setup'}
          </span>
          <p className="signal-board-pair">{signal.pair}</p>
          <p className="signal-board-session">{String(signal.session || 'Any').replace(/_/g, ' ')}</p>
        </div>
        <div className="signal-board-head-right">
          <span className={`signal-direction-chip ${String(signal.direction || 'n-a').toLowerCase()}`.trim()}>
            {isLocked ? 'PREMIUM' : signal.directionLabel}
          </span>
          <span className={`status-badge ${displayStatus.className}`}>{displayStatus.label}</span>
        </div>
      </header>

      <p className="signal-board-summary">{summaryText}</p>

      <div className="signal-board-metrics">
        <article className="signal-board-metric">
          <div className="signal-board-metric-head">
            <AppIcon name="chart" size={13} />
            <p>Entry</p>
          </div>
          <strong>{loading && signal.premiumOnly && !isLocked ? '...' : entryValue}</strong>
        </article>
        <article className="signal-board-metric">
          <div className="signal-board-metric-head">
            <AppIcon name="alert" size={13} />
            <p>SL</p>
          </div>
          <strong>{loading && signal.premiumOnly && !isLocked ? '...' : stopLossValue}</strong>
        </article>
        <article className="signal-board-metric">
          <div className="signal-board-metric-head">
            <AppIcon name="arrowUp" size={13} />
            <p>TP1</p>
          </div>
          <strong>{loading && signal.premiumOnly && !isLocked ? '...' : tp1Value}</strong>
        </article>
        <article className="signal-board-metric">
          <div className="signal-board-metric-head">
            <AppIcon name="check" size={13} />
            <p>TP2</p>
          </div>
          <strong>{loading && signal.premiumOnly && !isLocked ? '...' : tp2Value}</strong>
        </article>
      </div>

      <footer className="signal-board-footer">
        <div className="signal-board-validity">
          <div className="signal-board-validity-head">
            <span>Validity</span>
            <strong>{hasValidity ? `${validityPercent}%` : '--'}</strong>
          </div>
          {!isExpired ? (
            <progress
              className="signal-board-validity-progress"
              max="100"
              value={hasValidity ? validityPercent : 0}
              title={signal.validUntilDate ? `Valid until ${formatDateTime(signal.validUntilDate)}` : 'No expiry set'}
              aria-label="Signal validity progress"
            />
          ) : (
            <span className="signal-board-validity-expired">Expired</span>
          )}
        </div>
        <div className="signal-board-foot-right">
          <span className="ui-card-subtitle">Posted: {formatDateTime(signal.createdAtDate)}</span>
          <Button
            size="sm"
            variant="secondary"
            disabled={isLocked || !signal.imageUrl}
            onClick={() => {
              if (isLocked || !signal.imageUrl) {
                return;
              }
              onPreviewSignal(signal);
            }}
          >
            <AppIcon name="external" size={13} />
            {isLocked ? 'Premium image' : 'View image'}
          </Button>
        </div>
      </footer>
    </article>
  );
}

function formatSignalEntry(signal) {
  if (signal.entryRange) {
    return `${formatSignalPoint(signal.entryRange.min)} - ${formatSignalPoint(signal.entryRange.max)}`;
  }
  if (signal.entryPrice) {
    return formatSignalPoint(signal.entryPrice);
  }
  return 'Market';
}

function formatSignalPoint(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return '--';
  }
  return number.toFixed(5);
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

async function uploadSignalImageFile({ uid, file }) {
  const extension = file.name?.split('.').pop()?.toLowerCase() || 'jpg';
  const storagePath = `signals/${uid}/${Date.now()}.${extension}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
  return getDownloadURL(fileRef);
}

function calculateValidityPercent(signal, nowMs) {
  const start = signal?.validFromDate instanceof Date
    ? signal.validFromDate
    : (signal?.createdAtDate instanceof Date ? signal.createdAtDate : null);
  const end = signal?.validUntilDate instanceof Date ? signal.validUntilDate : null;
  if (!end) {
    return NaN;
  }

  const now = Number.isFinite(nowMs) ? nowMs : Date.now();

  if (!start) {
    return end.getTime() > now ? 100 : 0;
  }

  const total = end.getTime() - start.getTime();
  if (total <= 0) {
    return 0;
  }

  const remaining = Math.min(Math.max(end.getTime() - now, 0), total);
  return Math.round((remaining / total) * 100);
}

function resolveSignalCardTone(direction) {
  const value = String(direction || '').toLowerCase();
  if (value.includes('long') || value.includes('buy')) {
    return 'is-bull';
  }
  if (value.includes('short') || value.includes('sell')) {
    return 'is-bear';
  }
  return 'is-neutral';
}

function resolveValidityTone(percent) {
  if (!Number.isFinite(percent)) {
    return 'is-validity-unknown';
  }
  if (percent <= 20) {
    return 'is-validity-critical';
  }
  if (percent <= 50) {
    return 'is-validity-mid';
  }
  return 'is-validity-good';
}

function isSignalLiveAt(signal, nowMs) {
  const status = String(signal?.status ?? '').trim().toLowerCase();
  if (['expired', 'closed', 'cancelled', 'canceled', 'completed', 'done'].includes(status)) {
    return false;
  }

  const validFrom = signal?.validFromDate instanceof Date ? signal.validFromDate : null;
  const validUntil = signal?.validUntilDate instanceof Date ? signal.validUntilDate : null;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (validFrom && validFrom.getTime() > now) {
    return false;
  }
  if (!validUntil) {
    return true;
  }
  return validUntil.getTime() > now;
}

function resolveDisplayStatus(signal, nowMs) {
  const validFrom = signal?.validFromDate instanceof Date ? signal.validFromDate : null;
  const validUntil = signal?.validUntilDate instanceof Date ? signal.validUntilDate : null;
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (validFrom && validFrom.getTime() > now) {
    return { label: 'SCHEDULED', className: 'pending' };
  }
  if (validUntil && validUntil.getTime() <= now) {
    return { label: 'EXPIRED', className: 'expired' };
  }

  const raw = String(signal?.statusLabel || signal?.status || 'OPEN').toUpperCase();
  return {
    label: raw,
    className: raw.toLowerCase(),
  };
}

function SearchablePairField({ id, label, value, onChange, options, required = false }) {
  const containerRef = useRef(null);
  const searchableOptions = useMemo(
    () => options.filter((option) => option.value),
    [options],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const activeOption = searchableOptions.find((option) => option.value === value);
    setQuery(activeOption ? `${activeOption.value} - ${activeOption.label}` : '');
  }, [searchableOptions, value]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = searchableOptions.filter((option) => {
    if (!normalizedQuery) {
      return true;
    }
    const haystack = `${option.value} ${option.label}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  }).slice(0, 12);

  const handleInputChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setOpen(true);
    const exactMatch = searchableOptions.find((option) => {
      const optionText = `${option.value} - ${option.label}`.toLowerCase();
      const normalizedInput = nextQuery.trim().toLowerCase();
      return option.value.toLowerCase() === normalizedInput
        || option.label.toLowerCase() === normalizedInput
        || optionText === normalizedInput;
    });
    onChange(exactMatch ? exactMatch.value : '');
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setQuery(`${option.value} - ${option.label}`);
    setOpen(false);
  };

  return (
    <label className="ui-field signal-pair-combobox" htmlFor={id} ref={containerRef}>
      {label ? <span className="ui-field-label">{label}</span> : null}
      <input
        id={id}
        className="ui-input"
        type="text"
        role="combobox"
        autoComplete="off"
        placeholder="Search pair"
        value={query}
        onChange={handleInputChange}
        onFocus={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
      />
      <input type="hidden" value={value} required={required} />
      {open ? (
        <div className="signal-pair-combobox-menu" id={`${id}-listbox`} role="listbox">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`signal-pair-combobox-option ${value === option.value ? 'is-active' : ''}`.trim()}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                role="option"
                aria-selected={value === option.value}
              >
                <strong>{option.value}</strong>
                <span>{option.label}</span>
              </button>
            ))
          ) : (
            <p className="signal-pair-combobox-empty">No matching pairs</p>
          )}
        </div>
      ) : null}
    </label>
  );
}

function defaultValidityRange() {
  const now = new Date();
  const start = new Date(now.getTime() + 15 * 60 * 1000);
  const end = new Date(start.getTime() + 8 * 60 * 60 * 1000);
  return {
    start: toDateTimeLocalValue(start),
    end: toDateTimeLocalValue(end),
  };
}

function toDateTimeLocalValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return '';
  }
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
