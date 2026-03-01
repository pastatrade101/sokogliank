import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { addDoc, collection, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { firestore, storage } from '../firebase/init';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { isAdmin, isMember, isTrader, isTraderAdmin } from '../utils/roleHelpers';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  SkeletonLoader,
  Textarea,
  useToast,
} from './ui';
import { memberNavigation, traderAdminNavigation } from '../config/navigation';
import { adminNavigation } from '../config/adminNavigation';
import AppIcon from './icons/AppIcon';

const TestimonialsPage = () => {
  const { sessionStatus, profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const [testimonials, setTestimonials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewTestimonial, setPreviewTestimonial] = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [messageValue, setMessageValue] = useState('');
  const [signalIdValue, setSignalIdValue] = useState('');
  const [imageUrlValue, setImageUrlValue] = useState('');
  const [localImageFile, setLocalImageFile] = useState(null);
  const [localImagePreviewUrl, setLocalImagePreviewUrl] = useState('');

  const adminUser = isAdmin(profile?.role);
  const traderAdminUser = isTraderAdmin(profile?.role);
  const memberUser = isMember(profile?.role);
  const traderUser = isTrader(profile?.role);
  const canPostTestimonials = adminUser || traderAdminUser;
  const navItems = adminUser ? adminNavigation : (traderAdminUser ? traderAdminNavigation : memberNavigation);

  useEffect(() => {
    const testimonialsQuery = query(
      collection(firestore, 'testimonials'),
      where('status', '==', 'published'),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      testimonialsQuery,
      (snapshot) => {
        setTestimonials(snapshot.docs.map((docSnap) => normalizeTestimonial(docSnap.id, docSnap.data() || {})));
        setLoading(false);
        setError('');
      },
      (loadError) => {
        setError(loadError.message || 'Unable to load testimonials.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
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

  const sortedTestimonials = useMemo(() => {
    const next = [...testimonials];
    next.sort((left, right) => right.createdAtDate.getTime() - left.createdAtDate.getTime());
    return next;
  }, [testimonials]);

  const proofCount = useMemo(
    () => sortedTestimonials.filter((item) => item.proofImageUrl).length,
    [sortedTestimonials],
  );

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading testimonials...</div>;
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  if (!memberUser && !adminUser && !traderAdminUser) {
    return <Navigate to={traderUser ? '/signals' : '/'} replace />;
  }

  return (
    <AppShell
      pageTitle="Testimonials"
      pageDescription="Member reviews, proof, and real trading outcomes"
      navItems={navItems.map((item) => (
        item.to === '/testimonials'
          ? { ...item, badge: String(sortedTestimonials.length) }
          : item
      ))}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Testimonials' },
        ]}
      />

      {canPostTestimonials ? (
        <div className="testimonials-content-head">
          <Button type="button" variant="primary" size="sm" onClick={() => setComposerOpen(true)}>
            <AppIcon name="message" size={14} />
            Post Review
          </Button>
        </div>
      ) : null}

      <section className="testimonials-hero-grid">
        <article className="hero-banner hero-banner-premium testimonials-hero">
          <div className="hero-kicker-row">
            <span className="hero-kicker-chip">
              <AppIcon name="message" size={13} />
              Real member feedback
            </span>
          </div>
          <h2>What members are saying about the trading desk</h2>
          <p>
            Published reviews from the app, including proof images where traders shared screenshots of outcomes.
          </p>
          <div className="hero-metric-grid hero-metric-grid-rich">
            <article className="hero-metric hero-metric-strong">
              <div className="hero-metric-head">
                <AppIcon name="message" size={14} />
                <span>Published</span>
              </div>
              <p className="hero-metric-value">{sortedTestimonials.length}</p>
            </article>
            <article className="hero-metric">
              <div className="hero-metric-head">
                <AppIcon name="sparkles" size={14} />
                <span>With proof</span>
              </div>
              <p className="hero-metric-value">{proofCount}</p>
            </article>
          </div>
        </article>

        <Card className="dashboard-glance-card testimonials-glance-card" title="Review Feed" subtitle="Published testimonials only" hover>
          <div className="ui-pill-row">
            <span className="ui-pill active">Verified members</span>
            <span className="ui-pill">Chronology: newest</span>
          </div>
          <div className="session-flow-list">
            <div className="session-flow-row">
              <div className="session-flow-row-head">
                <strong>Proof image coverage</strong>
                <span>{sortedTestimonials.length ? `${Math.round((proofCount / sortedTestimonials.length) * 100)}%` : '0%'}</span>
              </div>
              <progress className="session-flow-progress" value={proofCount} max={Math.max(1, sortedTestimonials.length)} />
            </div>
          </div>
        </Card>
      </section>

      {error ? (
        <ErrorState title="Unable to load testimonials" description={error} />
      ) : null}

      {loading ? (
        <section className="testimonials-grid">
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
        </section>
      ) : sortedTestimonials.length === 0 ? (
        <EmptyState
          title="No testimonials published yet"
          description="Published member reviews will appear here once available."
          icon="message"
        />
      ) : (
        <section className="testimonials-grid">
          {sortedTestimonials.map((testimonial, index) => (
            <article key={testimonial.id} className={`testimonial-card tone-${(index % 3) + 1}`.trim()}>
              <div className="testimonial-card-head">
                <span className="analysis-special-chip testimonial-role-chip">
                  <AppIcon name="sparkles" size={12} />
                  {testimonial.authorRoleLabel}
                </span>
                <span className="testimonial-date">{formatTestimonialDate(testimonial.createdAtDate)}</span>
              </div>

              <h3 className="testimonial-title">{testimonial.title || 'Testimonial'}</h3>
              <p className="testimonial-message">{testimonial.message}</p>

              {testimonial.proofImageUrl ? (
                <button
                  type="button"
                  className="testimonial-proof"
                  onClick={() => setPreviewTestimonial(testimonial)}
                >
                  <img
                    src={testimonial.proofImageUrl}
                    alt={`${testimonial.authorName} proof`}
                    loading="lazy"
                  />
                  <span className="testimonial-proof-chip">
                    <AppIcon name="external" size={12} />
                    View proof
                  </span>
                </button>
              ) : null}

              <div className="testimonial-foot">
                <div>
                  <p className="testimonial-author">{testimonial.authorName}</p>
                  {testimonial.signalId ? (
                    <p className="testimonial-meta">Linked to signal #{testimonial.signalId.slice(0, 8)}</p>
                  ) : (
                    <p className="testimonial-meta">Published review</p>
                  )}
                </div>
                <span className="testimonial-status-pill">Published</span>
              </div>
            </article>
          ))}
        </section>
      )}

      <Modal
        open={Boolean(previewTestimonial)}
        title={previewTestimonial?.title || 'Testimonial proof'}
        onClose={() => setPreviewTestimonial(null)}
      >
        {previewTestimonial?.proofImageUrl ? (
          <div className="testimonial-proof-preview-wrap">
            <img
              src={previewTestimonial.proofImageUrl}
              alt={`${previewTestimonial.authorName} proof`}
              className="testimonial-proof-preview"
            />
            <p className="ui-card-subtitle">
              {previewTestimonial.authorName} • {formatTestimonialDate(previewTestimonial.createdAtDate)}
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={composerOpen}
        title="Post Testimonial"
        onClose={closeComposer}
      >
        <form className="testimonial-compose-form" onSubmit={handleCreateTestimonial}>
          <Input
            id="testimonial-compose-title"
            label="Title"
            value={titleValue}
            onChange={(event) => setTitleValue(event.target.value)}
            placeholder="Consistent signals and clean execution"
            maxLength={120}
            required
          />
          <Textarea
            id="testimonial-compose-message"
            label="Message"
            rows={5}
            value={messageValue}
            onChange={(event) => setMessageValue(event.target.value)}
            placeholder="Write the review exactly how you want members to see it."
            maxLength={1200}
            required
          />
          <Input
            id="testimonial-compose-signal-id"
            label="Linked Signal ID (optional)"
            value={signalIdValue}
            onChange={(event) => setSignalIdValue(event.target.value)}
            placeholder="Signal document id"
          />
          <label className="ui-field" htmlFor="testimonial-compose-image-file">
            <span className="ui-field-label">Proof Image (optional)</span>
            <input
              id="testimonial-compose-image-file"
              type="file"
              accept="image/*"
              className="ui-input"
              onChange={handleLocalImageChange}
            />
            <span className="ui-card-subtitle">PNG, JPG, WEBP up to 5MB.</span>
          </label>
          {localImagePreviewUrl ? (
            <div className="testimonial-compose-image-preview-wrap">
              <img
                src={localImagePreviewUrl}
                alt="Selected testimonial proof preview"
                className="testimonial-compose-image-preview"
              />
            </div>
          ) : null}
          <Input
            id="testimonial-compose-image-url"
            label="Proof Image URL (optional fallback)"
            value={imageUrlValue}
            onChange={(event) => setImageUrlValue(event.target.value)}
            placeholder="https://..."
            hint="Used only when no local file is selected."
          />

          {composerError ? <p className="error-text">{composerError}</p> : null}

          <div className="testimonial-compose-actions">
            <Button type="button" variant="ghost" onClick={closeComposer} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? 'Publishing...' : 'Publish Review'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );

  async function handleCreateTestimonial(event) {
    event.preventDefault();
    if (!user || !canPostTestimonials || submitting) {
      return;
    }

    const safeTitle = titleValue.trim();
    const safeMessage = messageValue.trim();
    const safeSignalId = signalIdValue.trim();

    if (safeTitle.length < 3) {
      setComposerError('Title must be at least 3 characters.');
      return;
    }
    if (safeMessage.length < 10) {
      setComposerError('Message must be at least 10 characters.');
      return;
    }

    setSubmitting(true);
    setComposerError('');

    try {
      let resolvedImageUrl = imageUrlValue.trim();
      let proofImagePath = '';

      if (localImageFile) {
        const upload = await uploadTestimonialImageFile({
          uid: user.uid,
          file: localImageFile,
        });
        resolvedImageUrl = upload.url;
        proofImagePath = upload.path;
      }

      await addDoc(collection(firestore, 'testimonials'), {
        authorUid: user.uid,
        authorName:
          String(profile?.displayName || profile?.username || user.displayName || user.email || 'Member').trim(),
        authorRole: String(profile?.role || 'member').trim(),
        title: safeTitle,
        message: safeMessage,
        status: 'published',
        proofImageUrl: resolvedImageUrl || null,
        proofImagePath: proofImagePath || null,
        signalId: safeSignalId || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        publishedAt: serverTimestamp(),
      });

      pushToast({
        type: 'success',
        title: 'Review published',
        message: 'The testimonial is now live on the member page.',
      });
      resetComposer();
      setComposerOpen(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to publish review.';
      setComposerError(message);
      pushToast({
        type: 'error',
        title: 'Publish failed',
        message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  function closeComposer() {
    if (!submitting) {
      setComposerOpen(false);
      setComposerError('');
    }
  }

  function resetComposer() {
    setTitleValue('');
    setMessageValue('');
    setSignalIdValue('');
    setImageUrlValue('');
    setLocalImageFile(null);
    setLocalImagePreviewUrl('');
    setComposerError('');
  }

  function handleLocalImageChange(event) {
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
  }
};

export default TestimonialsPage;

function normalizeTestimonial(id, data) {
  const createdAtDate = toDateValue(data.createdAt) || new Date();
  const authorRole = String(data.authorRole || 'member').trim();

  return {
    id,
    authorUid: String(data.authorUid || '').trim(),
    authorName: String(data.authorName || 'Member').trim(),
    authorRole,
    authorRoleLabel: humanize(authorRole),
    title: String(data.title || '').trim(),
    message: String(data.message || '').trim(),
    status: String(data.status || 'pending').trim(),
    proofImageUrl: String(data.proofImageUrl || '').trim(),
    signalId: String(data.signalId || '').trim(),
    createdAtDate,
  };
}

function toDateValue(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function humanize(value) {
  return String(value || '')
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Member';
}

function formatTestimonialDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

async function uploadTestimonialImageFile({ uid, file }) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const storagePath = `testimonials/${uid}/${Date.now()}.${extension}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
  const url = await getDownloadURL(fileRef);
  return { url, path: storagePath };
}
