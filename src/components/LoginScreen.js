import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, onSnapshot } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { firestore } from '../firebase/init';
import { Button, Input, Modal } from './ui';
import AppIcon from './icons/AppIcon';
import { isAdmin, isTrader } from '../utils/roleHelpers';

const REMEMBER_EMAIL_KEY = 'sokogliank.remembered_email';
const REMEMBER_PREFERENCE_KEY = 'sokogliank.remember_preference';
const ANDROID_APP_URL = 'https://play.google.com/store/apps/details?id=com.marketresolve.app';
const AUTH_SHOWCASE_SLIDES = [
  {
    image: '/2141.jpg',
    chip: 'Professional Trader Workspace',
    title: 'A disciplined workspace for smarter trade execution.',
    subtitle: 'Track premium signals, review session timing, and stay inside one focused trading workflow.',
  },
  {
    image: '/slider2.jpg',
    chip: 'Centralized Market Intelligence',
    title: 'Move from insight to execution without leaving your desk.',
    subtitle: 'Follow analysis, validate trader activity, and keep premium operations visible in one dashboard.',
  },
];

const LoginScreen = () => {
  const { signIn, signInWithGoogle, requestPasswordReset, error, sessionStatus } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [showResetSentModal, setShowResetSentModal] = useState(false);
  const [activeShowcaseSlide, setActiveShowcaseSlide] = useState(0);
  const [showcaseSlides, setShowcaseSlides] = useState(AUTH_SHOWCASE_SLIDES);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const savedEmail = window.localStorage.getItem(REMEMBER_EMAIL_KEY) || '';
    const savedPreference = window.localStorage.getItem(REMEMBER_PREFERENCE_KEY) === 'true';
    if (savedEmail) {
      setEmail(savedEmail);
    }
    if (savedEmail || savedPreference) {
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(firestore, 'login_sliders'),
      (snapshot) => {
        const remoteSlides = snapshot.docs
          .map((docSnap) => normalizeShowcaseSlide(docSnap.data() ?? {}))
          .sort(compareLoginSlides)
          .filter((slide) => slide.isActive && slide.image);
        setShowcaseSlides(remoteSlides.length ? remoteSlides : AUTH_SHOWCASE_SLIDES);
      },
      () => {
        setShowcaseSlides(AUTH_SHOWCASE_SLIDES);
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!showcaseSlides.length) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setActiveShowcaseSlide((current) => (current + 1) % showcaseSlides.length);
    }, 4800);

    return () => window.clearInterval(timer);
  }, [showcaseSlides.length]);

  useEffect(() => {
    setActiveShowcaseSlide((current) => {
      if (current < showcaseSlides.length) {
        return current;
      }
      return 0;
    });
  }, [showcaseSlides.length]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setResetMessage('');
    setSubmitting(true);
    try {
      const trimmedEmail = email.trim();
      persistRememberPreference(trimmedEmail, rememberMe);
      const profile = await signIn(trimmedEmail, password, { remember: rememberMe });
      navigate(resolvePostLoginRoute(profile?.role), { replace: true });
    } catch (_) {
      // error surfaced in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setResetMessage('');
    setGoogleSubmitting(true);
    try {
      persistRememberPreference(email.trim(), rememberMe);
      const profile = await signInWithGoogle({ remember: rememberMe });
      navigate(resolvePostLoginRoute(profile?.role), { replace: true });
    } catch (_) {
      // error surfaced in context
    } finally {
      setGoogleSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setResetMessage('');
    setShowResetSentModal(false);
    setResetSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setShowResetSentModal(true);
    } catch (resetError) {
      setResetMessage(resetError instanceof Error ? resetError.message : 'Unable to send reset email.');
    } finally {
      setResetSubmitting(false);
    }
  };

  const showcaseSlide = showcaseSlides[activeShowcaseSlide] || AUTH_SHOWCASE_SLIDES[0];

  return (
    <main className="auth-layout">
      <section className="auth-shell">
        <div className="auth-form-panel">
          <div className="auth-form-head">
            <span className="auth-brand-mark" aria-hidden="true">
              <img src="/logo.png" alt="" />
            </span>
            <Button variant="ghost" iconOnly aria-label="Toggle theme" onClick={toggleTheme}>
              <AppIcon name={theme === 'dark' ? 'sun' : 'moon'} />
            </Button>
          </div>

          <div className="auth-form-copy">
            <p className="auth-kicker">Member Login</p>
            <h1>Access your trading dashboard</h1>
            <p>
              Sign in to continue into signals, sessions, premium tools, and trader intelligence.
            </p>
          </div>

          <form className="auth-form-grid" onSubmit={handleSubmit}>
            <Input
              id="email"
              type="email"
              label="Email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              id="password"
              type="password"
              label="Password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="auth-form-meta">
              <label className="auth-remember-row" htmlFor="remember-me">
                <span className="auth-checkbox">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span aria-hidden="true" className="auth-checkbox-box">
                    {rememberMe ? <AppIcon name="check" size={12} /> : null}
                  </span>
                </span>
                <span className="auth-remember-copy">
                  <strong>Remember me</strong>
                </span>
              </label>
              <button
                type="button"
                className="auth-forgot-link"
                onClick={handleForgotPassword}
                disabled={resetSubmitting || sessionStatus === 'loading'}
              >
                {resetSubmitting ? 'Sending reset...' : 'Forgot password?'}
              </button>
            </div>
            <div className="auth-actions">
              <Button type="submit" variant="primary" disabled={submitting || sessionStatus === 'loading'}>
                {sessionStatus === 'loading' || submitting ? 'Signing in...' : 'Login'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleGoogleSignIn}
                disabled={googleSubmitting || sessionStatus === 'loading'}
              >
                <GoogleMark />
                {googleSubmitting ? 'Opening Google...' : 'Continue with Google'}
              </Button>
            </div>
            {resetMessage ? <p className="auth-reset-message">{resetMessage}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </form>

          <p className="auth-legal">
            By continuing, you acknowledge our
            {' '}
            <Link to="/privacy">Privacy Policy</Link>
            {' '}
            and
            {' '}
            <Link to="/agreement">User Agreement</Link>
            . Prefer mobile?
            {' '}
            <a href={ANDROID_APP_URL} target="_blank" rel="noreferrer">
              Get the Android app
            </a>
            .
          </p>
        </div>

        <aside className="auth-showcase">
          <div className="auth-showcase-slider">
            <AnimatePresence mode="wait">
              <motion.div
                key={showcaseSlide.title}
                className="auth-showcase-slide"
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.015 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              >
                <div
                  className="auth-showcase-overlay"
                  style={{ '--auth-showcase-image': `url(${resolveShowcaseImage(showcaseSlide.image)})` }}
                />

                <div className="auth-showcase-content">
                  <span className="auth-intro-chip">
                    <AppIcon name="sparkles" size={13} />
                    {showcaseSlide.chip}
                  </span>

                  <div className="auth-intro-copy-block">
                    <h2 className="auth-intro-title">{showcaseSlide.title}</h2>
                    <p className="auth-intro-body">{showcaseSlide.subtitle}</p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

            {showcaseSlides.length > 1 ? (
              <div className="auth-showcase-dots" aria-label="Login showcase slides">
                {showcaseSlides.map((slide, index) => (
                  <button
                    key={slide.title}
                    type="button"
                    className={`auth-showcase-dot ${index === activeShowcaseSlide ? 'active' : ''}`.trim()}
                    onClick={() => setActiveShowcaseSlide(index)}
                    aria-label={`Show slide ${index + 1}`}
                    aria-pressed={index === activeShowcaseSlide}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </section>
      <Modal
        open={showResetSentModal}
        title="Reset Link Sent"
        onClose={() => setShowResetSentModal(false)}
        footer={(
          <Button variant="primary" onClick={() => setShowResetSentModal(false)}>
            Close
          </Button>
        )}
      >
        <div className="auth-reset-modal">
          <p>
            Password reset email sent to <strong>{email.trim() || 'your email address'}</strong>.
          </p>
          <p>
            Check your inbox and spam folder, then open the reset link to choose a new password.
          </p>
        </div>
      </Modal>
    </main>
  );
};

export default LoginScreen;

function resolvePostLoginRoute(role) {
  if (isAdmin(role)) {
    return '/admin';
  }
  if (isTrader(role)) {
    return '/signals';
  }
  return '/';
}

function persistRememberPreference(email, remember) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(REMEMBER_PREFERENCE_KEY, remember ? 'true' : 'false');
  if (remember && email) {
    window.localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    return;
  }
  window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.85.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.43 1.36l2.57-2.57C13.46.94 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33c.71-2.12 2.7-3.7 5.03-3.7Z"
      />
    </svg>
  );
}

function normalizeShowcaseSlide(data) {
  return {
    image: String(data.imageUrl || data.image || data.url || data.image_path || '').trim(),
    chip: String(data.chip || 'Professional Trader Workspace').trim(),
    title: String(data.title || '').trim(),
    subtitle: String(data.subtitle || '').trim(),
    isActive: data.isActive !== false && String(data.status || 'active').toLowerCase() !== 'hidden',
    order: Number.isFinite(Number(data.order)) ? Number(data.order) : 9999,
    updatedAtMs: toTimestampMs(data.updatedAt),
  };
}

function resolveShowcaseImage(value) {
  const image = String(value || '').trim();
  if (!image) {
    return '';
  }
  if (/^(https?:|data:|blob:)/i.test(image)) {
    return image;
  }
  return `${process.env.PUBLIC_URL || ''}${image.startsWith('/') ? image : `/${image}`}`;
}

function compareLoginSlides(left, right) {
  if (left.order !== right.order) {
    return left.order - right.order;
  }
  return right.updatedAtMs - left.updatedAtMs;
}

function toTimestampMs(value) {
  if (value?.toDate instanceof Function) {
    return value.toDate().getTime();
  }
  const date = value instanceof Date ? value : null;
  return date ? date.getTime() : 0;
}
