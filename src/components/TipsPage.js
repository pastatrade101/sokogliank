import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  documentId,
  getDocs,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { firestore } from '../firebase/init';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { useEngagementStore } from '../hooks/useEngagementStore';
import { isAdmin, isTrader } from '../utils/roleHelpers';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FiltersPanel,
  SkeletonLoader,
  Tabs,
  Toggle,
} from './ui';
import { memberNavigation, traderAdminNavigation } from '../config/navigation';
import { adminNavigation } from '../config/adminNavigation';
import { formatDate, isCurrentDay, normalizeTip, TIP_TYPES } from '../utils/tradingData';
import AppIcon from './icons/AppIcon';

const TipsPage = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pinnedTips, togglePinnedTip } = useEngagementStore();
  const adminUser = isAdmin(profile?.role);
  const traderUser = isTrader(profile?.role);
  const navItems = adminUser ? adminNavigation : (traderUser ? traderAdminNavigation : memberNavigation);

  const [activeTab, setActiveTab] = useState('featured');
  const [selectedType, setSelectedType] = useState('All');
  const [currentOnly, setCurrentOnly] = useState(false);
  const [featuredTips, setFeaturedTips] = useState([]);
  const [latestTips, setLatestTips] = useState([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [featuredError, setFeaturedError] = useState('');
  const [latestError, setLatestError] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [authorAvatars, setAuthorAvatars] = useState({});

  useEffect(() => {
    const featuredQuery = query(
      collection(firestore, 'trader_tips'),
      where('status', '==', 'published'),
      where('isFeatured', '==', true),
      orderBy('createdAt', 'desc'),
      limitQuery(24),
    );

    const latestQuery = query(
      collection(firestore, 'trader_tips'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
      limitQuery(120),
    );

    const unsubscribeFeatured = onSnapshot(
      featuredQuery,
      (snapshot) => {
        setFeaturedTips(snapshot.docs.map((docSnap) => normalizeTip(docSnap.id, docSnap.data())));
        setLoadingFeatured(false);
      },
      (error) => {
        setFeaturedError(error.message || 'Unable to load featured tips.');
        setLoadingFeatured(false);
      },
    );

    const unsubscribeLatest = onSnapshot(
      latestQuery,
      (snapshot) => {
        setLatestTips(snapshot.docs.map((docSnap) => normalizeTip(docSnap.id, docSnap.data())));
        setLoadingLatest(false);
      },
      (error) => {
        setLatestError(error.message || 'Unable to load tips.');
        setLoadingLatest(false);
      },
    );

    return () => {
      unsubscribeFeatured();
      unsubscribeLatest();
    };
  }, []);

  useEffect(() => {
    const tipPool = [...featuredTips, ...latestTips];
    const uniqueAuthorIds = [...new Set(
      tipPool
        .map((tip) => String(tip.createdBy || '').trim())
        .filter(Boolean),
    )];

    if (uniqueAuthorIds.length === 0) {
      return undefined;
    }

    let cancelled = false;

    const fetchAuthorAvatars = async () => {
      const avatarMap = {};
      const idChunks = chunkIds(uniqueAuthorIds, 10);

      await Promise.all(
        idChunks.map(async (ids) => {
          const usersQuery = query(collection(firestore, 'users'), where(documentId(), 'in', ids));
          const snapshot = await getDocs(usersQuery);
          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data() || {};
            const avatarUrl = resolveUserAvatarUrl(data);
            if (avatarUrl) {
              avatarMap[docSnap.id] = avatarUrl;
            }
          });
        }),
      );

      if (!cancelled && Object.keys(avatarMap).length > 0) {
        setAuthorAvatars((current) => ({ ...current, ...avatarMap }));
      }
    };

    fetchAuthorAvatars().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [featuredTips, latestTips]);

  const tips = useMemo(() => {
    const baseTips = activeTab === 'featured' ? featuredTips : latestTips;
    const byType = selectedType === 'All' ? baseTips : baseTips.filter((tip) => tip.type === selectedType);
    const byDate = currentOnly ? byType.filter((tip) => isCurrentDay(tip.createdAtDate)) : byType;
    const term = searchValue.trim().toLowerCase();
    if (!term) {
      return byDate;
    }
    return byDate.filter((tip) => {
      const haystack = `${tip.title} ${tip.content} ${tip.type} ${(tip.tags || []).join(' ')}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [activeTab, currentOnly, featuredTips, latestTips, searchValue, selectedType]);

  const tipsLoading = activeTab === 'featured' ? loadingFeatured : loadingLatest;
  const tipsError = activeTab === 'featured' ? featuredError : latestError;

  const tipsToday = useMemo(() => latestTips.filter((tip) => isCurrentDay(tip.createdAtDate)).length, [latestTips]);

  const typeDistribution = useMemo(() => {
    const counts = TIP_TYPES.reduce((acc, type) => ({ ...acc, [type]: 0 }), {});
    latestTips.forEach((tip) => {
      if (counts[tip.type] !== undefined) {
        counts[tip.type] += 1;
      }
    });
    return counts;
  }, [latestTips]);

  const dominantType = useMemo(() => {
    const entries = Object.entries(typeDistribution);
    if (entries.length === 0) {
      return null;
    }
    return entries.sort((a, b) => b[1] - a[1])[0];
  }, [typeDistribution]);

  const featuredSpotlight = featuredTips[0] || null;
  const newestTip = latestTips[0] || null;

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading tips...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppShell
      pageTitle="Trader Tips"
      pageDescription="Daily decision-quality improvements with focused learning"
      navItems={navItems.map((item) => (
        item.to === '/tips'
          ? { ...item, badge: String(tips.length) }
          : item
      ))}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      topbarActions={(
        <Button variant="secondary" size="sm" to="/signals">
          <AppIcon name="signal" size={14} />
          Back to Signals
        </Button>
      )}
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Tips' },
        ]}
      />

      <section className="tips-hero-grid">
        <article className="tips-hero-panel">
          <div className="tips-hero-kicker-row">
            <span className="tips-hero-kicker-chip">
              <AppIcon name="sparkles" size={13} />
              Knowledge Hub
            </span>
            <span className="tips-hero-date-chip">{tipsToday} posted today</span>
          </div>

          <h2>Sharpen decisions with structured trading knowledge.</h2>
          <p>
            Filter by context, pin your playbook, and turn market lessons into repeatable execution habits.
          </p>

          <div className="quick-actions">
            <Button variant="primary" size="sm" onClick={() => setActiveTab('featured')}>
              <AppIcon name="star" size={14} />
              Focus Featured
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setActiveTab('latest')}>
              <AppIcon name="clock" size={14} />
              View Latest
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedType('All');
                setCurrentOnly(false);
                setSearchValue('');
              }}
            >
              <AppIcon name="refresh" size={14} />
              Reset View
            </Button>
          </div>

          <div className="tips-hero-stat-grid">
            <article className="tips-hero-stat">
              <p className="tips-hero-stat-label">Visible now</p>
              <p className="tips-hero-stat-value">{tips.length}</p>
            </article>
            <article className="tips-hero-stat">
              <p className="tips-hero-stat-label">Published</p>
              <p className="tips-hero-stat-value">{latestTips.length}</p>
            </article>
            <article className="tips-hero-stat">
              <p className="tips-hero-stat-label">Pinned</p>
              <p className="tips-hero-stat-value">{pinnedTips.length}</p>
            </article>
          </div>
        </article>

        <aside className="tips-intel-panel">
          <p className="tips-intel-title">Tip Intelligence</p>

          <article className="tips-intel-card">
            <p className="tips-intel-card-label">Dominant category</p>
            <p className="tips-intel-card-value">{dominantType ? dominantType[0] : 'No data'}</p>
            {dominantType ? <p className="tips-intel-card-meta">{dominantType[1]} insights published</p> : null}
          </article>

          <article className="tips-intel-card">
            <p className="tips-intel-card-label">Spotlight</p>
            <p className="tips-intel-card-value tips-intel-card-title">{featuredSpotlight?.title || 'No featured tip yet'}</p>
            {featuredSpotlight ? <p className="tips-intel-card-meta">{featuredSpotlight.type}</p> : null}
          </article>

          <article className="tips-intel-card">
            <p className="tips-intel-card-label">Latest publish</p>
            <p className="tips-intel-card-value tips-intel-card-title">{newestTip?.title || 'No latest tip yet'}</p>
            {newestTip ? <p className="tips-intel-card-meta">{formatDate(newestTip.createdAtDate)}</p> : null}
          </article>
        </aside>
      </section>

      <section className="tips-control-grid">
        <FiltersPanel
          title="Tip Filters"
          actions={<Toggle checked={currentOnly} onChange={setCurrentOnly} label="Current day only" />}
        >
          <Tabs
            tabs={[
              { key: 'featured', label: `Featured (${featuredTips.length})` },
              { key: 'latest', label: `Latest (${latestTips.length})` },
            ]}
            activeKey={activeTab}
            onChange={setActiveTab}
            ariaLabel="Tips tab selector"
          />
          <div className="tips-pill-cloud">
            {['All', ...TIP_TYPES].map((type) => (
              <button
                key={type}
                type="button"
                className={`ui-pill ${selectedType === type ? 'active' : ''}`.trim()}
                onClick={() => setSelectedType(type)}
              >
                {type}
                {type !== 'All' ? <span className="tips-pill-count">{typeDistribution[type] || 0}</span> : null}
              </button>
            ))}
          </div>
        </FiltersPanel>

        <Card title="Pinned Playbook" subtitle="Your saved tactics and reminders" hover>
          {pinnedTips.length === 0 ? (
            <EmptyState
              title="Build your playbook"
              description="Pin tips from the feed. Pinned guidance stays visible across sessions."
              icon="pin"
            />
          ) : (
            <div className="recent-list">
              {pinnedTips.slice(0, 6).map((tip) => (
                <article key={tip.id} className="recent-item">
                  <div>
                    <p className="recent-item-title">{tip.title || 'Untitled tip'}</p>
                    <p className="recent-item-meta">{tip.type}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconOnly
                    aria-label="Unpin tip"
                    onClick={() => togglePinnedTip(tip)}
                  >
                    <AppIcon name="close" size={14} />
                  </Button>
                </article>
              ))}
            </div>
          )}
        </Card>
      </section>

      {tipsLoading ? (
        <section className="ui-grid cols-2">
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
        </section>
      ) : tipsError ? (
        <ErrorState title="Tips feed unavailable" description={tipsError} onRetry={() => window.location.reload()} />
      ) : tips.length === 0 ? (
        <EmptyState
          title="No tips in this view"
          description="Try changing the tab, filter type, or disabling current-day mode."
          actionLabel="Reset Filters"
          onAction={() => {
            setActiveTab('featured');
            setSelectedType('All');
            setCurrentOnly(false);
            setSearchValue('');
          }}
          icon="filter"
        />
      ) : (
        <section className="tips-feed-grid">
          {tips.map((tip) => {
            const pinned = pinnedTips.some((entry) => entry.id === tip.id);
            const avatarUrl = tip.authorAvatarUrl || authorAvatars[tip.createdBy] || '';
            return (
              <Card key={tip.id} className="tip-feed-card" hover>
                <header className="tip-feed-header">
                  <div className="tip-feed-chip-row">
                    <span className="tip-feed-type-chip">{tip.type}</span>
                    {(tip.tags || []).slice(0, 2).map((tag) => (
                      <span key={`${tip.id}-${tag}`} className="tip-feed-tag-chip">{tag}</span>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    aria-label={pinned ? 'Unpin tip' : 'Pin tip'}
                    onClick={() => togglePinnedTip({
                      id: tip.id,
                      title: tip.title,
                      type: tip.type,
                    })}
                  >
                    <AppIcon name={pinned ? 'pin' : 'star'} size={15} />
                  </Button>
                </header>

                <h3 className="tip-feed-title">{tip.title || 'Untitled tip'}</h3>
                <p className="tip-feed-copy">{tip.content || 'No content provided.'}</p>

                {tip.action ? (
                  <div className="tip-feed-action-box">
                    <p className="tip-feed-action-label">Actionable next step</p>
                    <p className="tip-feed-action-copy">{tip.action}</p>
                  </div>
                ) : null}

                <footer className="tip-feed-footer">
                  <div className="tip-author-block">
                    <span className="tip-author-avatar" aria-hidden="true">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" loading="lazy" />
                      ) : (
                        <span>{initialsFor(tip.authorName)}</span>
                      )}
                    </span>
                    <span className="ui-card-subtitle">
                      By {tip.authorName || 'Unknown'} • {formatDate(tip.createdAtDate)}
                    </span>
                  </div>
                  <div className="tip-feed-footer-actions">
                    {tip.isFeatured ? <span className="status-badge success">Featured</span> : null}
                    <Button to="/signals" size="sm" variant="ghost">
                      Apply
                      <AppIcon name="chevronRight" size={13} />
                    </Button>
                  </div>
                </footer>
              </Card>
            );
          })}
        </section>
      )}
    </AppShell>
  );
};

export default TipsPage;

function chunkIds(ids, size) {
  const chunks = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

function resolveUserAvatarUrl(data = {}) {
  const candidates = [
    data.avatarUrl,
    data.photoURL,
    data.photoUrl,
    data.imageUrl,
  ];

  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function initialsFor(name) {
  const value = String(name || '').trim();
  if (!value) {
    return 'T';
  }
  const segments = value.split(/\s+/).filter(Boolean).slice(0, 2);
  return segments.map((segment) => segment[0].toUpperCase()).join('');
}
