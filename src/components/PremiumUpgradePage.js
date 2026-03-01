import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { collection, doc, documentId, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { firebaseFunctions, firestore } from '../firebase/init';
import { useAuth } from '../contexts/authContext';
import { useTheme } from '../contexts/themeContext';
import { isMember } from '../utils/roleHelpers';
import { isPremiumActive } from '../utils/membershipHelpers';
import { initiatePremiumCheckout } from '../services/premiumCheckoutService';
import {
  AppShell,
  Breadcrumbs,
  Button,
  Card,
  Input,
  Modal,
  Select,
  Stepper,
  useToast,
} from './ui';
import { memberNavigation } from '../config/navigation';
import { formatDateTime, timestampToDate } from '../utils/tradingData';
import AppIcon from './icons/AppIcon';

const PLAN_DEFAULTS = [
  {
    id: 'premium_weekly',
    title: 'Premium Weekly',
    subtitle: 'Flexible 7-day access',
    price: 12000,
    currency: 'TZS',
    billingPeriod: 'weekly',
    durationLabel: 'Valid for 7 days',
  },
  {
    id: 'premium_monthly',
    title: 'Premium Monthly',
    subtitle: 'Best value for active traders',
    price: 30000,
    currency: 'TZS',
    billingPeriod: 'monthly',
    durationLabel: 'Valid for 30 days',
  },
];

const PROVIDERS = [
  { value: 'vodacom', label: 'M-Pesa (Vodacom)' },
  { value: 'airtel', label: 'Airtel Money' },
  { value: 'tigo', label: 'Tigo Pesa' },
  { value: 'halopesa', label: 'HaloPesa' },
];

const ABORT_REASON_QUESTION = 'What is the main reason you aborted payment?';
const ABORT_REASON_OPTIONS = [
  { key: 'no_prompt', label: 'I did not receive a payment prompt.' },
  { key: 'insufficient_funds', label: 'I had insufficient wallet balance.' },
  { key: 'wrong_number', label: 'I used the wrong phone number.' },
  { key: 'network_issue', label: 'I faced a network or app issue.' },
  { key: 'changed_mind', label: 'I changed my mind.' },
];

const PremiumUpgradePage = () => {
  const { profile, user, signOut, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  const [productsById, setProductsById] = useState({});
  const [selectedPlanId, setSelectedPlanId] = useState('premium_monthly');
  const [provider, setProvider] = useState('vodacom');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [intentId, setIntentId] = useState('');
  const [intentStatus, setIntentStatus] = useState(null);
  const [profileSyncedAfterPayment, setProfileSyncedAfterPayment] = useState(false);
  const [selectedAbortReasonKey, setSelectedAbortReasonKey] = useState('');
  const [isSavingAbortReason, setIsSavingAbortReason] = useState(false);
  const [abortReasonSubmitted, setAbortReasonSubmitted] = useState(false);
  const [abortReasonMessage, setAbortReasonMessage] = useState('');
  const [showAbortReasonModal, setShowAbortReasonModal] = useState(false);

  useEffect(() => {
    const planIds = PLAN_DEFAULTS.map((plan) => plan.id);
    const productsQuery = query(collection(firestore, 'products'), where(documentId(), 'in', planIds));

    const unsubscribe = onSnapshot(productsQuery, (snapshot) => {
      const next = {};
      snapshot.docs.forEach((planDoc) => {
        const data = planDoc.data() ?? {};
        next[planDoc.id] = {
          title: data.title ?? '',
          price: Number(data.price ?? 0),
          currency: data.currency ?? 'TZS',
          billingPeriod: data.billingPeriod ?? 'monthly',
          isActive: data.isActive === true,
        };
      });
      setProductsById(next);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!intentId) {
      setIntentStatus(null);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      doc(firestore, 'payment_intents', intentId),
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() ?? {};
        setIntentStatus({
          id: snapshot.id,
          status: String(data.status ?? 'pending').toLowerCase(),
          provider: data.provider ?? provider,
          msisdn: data.msisdn ?? phoneNumber,
          createdAt: timestampToDate(data.createdAt),
          expiresAt: timestampToDate(data.expiresAt),
          message: data.message ?? '',
          productId: data.productId ?? selectedPlanId,
        });
      },
      (error) => {
        setErrorMessage(error.message || 'Unable to track payment status.');
      },
    );

    return () => unsubscribe();
  }, [intentId, phoneNumber, provider, selectedPlanId]);

  useEffect(() => {
    if (!intentStatus || intentStatus.status !== 'paid' || profileSyncedAfterPayment) {
      return;
    }

    setProfileSyncedAfterPayment(true);
    (async () => {
      try {
        const refreshedProfile = await refreshProfile();
        if (isPremiumActive(refreshedProfile)) {
          return;
        }
        const reconcile = httpsCallable(firebaseFunctions, 'reconcilePremiumMembership');
        await reconcile({ intentId: intentStatus.id });
        const finalProfile = await refreshProfile();
        if (isPremiumActive(finalProfile)) {
          setSuccessMessage('Payment confirmed and premium access synced.');
          setErrorMessage('');
        } else {
          setErrorMessage('Payment is marked paid but membership is still inactive. Contact support with this intent ID.');
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Payment is paid but membership sync failed. Retry in a minute.',
        );
      }
    })();
  }, [intentStatus, profileSyncedAfterPayment, refreshProfile]);

  useEffect(() => {
    setSelectedAbortReasonKey('');
    setIsSavingAbortReason(false);
    setAbortReasonSubmitted(false);
    setAbortReasonMessage('');
    setShowAbortReasonModal(false);
  }, [intentStatus?.id]);

  const plans = useMemo(() => {
    return PLAN_DEFAULTS.map((plan) => {
      const remote = productsById[plan.id];
      if (!remote) {
        return { ...plan, isActive: false };
      }
      return {
        ...plan,
        title: remote.title || plan.title,
        price: Number.isFinite(remote.price) ? remote.price : plan.price,
        currency: remote.currency || plan.currency,
        billingPeriod: remote.billingPeriod || plan.billingPeriod,
        isActive: remote.isActive === true,
      };
    });
  }, [productsById]);

  const activePlans = useMemo(() => plans.filter((plan) => plan.isActive), [plans]);

  useEffect(() => {
    if (activePlans.some((plan) => plan.id === selectedPlanId)) {
      return;
    }
    if (activePlans.length > 0) {
      setSelectedPlanId(activePlans[0].id);
    }
  }, [activePlans, selectedPlanId]);

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const premiumAlreadyActive = isPremiumActive(profile);
  const intentFailed = isFailedIntentStatus(intentStatus?.status);

  useEffect(() => {
    if (intentFailed && intentStatus?.id && !abortReasonSubmitted) {
      setShowAbortReasonModal(true);
    }
  }, [intentFailed, intentStatus?.id, abortReasonSubmitted]);

  if (!isMember(profile?.role)) {
    return <Navigate to="/" replace />;
  }

  if (premiumAlreadyActive) {
    return <Navigate to="/signals" replace />;
  }

  const handleStartCheckout = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIntentId('');
    setIntentStatus(null);
    setProfileSyncedAfterPayment(false);
    setSelectedAbortReasonKey('');
    setIsSavingAbortReason(false);
    setAbortReasonSubmitted(false);
    setAbortReasonMessage('');
    setShowAbortReasonModal(false);

    if (!selectedPlan?.isActive) {
      setErrorMessage('Selected plan is not active right now.');
      return;
    }

    if (!/^0\d{9}$/.test(phoneNumber.trim())) {
      setErrorMessage('Use a valid 10-digit phone number starting with 0.');
      return;
    }

    if (!user) {
      setErrorMessage('Sign in required.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = await initiatePremiumCheckout({
        user,
        provider,
        accountNumber: phoneNumber.trim(),
        productId: selectedPlan.id,
      });

      if (payload.trialActivated === true) {
        const trialDays = Number(payload.trialDays ?? 1);
        setSuccessMessage(payload.offerLabel || `Trial activated for ${trialDays} day${trialDays === 1 ? '' : 's'}.`);
        await refreshProfile().catch(() => {});
        return;
      }

      if (payload.intentId) {
        setIntentId(payload.intentId);
        setSuccessMessage('Checkout started. Approve the payment prompt on your phone.');
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start checkout.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitAbortReason = async () => {
    if (!intentStatus?.id) {
      setAbortReasonMessage('Payment reference is missing.');
      return;
    }

    const selected = ABORT_REASON_OPTIONS.find((item) => item.key === selectedAbortReasonKey);
    if (!selected) {
      setAbortReasonMessage('Please select a reason before submitting.');
      return;
    }

    setAbortReasonMessage('');
    setIsSavingAbortReason(true);
    try {
      const submit = httpsCallable(firebaseFunctions, 'submitFailedOrderFeedback');
      await submit({
        orderId: intentStatus.id,
        status: intentStatus.status,
        question: ABORT_REASON_QUESTION,
        reasonKey: selected.key,
        reasonLabel: selected.label,
      });
      setAbortReasonSubmitted(true);
      setAbortReasonMessage('Thanks. Your feedback was submitted.');
      pushToast({ type: 'success', title: 'Follow-up submitted', message: 'We received your payment feedback.' });
      window.setTimeout(() => {
        setShowAbortReasonModal(false);
      }, 900);
    } catch (error) {
      setAbortReasonMessage(error instanceof Error ? error.message : 'Unable to submit feedback right now.');
    } finally {
      setIsSavingAbortReason(false);
    }
  };

  const checkoutSteps = [
    { key: 'plan', label: 'Pick plan', complete: Boolean(selectedPlan), active: !intentId },
    { key: 'start', label: 'Start checkout', complete: Boolean(intentId), active: Boolean(selectedPlan) && !intentId },
    { key: 'pay', label: 'Confirm payment', complete: intentStatus?.status === 'paid', active: Boolean(intentId) && intentStatus?.status !== 'paid' },
  ];

  return (
    <AppShell
      pageTitle="Premium Membership"
      pageDescription="Fast checkout and clear status tracking for upgrades"
      navItems={memberNavigation.map((item) => (item.to === '/upgrade' ? { ...item, badge: 'New' } : item))}
      profile={profile}
      onSignOut={signOut}
      theme={theme}
      onToggleTheme={toggleTheme}
      searchValue=""
      onSearchChange={null}
      topbarActions={(
        <Button variant="secondary" size="sm" to="/signals">
          <AppIcon name="signal" size={14} />
          Go to Signals
        </Button>
      )}
    >
      <Breadcrumbs
        items={[
          { label: 'Workspace', to: '/' },
          { label: 'Upgrade' },
        ]}
      />

      <Card title="Checkout Progress" subtitle="Transparent status at every step">
        <Stepper steps={checkoutSteps} />
      </Card>

      <section className="surface-split">
        <Card title="1. Choose a Plan" subtitle="Only active plans can be selected" hover>
          <div className="plan-grid">
            {plans.map((plan) => {
              const selected = plan.id === selectedPlanId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  className={`plan-card ${selected ? 'selected' : ''}`.trim()}
                  aria-pressed={selected}
                  aria-current={selected ? 'true' : undefined}
                  disabled={!plan.isActive}
                  onClick={() => {
                    if (plan.isActive) {
                      setSelectedPlanId(plan.id);
                    }
                  }}
                >
                  <div className="plan-card-head">
                    <p className="plan-card-title">{plan.title}</p>
                    {selected ? (
                      <span className="plan-card-selected-badge">
                        <AppIcon name="check" size={13} />
                        Selected
                      </span>
                    ) : null}
                  </div>
                  <p className="plan-card-subtitle">{plan.subtitle}</p>
                  <p className="plan-card-price">{formatPrice(plan.price, plan.currency)}</p>
                  <p className="plan-card-period">{labelForBillingPeriod(plan.billingPeriod)} • {plan.durationLabel}</p>
                  {selected ? <p className="plan-card-selection-copy">This plan will be used for checkout.</p> : null}
                  {!plan.isActive ? <span className="status-badge">Unavailable</span> : null}
                </button>
              );
            })}
          </div>
        </Card>

        <Card title="2. Start Checkout" subtitle="Provider and phone number are required" hover>
          <form className="ui-stack" onSubmit={handleStartCheckout}>
            <Select
              id="provider"
              label="Mobile money provider"
              value={provider}
              options={PROVIDERS}
              onChange={(event) => setProvider(event.target.value)}
            />

            <Input
              id="phone"
              label="Phone number"
              type="tel"
              inputMode="numeric"
              placeholder="0XXXXXXXXX"
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value.replace(/[^\d]/g, '').slice(0, 10))}
            />

            <Button type="submit" variant="primary" disabled={isSubmitting || activePlans.length === 0}>
              <AppIcon name="upgrade" size={15} />
              {isSubmitting ? 'Starting checkout...' : 'Start Premium Checkout'}
            </Button>
          </form>

          {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          {successMessage ? <p className="status-badge success">{successMessage}</p> : null}
        </Card>
      </section>

      {intentStatus ? (
        <Card title="Payment Intent Status" subtitle="Live updates from payment intents">
          <div className="intent-status-grid">
            <article className="intent-status-item">
              <p className="intent-status-label">Status</p>
              <p className={`intent-status-value status-badge ${intentStatus.status}`}>{intentStatus.status.toUpperCase()}</p>
            </article>
            <article className="intent-status-item">
              <p className="intent-status-label">Intent ID</p>
              <p className="intent-status-value">{intentStatus.id}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(intentStatus.id);
                    pushToast({ type: 'success', title: 'Copied', message: 'Intent ID copied to clipboard.' });
                  } catch {
                    pushToast({ type: 'error', title: 'Copy failed', message: 'Clipboard was not available.' });
                  }
                }}
              >
                <AppIcon name="copy" size={14} />
                Copy ID
              </Button>
            </article>
            <article className="intent-status-item">
              <p className="intent-status-label">Provider</p>
              <p className="intent-status-value">{intentStatus.provider}</p>
            </article>
            <article className="intent-status-item">
              <p className="intent-status-label">Phone</p>
              <p className="intent-status-value">{maskPhone(intentStatus.msisdn)}</p>
            </article>
            <article className="intent-status-item">
              <p className="intent-status-label">Created</p>
              <p className="intent-status-value">{formatDateTime(intentStatus.createdAt)}</p>
            </article>
            <article className="intent-status-item">
              <p className="intent-status-label">Expires</p>
              <p className="intent-status-value">{formatDateTime(intentStatus.expiresAt)}</p>
            </article>
          </div>

          {intentStatus.message ? <p className="ui-card-subtitle">Message: {intentStatus.message}</p> : null}

          {intentStatus.status === 'paid' ? (
            <div className="quick-actions">
              <Button to="/signals" variant="primary">
                <AppIcon name="signal" size={14} />
                Payment confirmed. Open signals
              </Button>
            </div>
          ) : null}

          {intentFailed && !abortReasonSubmitted && !showAbortReasonModal ? (
            <div className="quick-actions">
              <Button variant="secondary" onClick={() => setShowAbortReasonModal(true)}>
                Open follow-up form
              </Button>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Modal
        open={showAbortReasonModal && intentFailed}
        title="Help us improve"
        onClose={() => {
          if (!isSavingAbortReason) {
            setShowAbortReasonModal(false);
          }
        }}
        footer={(
          <>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowAbortReasonModal(false)}
              disabled={isSavingAbortReason}
            >
              Not now
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmitAbortReason}
              disabled={isSavingAbortReason || abortReasonSubmitted}
            >
              {isSavingAbortReason ? 'Submitting...' : abortReasonSubmitted ? 'Submitted' : 'Submit reason'}
            </Button>
          </>
        )}
      >
        <p className="ui-card-subtitle">{ABORT_REASON_QUESTION}</p>
        <div className="followup-options">
          {ABORT_REASON_OPTIONS.map((option) => {
            const selected = selectedAbortReasonKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                className={`followup-option ${selected ? 'selected' : ''}`.trim()}
                onClick={() => setSelectedAbortReasonKey(option.key)}
                disabled={isSavingAbortReason || abortReasonSubmitted}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {abortReasonMessage ? (
          <p className={abortReasonSubmitted ? 'status-badge success' : 'error-text'}>{abortReasonMessage}</p>
        ) : null}
      </Modal>
    </AppShell>
  );
};

function formatPrice(value, currency) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: currency || 'TZS',
    maximumFractionDigits: 0,
  }).format(amount);
}

function labelForBillingPeriod(billingPeriod) {
  const value = String(billingPeriod || '').toLowerCase();
  if (value === 'daily') {
    return 'per day';
  }
  if (value === 'weekly') {
    return 'per week';
  }
  return 'per month';
}

function maskPhone(value) {
  const text = String(value || '');
  if (text.length <= 4) {
    return text || '--';
  }
  return `${'*'.repeat(text.length - 4)}${text.slice(-4)}`;
}

function isFailedIntentStatus(status) {
  const normalized = String(status || '').toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('fail')
    || normalized.includes('cancel')
    || normalized.includes('expire')
    || normalized.includes('declin')
    || normalized.includes('reject')
    || normalized.includes('abort')
    || normalized.includes('timeout')
  );
}

export default PremiumUpgradePage;
