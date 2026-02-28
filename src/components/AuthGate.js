import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  limit as limitQuery,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { useAuth } from '../contexts/authContext';
import { firestore } from '../firebase/init';
import { isAdmin, isMember, isTrader } from '../utils/roleHelpers';
import { Button, Card, Input } from './ui';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 760px)';
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const ADMIN_NON_DASHBOARD_ALLOWED_ROUTES = new Set(['/signals', '/tips', '/terms', '/privacy', '/risk-disclaimer']);

const AuthGate = ({ children }) => {
  const { sessionStatus, user, profile, resendVerification, refreshProfile, error } = useAuth();
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' && window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches,
  );
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [country, setCountry] = useState('');
  const [formError, setFormError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const isAdminRoute = pathname.startsWith('/admin');
  const adminUser = isAdmin(profile?.role);
  const traderUser = isTrader(profile?.role);
  const adminAllowedRoute = isAdminRoute || ADMIN_NON_DASHBOARD_ALLOWED_ROUTES.has(pathname);
  const needsMobileProfileSetup = Boolean(
    isMobileViewport
    && isMember(profile?.role)
    && (!profile?.displayName?.trim() || !profile?.username?.trim() || !profile?.country?.trim()),
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mediaQuery.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!profile) {
      return;
    }
    setDisplayName((current) => current || profile.displayName || user?.displayName || '');
    setUsername((current) => current || profile.username || '');
    setCountry((current) => current || profile.country || '');
  }, [profile, user?.displayName]);

  const handleCompleteProfile = async (event) => {
    event.preventDefault();
    if (!user || !profile) {
      return;
    }
    const safeName = displayName.trim();
    const safeUsername = username.trim();
    const safeCountry = country.trim();
    const usernameLower = safeUsername.toLowerCase();

    if (safeName.length < 2) {
      setFormError('Enter your full name.');
      return;
    }
    if (!USERNAME_PATTERN.test(safeUsername)) {
      setFormError('Username must be 3-24 characters using letters, numbers, or _.');
      return;
    }
    if (safeCountry.length < 2) {
      setFormError('Enter your country.');
      return;
    }

    setSavingProfile(true);
    setFormError('');
    try {
      const usernameQuery = query(
        collection(firestore, 'users'),
        where('usernameLower', '==', usernameLower),
        limitQuery(1),
      );
      const usernameSnapshot = await getDocs(usernameQuery);
      const usernameTaken = usernameSnapshot.docs.some((docSnap) => docSnap.id !== user.uid);

      if (usernameTaken) {
        setFormError('That username is already taken. Choose another one.');
        return;
      }

      const payload = {
        displayName: safeName,
        username: safeUsername,
        usernameLower,
        country: safeCountry,
        email: user.email ?? profile.email ?? '',
        avatarUrl: profile.avatarUrl || user.photoURL || '',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(firestore, 'users', user.uid), payload, { merge: true });
      await refreshProfile();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : 'Unable to save profile right now.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (sessionStatus === 'initializing' || sessionStatus === 'loading') {
    return <div className="screen-screen">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  if (!user.emailVerified) {
    return (
      <div className="screen-screen">
        <Card title="Verify your email" subtitle="Confirm your address before continuing.">
          <Button
            type="button"
            variant="primary"
            onClick={async () => {
              try {
                setMessage('Sending confirmation...');
                await resendVerification();
                setMessage('Verification email sent. Check your inbox.');
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Unable to resend code');
              }
            }}
          >
            Resend verification
          </Button>
          {message ? <p className="ui-card-subtitle">{message}</p> : null}
          {error ? <p className="error-text">{error}</p> : null}
        </Card>
      </div>
    );
  }
  if (!profile) {
    return <div className="screen-screen">Loading profile…</div>;
  }
  if (isAdminRoute && !adminUser) {
    return <Navigate to={traderUser ? '/signals' : '/'} replace />;
  }
  if (adminUser && !adminAllowedRoute) {
    return <Navigate to="/admin" replace />;
  }
  return (
    <>
      {children}
      {needsMobileProfileSetup ? (
        <div className="profile-onboarding-overlay">
          <Card
            className="profile-onboarding-card"
            title="Complete your profile"
            subtitle="Add username, name, and country to continue on mobile."
          >
            <form className="ui-stack" onSubmit={handleCompleteProfile}>
              <Input
                id="onboarding-display-name"
                label="Name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your full name"
                required
              />
              <Input
                id="onboarding-username"
                label="Username"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/\s+/g, ''))}
                placeholder="username"
                hint="3-24 characters (letters, numbers, underscore)"
                required
              />
              <Input
                id="onboarding-country"
                label="Country"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
                placeholder="Tanzania"
                required
              />
              {formError ? <p className="error-text">{formError}</p> : null}
              <Button type="submit" variant="primary" disabled={savingProfile}>
                {savingProfile ? 'Saving profile...' : 'Finish profile setup'}
              </Button>
            </form>
          </Card>
        </div>
      ) : null}
    </>
  );
};

export default AuthGate;
