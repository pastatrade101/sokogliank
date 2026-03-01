import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  doc,
  documentId,
  getDocs,
  limit as limitQuery,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
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
import { adminNavigation } from '../config/adminNavigation';
import { formatDate, isCurrentDay, normalizeTip, TIP_TYPES } from '../utils/tradingData';
import AppIcon from './icons/AppIcon';
import { storage } from '../firebase/init';

const TIP_TAG_OPTIONS = ['XAUUSD', 'Forex', 'Crypto', 'Indices', 'London', 'New York', 'Asia'];
const MAX_TIP_TAGS = 4;

const TipsPage = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pinnedTips, togglePinnedTip } = useEngagementStore();
  const { pushToast } = useToast();
  const adminUser = isAdmin(profile?.role);
  const traderUser = isTrader(profile?.role);
  const navItems = adminUser ? adminNavigation : (traderUser ? traderAdminNavigation : memberNavigation);
  const canPostTips = traderUser && String(profile?.traderStatus || '').toLowerCase() === 'active';

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
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSubmitting, setComposeSubmitting] = useState(false);
  const [tipTitle, setTipTitle] = useState('');
  const [tipType, setTipType] = useState(TIP_TYPES[0]);
  const [tipContent, setTipContent] = useState('');
  const [tipAction, setTipAction] = useState('');
  const [tipTags, setTipTags] = useState([]);
  const [tipImageFile, setTipImageFile] = useState(null);
  const [tipImagePreview, setTipImagePreview] = useState('');
  const [composeError, setComposeError] = useState('');

  useEffect(() => () => {
    if (tipImagePreview) {
      URL.revokeObjectURL(tipImagePreview);
    }
  }, [tipImagePreview]);

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
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Tips' },
        ]}
      />

      {canPostTips ? (
        <div className="tips-content-head">
          <Button variant="primary" size="sm" onClick={() => setComposeOpen(true)}>
            <AppIcon name="sparkles" size={14} />
            Post Tip
          </Button>
        </div>
      ) : null}

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

      <Modal
        open={composeOpen}
        title="Post Trader Tip"
        onClose={() => {
          if (!composeSubmitting) {
            resetTipComposer({
              setComposeOpen,
              setComposeError,
              setTipTitle,
              setTipType,
              setTipContent,
              setTipAction,
              setTipTags,
              setTipImageFile,
              setTipImagePreview,
            });
          }
        }}
      >
        <form
          className="tips-compose-form"
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <div className="tips-compose-grid">
            <Input
              id="tip-title"
              label="Title"
              value={tipTitle}
              onChange={(event) => setTipTitle(event.target.value)}
              hint={`${tipTitle.trim().length}/80 characters`}
              maxLength={80}
            />
            <Select
              id="tip-type"
              label="Type"
              value={tipType}
              onChange={(event) => setTipType(event.target.value)}
              options={TIP_TYPES.map((entry) => ({ value: entry, label: entry }))}
            />
          </div>

          <Textarea
            id="tip-content"
            label="Content"
            value={tipContent}
            onChange={(event) => setTipContent(event.target.value)}
            hint={`${tipContent.trim().length}/400 characters`}
            maxLength={400}
            rows={6}
          />

          <Input
            id="tip-action"
            label="Action"
            value={tipAction}
            onChange={(event) => setTipAction(event.target.value)}
            hint={`${tipAction.trim().length}/120 characters`}
            maxLength={120}
          />

          <div className="tips-compose-section">
            <div className="tips-compose-section-head">
              <p>Tags / Markets</p>
              <span>{tipTags.length}/{MAX_TIP_TAGS}</span>
            </div>
            <div className="tips-compose-tags">
              {TIP_TAG_OPTIONS.map((tag) => {
                const selected = tipTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`tips-compose-tag ${selected ? 'active' : ''}`.trim()}
                    onClick={() => {
                      setComposeError('');
                      setTipTags((current) => {
                        if (current.includes(tag)) {
                          return current.filter((entry) => entry !== tag);
                        }
                        if (current.length >= MAX_TIP_TAGS) {
                          pushToast({
                            type: 'error',
                            title: 'Tag limit reached',
                            message: 'Limit tags to four, same as the mobile app.',
                          });
                          return current;
                        }
                        return [...current, tag];
                      });
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tips-compose-section">
            <div className="tips-compose-section-head">
              <p>Optional image</p>
              <span>JPG or PNG, under 5MB</span>
            </div>
            {tipImagePreview ? (
              <div className="tips-compose-image-preview">
                <img src={tipImagePreview} alt="Tip preview" />
              </div>
            ) : null}
            <div className="tips-compose-actions-row">
              <label className="ui-button secondary tips-upload-button" htmlFor="tip-image-upload">
                <AppIcon name="sparkles" size={14} />
                {tipImagePreview ? 'Replace Image' : 'Add Image'}
              </label>
              <input
                id="tip-image-upload"
                type="file"
                accept="image/png,image/jpeg"
                className="tips-upload-input"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) {
                    return;
                  }
                  const validationMessage = validateTipImage(file);
                  if (validationMessage) {
                    setComposeError(validationMessage);
                    return;
                  }
                  if (tipImagePreview) {
                    URL.revokeObjectURL(tipImagePreview);
                  }
                  setComposeError('');
                  setTipImageFile(file);
                  setTipImagePreview(URL.createObjectURL(file));
                }}
              />
              {tipImagePreview ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (tipImagePreview) {
                      URL.revokeObjectURL(tipImagePreview);
                    }
                    setTipImageFile(null);
                    setTipImagePreview('');
                  }}
                >
                  Remove
                </Button>
              ) : null}
            </div>
          </div>

          {composeError ? <p className="error-text">{composeError}</p> : null}

          <div className="tips-compose-submit-row">
            <Button
              type="button"
              variant="secondary"
              disabled={composeSubmitting}
              onClick={() => submitTip({
                status: 'draft',
                user,
                profile,
                tipTitle,
                tipType,
                tipContent,
                tipAction,
                tipTags,
                tipImageFile,
                pushToast,
                setComposeError,
                setComposeSubmitting,
                onSuccess: () => resetTipComposer({
                  setComposeOpen,
                  setComposeError,
                  setTipTitle,
                  setTipType,
                  setTipContent,
                  setTipAction,
                  setTipTags,
                  setTipImageFile,
                  setTipImagePreview,
                }),
              })}
            >
              {composeSubmitting ? 'Saving...' : 'Save Draft'}
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={composeSubmitting}
              onClick={() => submitTip({
                status: 'published',
                user,
                profile,
                tipTitle,
                tipType,
                tipContent,
                tipAction,
                tipTags,
                tipImageFile,
                pushToast,
                setComposeError,
                setComposeSubmitting,
                onSuccess: () => resetTipComposer({
                  setComposeOpen,
                  setComposeError,
                  setTipTitle,
                  setTipType,
                  setTipContent,
                  setTipAction,
                  setTipTags,
                  setTipImageFile,
                  setTipImagePreview,
                }),
              })}
            >
              {composeSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </div>
        </form>
      </Modal>
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

function validateTipPayload({ title, content, action }) {
  const safeTitle = String(title || '').trim();
  const safeContent = String(content || '').trim();
  const safeAction = String(action || '').trim();

  if (!safeTitle || safeTitle.length > 80) {
    return 'Title is required and must be 80 characters or less.';
  }
  if (!safeContent || safeContent.length > 400) {
    return 'Content is required and must be 400 characters or less.';
  }
  if (!safeAction || safeAction.length > 120) {
    return 'Action is required and must be 120 characters or less.';
  }
  return '';
}

function validateTipImage(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!['jpg', 'jpeg', 'png'].includes(extension)) {
    return 'Only JPG or PNG images are allowed.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image must be under 5MB.';
  }
  return '';
}

