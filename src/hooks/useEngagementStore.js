import { useCallback, useEffect, useState } from 'react';

const RECENT_SIGNALS_KEY = 'sokogliank-recent-signals';
const PINNED_TIPS_KEY = 'sokogliank-pinned-tips';

function readList(key) {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(key, value) {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function useEngagementStore() {
  const [recentSignals, setRecentSignals] = useState(() => readList(RECENT_SIGNALS_KEY));
  const [pinnedTips, setPinnedTips] = useState(() => readList(PINNED_TIPS_KEY));

  useEffect(() => {
    writeList(RECENT_SIGNALS_KEY, recentSignals);
  }, [recentSignals]);

  useEffect(() => {
    writeList(PINNED_TIPS_KEY, pinnedTips);
  }, [pinnedTips]);

  const saveRecentSignal = useCallback((signal) => {
    setRecentSignals((current) => {
      const next = [signal, ...current.filter((entry) => entry.id !== signal.id)];
      return next.slice(0, 8);
    });
  }, []);

  const togglePinnedTip = useCallback((tip) => {
    setPinnedTips((current) => {
      if (current.some((entry) => entry.id === tip.id)) {
        return current.filter((entry) => entry.id !== tip.id);
      }
      return [tip, ...current].slice(0, 10);
    });
  }, []);

  return {
    recentSignals,
    pinnedTips,
    saveRecentSignal,
    togglePinnedTip,
  };
}
