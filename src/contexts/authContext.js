import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitQuery,
  query,
  where,
} from 'firebase/firestore';
import { auth, firestore } from '../firebase/init';
import { normalizeMembership } from '../utils/membershipHelpers';

const AuthContext = createContext(null);

const initialState = {
  sessionStatus: 'initializing',
  user: null,
  profile: null,
  error: null,
};

function defaultProfileFor(user) {
  return {
    uid: user?.uid ?? '',
    displayName: user?.displayName ?? '',
    username: '',
    country: '',
    email: user?.email ?? '',
    avatarUrl: user?.photoURL ?? '',
    role: 'member',
    traderStatus: 'none',
    membershipTier: 'free',
    membership: normalizeMembership(),
    premiumFallbackExpiresAt: null,
    sessions: [],
    instruments: [],
  };
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

function durationDaysFromIntent(data = {}) {
  const explicit = Number(data.durationDays);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }
  const billing = String(data.billingPeriod || '').toLowerCase();
  if (billing === 'daily') {
    return 1;
  }
  if (billing === 'weekly') {
    return 7;
  }
  const productId = String(data.productId || '').toLowerCase();
  if (productId.includes('daily')) {
    return 1;
  }
  if (productId.includes('weekly')) {
    return 7;
  }
  return 30;
}

async function fetchPremiumFallback(uid) {
  const intentsQuery = query(
    collection(firestore, 'payment_intents'),
    where('uid', '==', uid),
    limitQuery(40),
  );
  const snapshot = await getDocs(intentsQuery);
  let latestExpiry = null;

  snapshot.docs.forEach((intentDoc) => {
    const data = intentDoc.data() ?? {};
    if (String(data.status || '').toLowerCase() !== 'paid') {
      return;
    }
    const activatedAt =
      timestampToDate(data.paidAt) ??
      timestampToDate(data.updatedAt) ??
      timestampToDate(data.createdAt);
    if (!activatedAt) {
      return;
    }
    const days = durationDaysFromIntent(data);
    const expiry = new Date(activatedAt.getTime() + days * 24 * 60 * 60 * 1000);
    if (!latestExpiry || expiry.getTime() > latestExpiry.getTime()) {
      latestExpiry = expiry;
    }
  });

  return latestExpiry;
}

async function fetchUserProfile(uid) {
  const snapshot = await getDoc(doc(firestore, 'users', uid));
  if (!snapshot.exists()) {
    return null;
  }
  const data = snapshot.data() ?? {};
  let premiumFallbackExpiresAt = null;
  try {
    premiumFallbackExpiresAt = await fetchPremiumFallback(uid);
  } catch (error) {
    premiumFallbackExpiresAt = null;
  }
  return {
    uid: snapshot.id,
    displayName: data.displayName ?? data.username ?? '',
    username: data.username ?? '',
    country: data.country ?? '',
    email: data.email ?? '',
    avatarUrl: data.avatarUrl ?? data.photoURL ?? data.photoUrl ?? '',
    role: (data.role ?? 'member').toString().toLowerCase(),
    traderStatus: (data.traderStatus ?? 'none').toString().toLowerCase(),
    membershipTier: (data.membershipTier ?? data.membership?.tier ?? 'free').toString().toLowerCase(),
    membership: normalizeMembership(data.membership, data.membershipTier),
    premiumFallbackExpiresAt,
    sessions: Array.isArray(data.sessions) ? data.sessions : [],
    instruments: Array.isArray(data.instruments) ? data.instruments : [],
    socials: data.socials ?? {},
    socialLinks: data.socialLinks ?? {},
  };
}

export const AuthProvider = ({ children }) => {
  const [state, setState] = useState(initialState);
  const googleProvider = useMemo(() => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }, []);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!mounted) {
        return;
      }
      if (!firebaseUser) {
        setState({ sessionStatus: 'idle', user: null, profile: null, error: null });
        return;
      }
      setState((prev) => ({ ...prev, sessionStatus: 'loading', user: firebaseUser, error: null }));
      try {
        const profile = await fetchUserProfile(firebaseUser.uid);
        if (!mounted) {
          return;
        }
        setState({
          sessionStatus: 'ready',
          user: firebaseUser,
          profile: profile ?? defaultProfileFor(firebaseUser),
          error: null,
        });
      } catch (error) {
        if (!mounted) {
          return;
        }
        setState({
          sessionStatus: 'error',
          user: firebaseUser,
          profile: defaultProfileFor(firebaseUser),
          error: error instanceof Error ? error.message : 'Unable to load profile',
        });
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email, password) => {
    setState((prev) => ({ ...prev, sessionStatus: 'loading', error: null }));
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const profile = await fetchUserProfile(credential.user.uid);
      setState({
        sessionStatus: 'ready',
        user: credential.user,
        profile: profile ?? defaultProfileFor(credential.user),
        error: null,
      });
      return profile;
    } catch (error) {
      setState({
        sessionStatus: 'idle',
        user: null,
        profile: null,
        error: error instanceof Error ? error.message : 'Unable to sign in',
      });
      throw error;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setState({ sessionStatus: 'idle', user: null, profile: null, error: null });
      return null;
    }
    try {
      const profile = await fetchUserProfile(currentUser.uid);
      setState((prev) => ({
        ...prev,
        sessionStatus: 'ready',
        user: currentUser,
        profile: profile ?? defaultProfileFor(currentUser),
        error: null,
      }));
      return profile;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        sessionStatus: 'error',
        user: currentUser,
        profile: prev.profile ?? defaultProfileFor(currentUser),
        error: error instanceof Error ? error.message : 'Unable to refresh profile',
      }));
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setState({ sessionStatus: 'idle', user: null, profile: null, error: null });
  }, []);

  const signInWithGoogle = useCallback(async () => {
    setState((prev) => ({ ...prev, sessionStatus: 'loading', error: null }));
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      const profile = await fetchUserProfile(credential.user.uid);
      setState({
        sessionStatus: 'ready',
        user: credential.user,
        profile: profile ?? defaultProfileFor(credential.user),
        error: null,
      });
      return profile;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        sessionStatus: prev.user ? 'ready' : 'idle',
        error: error instanceof Error ? error.message : 'Unable to sign in with Google',
      }));
      throw error;
    }
  }, [googleProvider]);

  const resendVerification = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not signed in');
    }
    await sendEmailVerification(currentUser);
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signInWithGoogle,
      signOut,
      resendVerification,
      refreshProfile,
    }),
    [state, signIn, signInWithGoogle, signOut, resendVerification, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