async function submitTip({
  status,
  user,
  profile,
  tipTitle,
  tipType,
  tipContent,
  tipAction,
  tipTags,
  tipImageFile,
  pushToast,
  setComposeError,
  setComposeSubmitting,
  onSuccess,
}) {
  const validationError = validateTipPayload({
    title: tipTitle,
    content: tipContent,
    action: tipAction,
  });
  if (validationError) {
    setComposeError(validationError);
    return;
  }

  setComposeError('');
  setComposeSubmitting(true);
  try {
    const tipRef = doc(collection(firestore, 'trader_tips'));
    let imageUrl = '';
    let imagePath = '';

    if (tipImageFile) {
      const upload = await uploadTipImageFile({ uid: user.uid, tipId: tipRef.id, file: tipImageFile });
      imageUrl = upload.url;
      imagePath = upload.path;
    }

    await setDoc(tipRef, {
      title: tipTitle.trim(),
      type: tipType,
      content: tipContent.trim(),
      action: tipAction.trim(),
      tags: tipTags,
      imageUrl,
      imagePath,
      status,
      createdBy: user.uid,
      authorName: String(profile?.displayName || profile?.username || user.displayName || user.email || 'Trader').trim(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isFeatured: false,
      likesCount: 0,
      savesCount: 0,
    });

    pushToast({
      type: 'success',
      title: status === 'published' ? 'Tip published' : 'Draft saved',
      message: status === 'published'
        ? 'Your trader tip is now live on the feed.'
        : 'Draft saved. Publish it when you are ready.',
    });
    onSuccess();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save tip.';
    setComposeError(message);
    pushToast({ type: 'error', title: 'Save failed', message });
  } finally {
    setComposeSubmitting(false);
  }
}

function resetTipComposer({
  setComposeOpen,
  setComposeError,
  setTipTitle,
  setTipType,
  setTipContent,
  setTipAction,
  setTipTags,
  setTipImageFile,
  setTipImagePreview,
}) {
  setComposeOpen(false);
  setComposeError('');
  setTipTitle('');
  setTipType(TIP_TYPES[0]);
  setTipContent('');
  setTipAction('');
  setTipTags([]);
  setTipImageFile(null);
  setTipImagePreview((current) => {
    if (current) {
      URL.revokeObjectURL(current);
    }
    return '';
  });
}

async function uploadTipImageFile({ uid, tipId, file }) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const storagePath = `tips/${uid}/${tipId}.${extension}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
  const url = await getDownloadURL(fileRef);
  return { url, path: storagePath };
}
