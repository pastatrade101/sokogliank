export const TIP_TYPES = [
  'Market Insight',
  'Psychology',
  'Risk Management',
  'Common Mistake',
  'Session Tip',
];

export const SESSION_TABS = [
  { key: 'asia', label: 'Asia' },
  { key: 'london', label: 'London' },
  { key: 'newyork', label: 'New York' },
  { key: 'weekend', label: 'Weekend' },
];

export function timestampToDate(value) {
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

export function formatDateTime(value) {
  const date = value instanceof Date ? value : timestampToDate(value);
  if (!date) {
    return 'Unknown';
  }
  return date.toLocaleString();
}

export function formatDate(value) {
  const date = value instanceof Date ? value : timestampToDate(value);
  if (!date) {
    return 'Unknown';
  }
  return date.toLocaleDateString();
}

export function normalizeSignal(id, data = {}) {
  const createdAt = data.createdAt ?? data.preview?.createdAt;
  const validFrom = data.validFrom ?? data.preview?.createdAt ?? createdAt;
  const validUntil = data.validUntil ?? data.preview?.validUntil;
  const createdAtDate = timestampToDate(createdAt);
  const validFromDate = timestampToDate(validFrom);
  const validUntilDate = timestampToDate(validUntil);
  const tipRaw = data.tip ?? data.tradeTip ?? data.preview?.tip ?? data.preview?.tradeTip ?? '';
  const tip = typeof tipRaw === 'string' ? tipRaw.trim() : '';
  const direction = (data.preview?.direction ?? data.direction ?? 'N/A').toString();
  const status = (data.status ?? 'open').toString();
  const imageUrl = resolveSignalImageUrl(data);

  return {
    id,
    summary: data.summary ?? data.reasoning ?? 'No summary provided.',
    tip,
    reasoning: data.reasoning ?? '',
    status,
    statusLabel: status.toUpperCase(),
    pair: data.preview?.pair ?? data.pair ?? 'Unknown',
    direction,
    directionLabel: direction.toUpperCase(),
    session: data.preview?.session ?? data.session ?? 'Any',
    entryType: data.entryType ?? (data.entryRange ? 'Range' : 'Market'),
    entryPrice: toNumberOrNull(data.entryPrice),
    entryRange: data.entryRange ? {
      min: toNumberOrNull(data.entryRange.min),
      max: toNumberOrNull(data.entryRange.max),
    } : null,
    stopLoss: toNumberOrNull(data.stopLoss),
    tp1: toNumberOrNull(data.tp1),
    tp2: toNumberOrNull(data.tp2),
    validFrom,
    validFromDate,
    validUntil,
    validUntilDate,
    createdAt,
    createdAtDate,
    posterName: data.posterNameSnapshot ?? data.posterName ?? 'Unknown',
    likesCount: Number(data.likesCount ?? 0),
    dislikesCount: Number(data.dislikesCount ?? 0),
    tags: Array.isArray(data.tags) ? data.tags : [],
    imageUrl,
    premiumOnly: toBoolean(data.premiumOnly ?? data.preview?.premiumOnly ?? data.isPremium ?? data.isPremiumOnly),
  };
}

export function isSignalLive(signal) {
  const status = String(signal?.status ?? '').trim().toLowerCase();
  if (['expired', 'closed', 'cancelled', 'canceled', 'completed', 'done'].includes(status)) {
    return false;
  }
  const validUntil = timestampToDate(signal?.validUntilDate ?? signal?.validUntil);
  if (!validUntil) {
    return true;
  }
  return validUntil.getTime() > Date.now();
}

export function hasSignalTip(signal) {
  return typeof signal?.tip === 'string' && signal.tip.trim().length > 0;
}

export function getSignalSessionBucket(signal) {
  const keywords = [
    signal.session,
    signal.summary,
    signal.reasoning,
    signal.status,
    ...(Array.isArray(signal.tags) ? signal.tags : []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/[_-]/g, ' ');

  if (keywords.includes('weekend') || keywords.includes('outlook')) {
    return 'weekend';
  }
  if (keywords.includes('new york') || keywords.includes('newyork') || keywords.includes('us session')) {
    return 'newyork';
  }
  if (keywords.includes('london') || keywords.includes('europe')) {
    return 'london';
  }
  if (keywords.includes('asia') || keywords.includes('tokyo') || keywords.includes('sydney')) {
    return 'asia';
  }
  return 'asia';
}

export function normalizeTip(id, data = {}) {
  const resolvedType = normalizeType(data.type) || mapLegacyCategory(data.category) || TIP_TYPES[0];
  const content = resolveTipContent(data);
  const action = resolveTipAction(data);
  const authorAvatarUrl = resolveAuthorAvatar(data);

  return {
    id,
    title: data.title ?? '',
    type: resolvedType,
    content,
    action,
    tags: Array.isArray(data.tags ?? data.markets ?? data.tagsOrMarkets)
      ? (data.tags ?? data.markets ?? data.tagsOrMarkets).map((entry) => String(entry))
      : [],
    isFeatured: data.isFeatured === true,
    createdBy: String(data.createdBy ?? ''),
    authorName: data.authorName ?? '',
    authorAvatarUrl,
    createdAtDate: timestampToDate(data.createdAt),
  };
}

export function isCurrentDay(date, timeZone = 'Africa/Dar_es_Salaam') {
  if (!(date instanceof Date)) {
    return false;
  }
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date) === formatter.format(new Date());
}

function normalizeType(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return TIP_TYPES.includes(trimmed) ? trimmed : null;
}

function mapLegacyCategory(category) {
  if (typeof category !== 'string' || !category) {
    return null;
  }
  if (category === 'Risk Management') {
    return 'Risk Management';
  }
  if (category === 'Psychology' || category === 'Pro Mindset') {
    return 'Psychology';
  }
  if (category === 'Common Mistakes') {
    return 'Common Mistake';
  }
  if (category === 'Session Behavior') {
    return 'Session Tip';
  }
  return 'Market Insight';
}

function resolveTipContent(data = {}) {
  if (typeof data.content === 'string' && data.content.trim()) {
    return data.content.trim();
  }
  const keyInsight = typeof data.keyInsight === 'string' ? data.keyInsight.trim() : '';
  const explanation = typeof data.explanation === 'string' ? data.explanation.trim() : '';
  if (keyInsight && explanation) {
    return `${keyInsight}\n\n${explanation}`;
  }
  return keyInsight || explanation || '';
}

function resolveTipAction(data = {}) {
  if (typeof data.action === 'string' && data.action.trim()) {
    return data.action.trim();
  }
  if (Array.isArray(data.actionable) && data.actionable.length > 0) {
    return String(data.actionable[0] ?? '').trim();
  }
  return '';
}

function toNumberOrNull(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function resolveSignalImageUrl(data = {}) {
  const candidates = [
    data.imageUrl,
    data.chartImageUrl,
    data.signalImageUrl,
    data.screenshotUrl,
    data.preview?.imageUrl,
    data.preview?.chartImageUrl,
  ];

  for (const candidate of candidates) {
    const url = String(candidate ?? '').trim();
    if (url) {
      return url;
    }
  }

  return '';
}

function resolveAuthorAvatar(data = {}) {
  const candidates = [
    data.authorAvatarUrl,
    data.authorAvatar,
    data.authorPhotoUrl,
    data.authorPhotoURL,
    data.avatarUrl,
    data.photoUrl,
    data.photoURL,
  ];

  for (const candidate of candidates) {
    const url = String(candidate ?? '').trim();
    if (url) {
      return url;
    }
  }

  return '';
}

function toBoolean(value) {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}
