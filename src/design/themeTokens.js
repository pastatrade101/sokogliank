const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
};

const typography = {
  family: "'IBM Plex Sans', 'Segoe UI', sans-serif",
  size: {
    xs: '12px',
    sm: '14px',
    md: '16px',
    lg: '18px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '40px',
  },
  lineHeight: {
    compact: 1.2,
    normal: 1.5,
    relaxed: 1.7,
  },
  weight: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
};

const radii = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  full: '9999px',
};

const shadows = {
  sm: '0 2px 12px rgba(13, 21, 38, 0.08)',
  md: '0 10px 24px rgba(10, 18, 34, 0.12)',
  lg: '0 18px 44px rgba(8, 15, 30, 0.16)',
};

const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  xxl: 1440,
};

const motion = {
  fast: '120ms',
  normal: '180ms',
  slow: '280ms',
  easing: 'cubic-bezier(0.2, 0.6, 0, 1)',
};

const themes = {
  light: {
    accent: '#b98a1e',
    primary: '#1c386c',
    secondary: '#7a8699',
    success: '#178a58',
    warning: '#b7791f',
    error: '#c53030',
    page: '#f4f7fb',
    surface: '#ffffff',
    surfaceMuted: '#edf2f8',
    text: '#101828',
    textMuted: '#475467',
    border: '#d0dae8',
    overlay: 'rgba(8, 13, 24, 0.45)',
    focus: 'rgba(28, 56, 108, 0.35)',
    shadowTint: 'rgba(16, 24, 40, 0.12)',
  },
  dark: {
    accent: '#f2c45a',
    primary: '#1c386c',
    secondary: '#8b9ab2',
    success: '#4bc68a',
    warning: '#f7b14b',
    error: '#ff7a84',
    page: '#0a0f1a',
    surface: '#121a29',
    surfaceMuted: '#1a2538',
    text: '#f2f6ff',
    textMuted: '#a8b6d0',
    border: '#2a3951',
    overlay: 'rgba(4, 8, 15, 0.72)',
    focus: 'rgba(242, 196, 90, 0.34)',
    shadowTint: 'rgba(2, 6, 15, 0.5)',
  },
};

export const designTokens = {
  spacing,
  typography,
  radii,
  shadows,
  breakpoints,
  motion,
  themes,
};

function buildCssVars(themeName) {
  const mode = themes[themeName] ? themeName : 'dark';
  const palette = themes[mode];

  return {
    '--font-sans': typography.family,
    '--space-0': spacing[0],
    '--space-1': spacing[1],
    '--space-2': spacing[2],
    '--space-3': spacing[3],
    '--space-4': spacing[4],
    '--space-5': spacing[5],
    '--space-6': spacing[6],
    '--space-8': spacing[8],
    '--space-10': spacing[10],
    '--space-12': spacing[12],
    '--space-16': spacing[16],
    '--radius-sm': radii.sm,
    '--radius-md': radii.md,
    '--radius-lg': radii.lg,
    '--radius-xl': radii.xl,
    '--radius-full': radii.full,
    '--shadow-sm': shadows.sm,
    '--shadow-md': shadows.md,
    '--shadow-lg': shadows.lg,
    '--motion-fast': motion.fast,
    '--motion-normal': motion.normal,
    '--motion-slow': motion.slow,
    '--motion-ease': motion.easing,
    '--color-accent': palette.accent,
    '--color-primary': palette.primary,
    '--color-secondary': palette.secondary,
    '--color-success': palette.success,
    '--color-warning': palette.warning,
    '--color-error': palette.error,
    '--color-page': palette.page,
    '--color-surface': palette.surface,
    '--color-surface-muted': palette.surfaceMuted,
    '--color-text': palette.text,
    '--color-text-muted': palette.textMuted,
    '--color-border': palette.border,
    '--color-overlay': palette.overlay,
    '--color-focus': palette.focus,
    '--color-shadow-tint': palette.shadowTint,
  };
}

export function applyThemeTokens(themeName) {
  if (typeof document === 'undefined') {
    return;
  }
  const vars = buildCssVars(themeName);
  Object.entries(vars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
}

export function getInitialThemeName() {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  const saved = window.localStorage.getItem('sokogliank-theme');
  if (saved === 'light' || saved === 'dark') {
    return saved;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
