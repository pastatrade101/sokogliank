import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore, storage } from '../firebase/init';
import { getAdminNavItems } from '../config/adminNavigation';
import { isAdmin } from '../utils/roleHelpers';
import { formatDateTime, timestampToDate } from '../utils/tradingData';
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
  StatCard,
  Textarea,
  Toggle,
  useToast,
} from './ui';
import AppIcon from './icons/AppIcon';

const EMPTY_FORM = {
  chip: '',
  title: '',
  subtitle: '',
  order: '1',
  isActive: true,
};

const AdminSlidersPage = () => {
  const { profile, user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();
  const adminUser = isAdmin(profile?.role);

  const [slides, setSlides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingSlide, setEditingSlide] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

  useEffect(() => {
    if (!adminUser) {
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collection(firestore, 'login_sliders'),
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) => normalizeLoginSlider(docSnap.id, docSnap.data() ?? {}))
          .sort(compareAdminSlides);
        setSlides(next);
        setLoading(false);
        setError('');
      },
      (loadError) => {
        setError(loadError.message || 'Unable to load login sliders.');
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [adminUser]);

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const stats = useMemo(() => {
    const active = slides.filter((entry) => entry.isActive).length;
    const withImages = slides.filter((entry) => entry.imageUrl).length;
    const highestOrder = slides.reduce((max, entry) => Math.max(max, entry.order), 0);
    return { total: slides.length, active, withImages, highestOrder };
  }, [slides]);

  const resetComposer = () => {
    setComposerOpen(false);
    setEditingSlide(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return '';
    });
  };

  const openCreateComposer = () => {
    setEditingSlide(null);
    setForm({
      ...EMPTY_FORM,
      order: String(stats.highestOrder + 1 || 1),
    });
    setFormError('');
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return '';
    });
    setComposerOpen(true);
  };

  const openEditComposer = (slide) => {
    setEditingSlide(slide);
    setForm({
      chip: slide.chip,
      title: slide.title,
      subtitle: slide.subtitle,
      order: String(slide.order || 1),
      isActive: slide.isActive,
    });
    setFormError('');
    setImageFile(null);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return '';
    });
    setComposerOpen(true);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImagePreview((current) => {
        if (current) {
          URL.revokeObjectURL(current);
        }
        return '';
      });
      return;
    }

    const validationError = validateSliderImage(file);
    if (validationError) {
      setFormError(validationError);
      event.target.value = '';
      return;
    }

    setFormError('');
    setImageFile(file);
    setImagePreview((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) {
      return;
    }

    const validationError = validateSliderPayload({
      title: form.title,
      subtitle: form.subtitle,
      order: form.order,
      imageFile,
      hasExistingImage: Boolean(editingSlide?.imageUrl),
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      const sliderRef = editingSlide
        ? doc(firestore, 'login_sliders', editingSlide.id)
        : doc(collection(firestore, 'login_sliders'));

      let imageUrl = editingSlide?.imageUrl || '';
      let imagePath = editingSlide?.imagePath || '';
      if (imageFile) {
        const upload = await uploadSliderImageFile({ uid: user.uid, sliderId: sliderRef.id, file: imageFile });
        imageUrl = upload.url;
        imagePath = upload.path;
      }

      await setDoc(sliderRef, {
        chip: form.chip.trim(),
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        order: Number.parseInt(form.order, 10),
        isActive: form.isActive,
        imageUrl,
        imagePath,
        updatedAt: serverTimestamp(),
        ...(editingSlide
          ? {}
          : {
              createdAt: serverTimestamp(),
              createdBy: user.uid,
            }),
      }, { merge: true });

      pushToast({
        type: 'success',
        title: editingSlide ? 'Slider updated' : 'Slider created',
        message: editingSlide
          ? 'The login screen slider has been updated.'
          : 'The new login screen slider is ready.',
      });
      resetComposer();
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to save slider.';
      setFormError(message);
      pushToast({ type: 'error', title: 'Save failed', message });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (slide) => {
    try {
      await setDoc(doc(firestore, 'login_sliders', slide.id), {
        isActive: !slide.isActive,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      pushToast({
        type: 'success',
        title: slide.isActive ? 'Slider hidden' : 'Slider activated',
        message: slide.isActive
          ? 'This slider will stop showing on the login screen.'
          : 'This slider is now live on the login screen.',
      });
    } catch (toggleError) {
      pushToast({
        type: 'error',
        title: 'Update failed',
        message: toggleError instanceof Error ? toggleError.message : 'Unable to update slider status.',
      });
    }
  };

  const handleDelete = async (slide) => {
    if (!window.confirm(`Delete slider "${slide.title}"?`)) {
      return;
    }
    try {
      await deleteDoc(doc(firestore, 'login_sliders', slide.id));
      pushToast({
        type: 'success',
        title: 'Slider deleted',
        message: 'The login slider has been removed.',
      });
    } catch (deleteError) {
      pushToast({
        type: 'error',
        title: 'Delete failed',
        message: deleteError instanceof Error ? deleteError.message : 'Unable to delete slider.',
      });
    }
  };

  if (!adminUser) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <AppShell
      pageTitle="Login Sliders"
      pageDescription="Manage the rotating slides shown on the public login screen"
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
          { label: 'Sliders' },
        ]}
      />

      <div className="slider-admin-head">
        <Button variant="primary" size="sm" onClick={openCreateComposer}>
          <AppIcon name="sparkles" size={14} />
          Add Slider
        </Button>
      </div>

      {error ? (
        <ErrorState title="Unable to load sliders" description={error} />
      ) : null}

      <section className="ui-grid cols-4 admin-kpi-grid">
        {loading ? (
          <>
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
            <SkeletonLoader size="xl" />
          </>
        ) : (
          <>
            <StatCard label="Total Sliders" value={String(stats.total)} trend="All login slides" icon="star" />
            <StatCard label="Active Sliders" value={String(stats.active)} trend="Visible on login" icon="sparkles" />
            <StatCard label="Images Ready" value={String(stats.withImages)} trend="Slides with uploaded art" icon="image" />
            <StatCard label="Highest Order" value={String(stats.highestOrder || 0)} trend="Sequence depth" icon="chart" />
          </>
        )}
      </section>

      {loading ? (
        <section className="slider-admin-grid">
          <SkeletonLoader size="xl" />
          <SkeletonLoader size="xl" />
        </section>
      ) : slides.length === 0 ? (
        <EmptyState
          title="No login sliders yet"
          description="Create the first slider and it will be available to the login screen."
          action={<Button variant="primary" onClick={openCreateComposer}>Add Slider</Button>}
        />
      ) : (
        <section className="slider-admin-grid">
          {slides.map((slide) => (
            <Card
              key={slide.id}
              className="slider-admin-card"
              title={slide.title}
              subtitle={`${slide.chip || 'Login slide'} • Order ${slide.order}`}
              hover
              headRight={<span className={`status-badge ${slide.isActive ? 'live' : ''}`}>{slide.isActive ? 'Live' : 'Hidden'}</span>}
            >
              <div className="slider-admin-preview">
                {slide.imageUrl ? (
                  <img src={slide.imageUrl} alt={slide.title} />
                ) : (
                  <div className="slider-admin-preview-empty">
                    <AppIcon name="image" size={18} />
                    <span>No image uploaded</span>
                  </div>
                )}
              </div>

              <div className="slider-admin-meta">
                <p>{slide.subtitle}</p>
                <div className="slider-admin-meta-row">
                  <span>{slide.updatedAtDate ? `Updated ${formatDateTime(slide.updatedAtDate)}` : 'Not updated yet'}</span>
                  <span>{slide.imageUrl ? 'Image ready' : 'Image missing'}</span>
                </div>
              </div>

              <div className="slider-admin-actions">
                <Button variant="primary" size="sm" onClick={() => openEditComposer(slide)}>
                  Edit
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleToggleActive(slide)}>
                  {slide.isActive ? 'Hide' : 'Activate'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(slide)}>
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      <Modal
        open={composerOpen}
        title={editingSlide ? 'Edit Login Slider' : 'Add Login Slider'}
        onClose={resetComposer}
        footer={(
          <div className="slider-admin-modal-actions">
            <Button variant="secondary" onClick={resetComposer}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : (editingSlide ? 'Update Slider' : 'Create Slider')}
            </Button>
          </div>
        )}
      >
        <form className="slider-admin-form" onSubmit={handleSubmit}>
          <div className="ui-grid cols-2">
            <Input
              id="slider-chip"
              label="Chip"
              value={form.chip}
              onChange={(event) => setForm((current) => ({ ...current, chip: event.target.value }))}
              placeholder="Professional Trader Workspace"
              maxLength={60}
            />
            <Input
              id="slider-order"
              label="Order"
              type="number"
              min="1"
              value={form.order}
              onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
              required
            />
          </div>

          <Input
            id="slider-title"
            label="Title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            placeholder="A disciplined workspace for smarter trade execution."
            maxLength={120}
            required
          />

          <Textarea
            id="slider-subtitle"
            label="Subtitle"
            value={form.subtitle}
            onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))}
            placeholder="Track premium signals, review session timing, and stay inside one focused trading workflow."
            rows={4}
            maxLength={220}
            required
          />

          <label className="ui-field" htmlFor="slider-image">
            <span className="ui-field-label">Slider Image</span>
            <input id="slider-image" type="file" accept="image/png,image/jpeg" onChange={handleFileChange} />
            <span className="ui-card-subtitle">Use JPG or PNG under 5MB.</span>
          </label>

          {imagePreview || editingSlide?.imageUrl ? (
            <div className="slider-admin-modal-preview">
              <img src={imagePreview || editingSlide?.imageUrl} alt="Slider preview" />
            </div>
          ) : null}

          <Toggle
            label="Show on login screen"
            checked={form.isActive}
            onChange={(value) => setForm((current) => ({ ...current, isActive: value }))}
          />

          {formError ? <p className="error-text">{formError}</p> : null}
        </form>
      </Modal>
    </AppShell>
  );
};

export default AdminSlidersPage;

function normalizeLoginSlider(id, data) {
  return {
    id,
    chip: String(data.chip || '').trim(),
    title: String(data.title || 'Untitled slide').trim(),
    subtitle: String(data.subtitle || '').trim(),
    imageUrl: String(data.imageUrl || data.image || data.url || '').trim(),
    imagePath: String(data.imagePath || '').trim(),
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 9999,
    isActive: data.isActive !== false,
    createdAtDate: timestampToDate(data.createdAt),
    updatedAtDate: timestampToDate(data.updatedAt),
  };
}

function compareAdminSlides(left, right) {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  const leftTime = left.updatedAtDate?.getTime?.() ?? left.createdAtDate?.getTime?.() ?? 0;
  const rightTime = right.updatedAtDate?.getTime?.() ?? right.createdAtDate?.getTime?.() ?? 0;
  return rightTime - leftTime;
}

function validateSliderPayload({ title, subtitle, order, imageFile, hasExistingImage }) {
  if (!title.trim() || title.trim().length > 120) {
    return 'Title is required and must be 120 characters or less.';
  }
  if (!subtitle.trim() || subtitle.trim().length > 220) {
    return 'Subtitle is required and must be 220 characters or less.';
  }
  const parsedOrder = Number.parseInt(order, 10);
  if (!Number.isFinite(parsedOrder) || parsedOrder < 1) {
    return 'Order must be a valid number starting from 1.';
  }
  if (!imageFile && !hasExistingImage) {
    return 'Upload a slider image before saving.';
  }
  return '';
}

function validateSliderImage(file) {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  if (!['jpg', 'jpeg', 'png'].includes(extension)) {
    return 'Only JPG or PNG images are allowed.';
  }
  if (file.size > 5 * 1024 * 1024) {
    return 'Image must be under 5MB.';
  }
  return '';
}

async function uploadSliderImageFile({ uid, sliderId, file }) {
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const storagePath = `login-sliders/${uid}/${sliderId}.${extension}`;
  const fileRef = ref(storage, storagePath);
  await uploadBytes(fileRef, file, { contentType: file.type || 'image/jpeg' });
  const url = await getDownloadURL(fileRef);
  return { url, path: storagePath };
}
