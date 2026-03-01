import { firebaseConfig } from '../config/firebaseConfig';

const REGION = 'us-central1';

function endpointForNews() {
  return `https://${REGION}-${firebaseConfig.projectId}.cloudfunctions.net/news`;
}

function candidateEndpoints() {
  const absolute = `${endpointForNews()}?source=fxstreet_analysis`;
  const local = '/news?source=fxstreet_analysis';

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return [local, absolute];
    }
  }

  return [absolute, local];
}

function sanitizeDescription(input) {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;?/gi, ' ')
    .replace(/&amp;?/gi, '&')
    .replace(/&quot;?/gi, '"')
    .replace(/&#39;?/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeItems(payload, limit) {
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const seen = new Set();

  return items
    .map((item) => ({
      id: String(item.id || `${item.link || ''}_${item.publishedAt || ''}`),
      title: String(item.title || '').trim(),
      description: sanitizeDescription(item.description),
      link: String(item.link || '').trim(),
      publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    }))
    .filter((item) => item.title && item.link)
    .filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    })
    .sort((a, b) => (b.publishedAt?.getTime() || 0) - (a.publishedAt?.getTime() || 0))
    .slice(0, limit);
}

export async function fetchAnalysisHighlights(limit = 4) {
  let lastError = null;

  for (const url of candidateEndpoints()) {
    try {
      const response = await fetch(url);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.message || `News request failed with status ${response.status}.`);
      }
      return normalizeItems(payload, limit);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Unable to load analysis highlights.');
}
