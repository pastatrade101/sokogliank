import './SignalsSection.css';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, limit as limitQuery, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firestore } from '../firebase/init';
import { isPremiumActive } from '../utils/membershipHelpers';
import useSignalPremiumDetails from '../hooks/useSignalPremiumDetails';

const SignalsSection = ({
  headerTitle = 'Member Signals',
  headerSubtitle = 'Fresh member-only intel',
  showHeader = true,
  className = '',
  showSessionTabs = false,
  viewerProfile = null,
  tipsOnly = false,
}) => {
  const [signals, setSignals] = useState([]);
  const [loadingSignals, setLoadingSignals] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeSessionTab, setActiveSessionTab] = useState('asia');
  const hasPremiumAccess = useMemo(() => {
    const role = String(viewerProfile?.role || '').toLowerCase();
    return isPremiumActive(viewerProfile) || role === 'admin' || role === 'trader' || role === 'trader_admin';
  }, [viewerProfile]);

  useEffect(() => {
    const signalsQuery = query(
      collection(firestore, 'signals'),
      orderBy('createdAt', 'desc'),
      limitQuery(20),
    );

    const unsubscribe = onSnapshot(
      signalsQuery,
      (snapshot) => {
        setSignals(snapshot.docs.map((doc) => normalizeSignal(doc.id, doc.data())));
        setLoadingSignals(false);
      },
      (error) => {
        setFetchError(error.message || 'Unable to load signals.');
        setLoadingSignals(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const sortedSignals = useMemo(() => {
    return signals
      .map((signal) => {
        const createdAtDate = signal.createdAtDate ?? timestampToDate(signal.createdAt);
        const validUntilDate = signal.validUntilDate ?? timestampToDate(signal.validUntil);
        return {
          ...signal,
          createdAtDate,
          validUntilDate,
          createdAtLabel: signal.createdAtLabel ?? formatTimestamp(createdAtDate ?? signal.createdAt),
          validUntilLabel: signal.validUntilLabel ?? (validUntilDate ? formatTimestamp(validUntilDate) : 'No expiry set'),
          directionLabel: signal.directionLabel ?? (signal.direction ? signal.direction.toUpperCase() : 'N/A'),
          statusLabel: signal.statusLabel ?? (signal.status ? signal.status.toUpperCase() : 'OPEN'),
        };
      })
      .sort(
        (a, b) =>
          timestampToMillis(b.createdAtDate ?? b.createdAt) - timestampToMillis(a.createdAtDate ?? a.createdAt),
      );
  }, [signals]);

  const liveSignals = useMemo(() => {
    return sortedSignals.filter((signal) => isSignalLive(signal));
  }, [sortedSignals]);

  const visibleSignals = useMemo(() => {
    if (!tipsOnly) {
      return liveSignals;
    }
    return liveSignals.filter((signal) => hasSignalTip(signal));
  }, [liveSignals, tipsOnly]);

  const sessionCounts = useMemo(() => {
    return visibleSignals.reduce(
      (accumulator, signal) => {
        const bucket = getSignalSessionBucket(signal);
        if (bucket) {
          accumulator[bucket] += 1;
        }
        return accumulator;
      },
      { asia: 0, london: 0, newyork: 0, weekend: 0 },
    );
  }, [visibleSignals]);

  const filteredSignals = useMemo(() => {
    if (!showSessionTabs) {
      return visibleSignals;
    }
    return visibleSignals.filter((signal) => getSignalSessionBucket(signal) === activeSessionTab);
  }, [activeSessionTab, showSessionTabs, visibleSignals]);

  return (
    <section className={`signals-section ${className}`.trim()}>
      {showHeader && (
        <header className="signals-section-header">
          <p className="signals-title">{headerTitle}</p>
          <p className="signals-subtitle">{headerSubtitle}</p>
        </header>
      )}
      {showSessionTabs && (
        <div className="signals-session-tabs" role="tablist" aria-label="Signal sessions">
          {SESSION_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`signals-session-tab ${activeSessionTab === tab.key ? 'is-active' : ''}`}
              onClick={() => setActiveSessionTab(tab.key)}
              role="tab"
              aria-selected={activeSessionTab === tab.key}
              type="button"
            >
              {tab.label}
              <span className="signals-session-count">{sessionCounts[tab.key]}</span>
            </button>
          ))}
        </div>
      )}
      {!hasPremiumAccess && visibleSignals.some((signal) => signal.premiumOnly) && (
        <div className="signals-upgrade-banner" role="note">
          <p>Premium membership is required only for premium-only signal data.</p>
          <Link to="/upgrade" className="signal-upgrade-button">
            Upgrade to Premium
          </Link>
        </div>
      )}
      <div className="signals-grid">
        {loadingSignals ? (
          <p className="signals-helper">Loading the latest signals…</p>
        ) : fetchError ? (
          <p className="signals-helper signals-error">{fetchError}</p>
        ) : filteredSignals.length === 0 ? (
          <p className="signals-helper">
            {showSessionTabs
              ? `No ${SESSION_TABS.find((tab) => tab.key === activeSessionTab)?.label ?? 'session'} signals yet.`
              : 'No signals posted yet.'}
          </p>
        ) : (
          filteredSignals.map((signal) => (
            <SignalsSectionCard
              key={signal.id}
              signal={signal}
              hasPremiumAccess={hasPremiumAccess}
            />
          ))
        )}
      </div>
    </section>
  );
};

const TrendDetail = ({ tone, label, value }) => (
  <div className="signal-detail">
    <span className={`signal-dot ${tone}`} aria-hidden="true" />
    <p>{label}</p>
    <strong>{value}</strong>
  </div>
);

const SignalsSectionCard = ({ signal, hasPremiumAccess }) => {
  const shouldLoadPremiumDetails = signal.premiumOnly && hasPremiumAccess;
  const { details, loading } = useSignalPremiumDetails(signal.id, shouldLoadPremiumDetails);
  const isLocked = signal.premiumOnly && !hasPremiumAccess;
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
  const entryDetail = !isLocked
    ? effectiveSignal.entryRange
      ? `${effectiveSignal.entryRange.min.toFixed(5)} - ${effectiveSignal.entryRange.max.toFixed(5)}`
      : effectiveSignal.entryPrice
        ? effectiveSignal.entryPrice.toFixed(5)
        : 'Market'
    : '••••••';
  const directionClass = !isLocked
    ? effectiveSignal.directionLabel
      ? effectiveSignal.directionLabel.toLowerCase().replace(/[^a-z]/g, '-')
      : 'n-a'
    : 'premium';
  const directionColor = directionClass.includes('long')
    ? '#4fe1a5'
    : directionClass.includes('short')
      ? '#ff7a93'
      : directionClass.includes('premium')
        ? '#f8cf57'
      : '#999';
  const validUntilDate = signal.validUntilDate;
  const sessionLabel = signal.session ? signal.session.replace(/_/g, ' ') : 'Any session';
  const progressValue = !isLocked ? calculateProgress(signal.createdAtDate, validUntilDate) : 0;
  const tagList = Array.isArray(signal.tags) ? signal.tags : [];
  const primaryTag = isLocked ? 'Premium content' : tagList[0] ?? 'No tag';
  const tipText = !isLocked && signal.tip ? signal.tip : '';
  const summaryText = isLocked
    ? 'Upgrade to unlock entry, stop loss, targets, and setup reasoning.'
    : (loading && signal.premiumOnly ? 'Loading premium details...' : effectiveSignal.summary);

  return (
    <article className="signal-card" style={{ '--direction-accent': directionColor }}>
      <div className="signal-card-head">
        <div>
          <p className="signals-label">{signal.pair ?? 'Unknown pair'}</p>
          <p className="signal-session">{sessionLabel}</p>
        </div>
        <div className="signal-pill-row">
          <span className={`signal-direction ${directionClass}`}>
            {isLocked ? 'PREMIUM' : signal.directionLabel}
          </span>
          <span className="signal-meta-pill">{isLocked ? 'LOCKED' : signal.statusLabel}</span>
        </div>
      </div>

      <div className="signal-card-body">
        <p className="signal-body">
          <span className="signal-body-label" aria-hidden="true">
            ↗
          </span>
          {summaryText}
        </p>
        {tipText ? <p className="signal-tip">Tip: {tipText}</p> : null}
        <div className="signal-card-metrics">
          <TrendDetail tone="entry" label="Entry" value={loading && signal.premiumOnly && !isLocked ? '...' : entryDetail} />
          <TrendDetail tone="sl" label="SL" value={loading && signal.premiumOnly && !isLocked ? '...' : (isLocked ? '••••••' : effectiveSignal.stopLoss?.toFixed(5) ?? '--')} />
          <TrendDetail tone="tp" label="TP1" value={loading && signal.premiumOnly && !isLocked ? '...' : (isLocked ? '••••••' : effectiveSignal.tp1?.toFixed(5) ?? '--')} />
          <TrendDetail tone="neutral" label="TP2" value={loading && signal.premiumOnly && !isLocked ? '...' : (isLocked ? '••••••' : effectiveSignal.tp2?.toFixed(5) ?? '--')} />
        </div>
        {isLocked ? (
          <div className="signal-upgrade-panel">
            <Link to="/upgrade" className="signal-upgrade-button">
              Upgrade to Premium
            </Link>
          </div>
        ) : (
          <>
            <div className="signal-progress-head">
              <span>Progress</span>
              <strong>{progressValue}%</strong>
            </div>
            <div className="signal-progress-set">
              <div className="signal-progress-bar" style={{ width: `${progressValue}%` }} />
            </div>
          </>
        )}
      </div>

      <div className="signal-card-footer">
        <span className="signal-tag-chip">{primaryTag}</span>
        <p className="signal-meta-name">{signal.posterName}</p>
        <div className="signal-meta-counts">
          <span aria-label="likes">👍 {signal.likesCount}</span>
          <span aria-label="dislikes">👎 {signal.dislikesCount}</span>
        </div>
      </div>
    </article>
  );
};

const SESSION_TABS = [
  { key: 'asia', label: 'Asia' },
  { key: 'london', label: 'London' },
  { key: 'newyork', label: 'New York' },
  { key: 'weekend', label: 'Weekend Outlook' },
];

function normalizeSignal(id, data = {}) {
  const createdAt = data.createdAt ?? data.preview?.createdAt;
  const validUntil = data.validUntil ?? data.preview?.validUntil;
  const createdAtDate = timestampToDate(createdAt);
  const validUntilDate = timestampToDate(validUntil);
  const tipRaw = data.tip ?? data.tradeTip ?? data.preview?.tip ?? data.preview?.tradeTip ?? '';
  const tip = typeof tipRaw === 'string' ? tipRaw.trim() : '';

  return {
    id,
    summary: data.summary ?? data.reasoning ?? 'No summary provided.',
    tip,
    reasoning: data.reasoning ?? '',
    status: data.status ?? 'open',
    statusLabel: data.status ? data.status.toString().toUpperCase() : 'OPEN',
    pair: data.preview?.pair ?? data.pair ?? 'Unknown',
    direction: data.preview?.direction ?? data.direction ?? 'N/A',
    session: data.preview?.session ?? data.session ?? 'Any',
    entryType: data.entryType ?? (data.entryRange ? 'Range' : 'Market'),
    entryPrice: data.entryPrice ?? null,
    entryRange: data.entryRange
      ? { min: Number(data.entryRange.min), max: Number(data.entryRange.max) }
      : null,
    stopLoss: data.stopLoss ?? null,
    tp1: data.tp1 ?? null,
    tp2: data.tp2 ?? null,
    premiumOnly: toBoolean(data.premiumOnly ?? data.preview?.premiumOnly ?? data.isPremium ?? data.isPremiumOnly),
    riskLevel: data.riskLevel ?? 'Moderate',
    validUntilLabel: validUntilDate ? formatTimestamp(validUntilDate) : 'No expiry set',
    validUntil: validUntil ?? null,
    validUntilDate,
    createdAt,
    createdAtDate,
    createdAtLabel: createdAtDate ? formatTimestamp(createdAtDate) : formatTimestamp(createdAt),
    posterName: data.posterNameSnapshot ?? data.posterName ?? 'Unknown poster',
    likesCount: data.likesCount ?? 0,
    dislikesCount: data.dislikesCount ?? 0,
    tags: Array.isArray(data.tags) ? data.tags : [],
  };
}


function formatTimestamp(value) {
  if (!value) {
    return 'Unknown';
  }
  if (value instanceof Date) {
    return value.toLocaleString();
  }
  if (value.toDate) {
    return value.toDate().toLocaleString();
  }
  const seconds = value.seconds ?? value._seconds;
  const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6)).toLocaleString();
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toLocaleString();
  }
  return 'Unknown';
}

function timestampToDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (value.toDate) {
    return value.toDate();
  }
  const seconds = value.seconds ?? value._seconds;
  const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return new Date(seconds * 1000 + Math.floor(nanos / 1e6));
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed);
  }
  return null;
}

function timestampToMillis(value) {
  if (!value) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (value.toDate) {
    return value.toDate().getTime();
  }
  const seconds = value.seconds ?? value._seconds;
  const nanos = value.nanoseconds ?? value._nanoseconds ?? 0;
  if (typeof seconds === 'number') {
    return seconds * 1000 + Math.floor(nanos / 1e6);
  }
  const parsed = Date.parse(value);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return 0;
}

function calculateProgress(startDate, endDate) {
  const start = timestampToDate(startDate);
  const end = timestampToDate(endDate);
  if (!start || !end) {
    return 0;
  }
  const total = end.getTime() - start.getTime();
  if (total <= 0) {
    return 100;
  }
  const now = Date.now();
  const elapsed = Math.min(Math.max(now - start.getTime(), 0), total);
  return Math.round((elapsed / total) * 100);
}

function getSignalSessionBucket(signal) {
  const keywords = [
    signal.session,
    signal.summary,
    signal.reasoning,
    signal.status,
    ...(Array.isArray(signal.tags) ? signal.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_-]/g, ' ');

  if (keywords.includes('weekend') || keywords.includes('outlook')) {
    return 'weekend';
  }
  if (
    keywords.includes('new york') ||
    keywords.includes('newyork') ||
    keywords.includes('ny session') ||
    keywords.includes('us session')
  ) {
    return 'newyork';
  }
  if (keywords.includes('london') || keywords.includes('europe')) {
    return 'london';
  }
  if (keywords.includes('asia') || keywords.includes('tokyo') || keywords.includes('sydney')) {
    return 'asia';
  }
  return '';
}

function isSignalLive(signal) {
  const status = String(signal?.status ?? '').trim().toLowerCase();
  if (['expired', 'closed', 'cancelled', 'canceled', 'completed', 'done'].includes(status)) {
    return false;
  }
  const validUntil = timestampToDate(signal?.validUntilDate ?? signal?.validUntil);
  if (!validUntil) {
    return true;
  }
  return validUntil.getTime() > Date.now();
}

function hasSignalTip(signal) {
  return typeof signal?.tip === 'string' && signal.tip.trim().length > 0;
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

export default SignalsSection;
