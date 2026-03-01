import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { Button, Input, Modal } from './ui';
import AppIcon from './icons/AppIcon';
import { isAdmin, isTrader } from '../utils/roleHelpers';

const REMEMBER_EMAIL_KEY = 'sokogliank.remembered_email';
const REMEMBER_PREFERENCE_KEY = 'sokogliank.remember_preference';

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
                  <span>Keep this device signed in and prefill your email next time.</span>
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
                {googleSubmitting ? 'Opening Google...' : 'Continue with Google'}
              </Button>
            </div>
            {resetMessage ? <p className="auth-reset-message">{resetMessage}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </form>

          <p className="auth-legal">By continuing, you agree to platform risk and compliance policies.</p>
        </div>

        <aside className="auth-showcase">
          <div
            className="auth-showcase-overlay"
            style={{ '--auth-showcase-image': `url(${process.env.PUBLIC_URL || ''}/2141.jpg)` }}
          />

          <div className="auth-showcase-content">
            <span className="auth-intro-chip">
              <AppIcon name="sparkles" size={13} />
              Professional Trader Workspace
            </span>

            <div className="auth-intro-brand">
              <div>
                <p className="auth-intro-brand-name">Welcome to Soko Gliank</p>
                <p className="auth-intro-brand-copy">Trade with clarity. Execute with confidence.</p>
              </div>
            </div>

            <h2 className="auth-intro-title">A disciplined workspace for smarter trade execution.</h2>
            <p className="auth-intro-body">
              Monitor signals, review session timing, follow curated analysis, and keep premium operations centralized in one place.
            </p>

            <div className="auth-intro-points">
              <p><AppIcon name="check" size={14} /> Live signal tracking with clear risk levels</p>
              <p><AppIcon name="check" size={14} /> Curated trader tips with actionable context</p>
              <p><AppIcon name="check" size={14} /> Premium plan controls with transparent status</p>
            </div>
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
