import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { Button, Input } from './ui';
import AppIcon from './icons/AppIcon';
import { isAdmin, isTrader } from '../utils/roleHelpers';

const LoginScreen = () => {
  const { signIn, signInWithGoogle, error, sessionStatus } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const profile = await signIn(email.trim(), password);
      navigate(resolvePostLoginRoute(profile?.role), { replace: true });
    } catch (_) {
      // error surfaced in context
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleSubmitting(true);
    try {
      const profile = await signInWithGoogle();
      navigate(resolvePostLoginRoute(profile?.role), { replace: true });
    } catch (_) {
      // error surfaced in context
    } finally {
      setGoogleSubmitting(false);
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
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              id="password"
              type="password"
              label="Password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
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
