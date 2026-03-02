import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from '../firebase/init';

export default function useSignalPremiumDetails(signalId, enabled) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));

  useEffect(() => {
    if (!enabled || !signalId) {
      setDetails(null);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    const unsubscribe = onSnapshot(
      doc(firestore, 'signals', signalId, 'premium_details', 'private'),
      (snapshot) => {
        setDetails(snapshot.exists() ? normalizePremiumDetails(snapshot.data() ?? {}) : null);
        setLoading(false);
      },
      () => {
        setDetails(null);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [enabled, signalId]);

  return { details, loading };
}

function normalizePremiumDetails(data = {}) {
  return {
    entryType: String(data.entryType ?? '').trim(),
    entryPrice: toNumberOrNull(data.entryPrice),
    entryRange: data.entryRange
      ? {
        min: toNumberOrNull(data.entryRange.min),
        max: toNumberOrNull(data.entryRange.max),
      }
      : null,
    stopLoss: toNumberOrNull(data.stopLoss),
    tp1: toNumberOrNull(data.tp1),
    tp2: toNumberOrNull(data.tp2),
    reason: String(data.reason ?? data.reasoning ?? '').trim(),
  };
}

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
