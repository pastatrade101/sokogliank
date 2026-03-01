import { useEffect, useState } from 'react';
import { ResponsiveLine } from '@nivo/line';

const TONE_FALLBACKS = {
  primary: '#1c386c',
  success: '#0f8a5f',
  accent: '#f2c45a',
  warning: '#d0a235',
  error: '#d95c5c',
  neutral: '#98a2b3',
};

const DEFAULT_MULTI_SERIES_TONES = ['primary', 'accent', 'success', 'warning', 'error'];

const TrendChart = ({
  points = [],
  series = null,
  tone = 'primary',
  ariaLabel = 'Trend chart',
  tooltipValueFormatter,
}) => {
  const compact = useCompactChartMode();
  const cssVars = readChartCssVars();
  const chartSeries = normalizeSeries({ points, series, tone });
  const paletteMap = Object.fromEntries(
    chartSeries.map((entry, index) => {
      const seriesTone = entry.tone || DEFAULT_MULTI_SERIES_TONES[index % DEFAULT_MULTI_SERIES_TONES.length];
      return [entry.id, buildTonePalette(seriesTone, cssVars)];
    }),
  );
  const data = chartSeries.map((entry) => ({
    id: entry.id,
    data: entry.data.map((point, index) => ({
      x: point?.x ?? point?.label ?? `Point ${index + 1}`,
      y: Number(point?.y ?? point?.value ?? 0),
      key: point?.key || `${entry.id}-${point?.x ?? point?.label ?? index}`,
    })),
  }));
  const singleSeries = data.length <= 1;
  const singlePalette = paletteMap[data[0]?.id] || buildTonePalette(tone, cssVars);
  const gradientId = `trend-area-${slugify(ariaLabel)}`;

  return (
    <div className={`ui-trend-chart tone-${tone}`.trim()} role="img" aria-label={ariaLabel}>
      <ResponsiveLine
        data={data}
        margin={{ top: 18, right: 20, bottom: compact ? 70 : 46, left: 44 }}
        xScale={{ type: 'point' }}
        yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false, reverse: false }}
        curve={singleSeries ? 'monotoneX' : 'catmullRom'}
        enableGridX={false}
        enableGridY
        gridYValues={4}
        colors={({ id }) => paletteMap[id]?.stroke || singlePalette.stroke}
        lineWidth={singleSeries ? 3.5 : 2.8}
        enableArea={singleSeries}
        areaBaselineValue={0}
        areaOpacity={1}
        areaBlendMode="normal"
        enablePoints
        pointSize={singleSeries ? 8 : 6}
        pointColor={({ serieId }) => paletteMap[serieId]?.point || singlePalette.point}
        pointBorderWidth={singleSeries ? 3 : 2}
        pointBorderColor={cssVars.surface}
        enablePointLabel={false}
        useMesh
        enableSlices="x"
        motionConfig="gentle"
        axisTop={null}
        axisRight={null}
        axisLeft={{
          tickSize: 0,
          tickPadding: 10,
          tickValues: 4,
          truncateTickAt: 0,
        }}
        axisBottom={{
          tickSize: 0,
          tickPadding: compact ? 8 : 12,
          tickRotation: compact ? -32 : 0,
          truncateTickAt: 0,
        }}
        theme={{
          background: 'transparent',
          text: {
            fontSize: 11,
            fill: cssVars.textMuted,
          },
          axis: {
            domain: {
              line: {
                stroke: 'transparent',
                strokeWidth: 0,
              },
            },
            ticks: {
              line: {
                stroke: 'transparent',
                strokeWidth: 0,
              },
              text: {
                fill: cssVars.textMuted,
                fontSize: 11,
              },
            },
            legend: {
              text: {
                fill: cssVars.textMuted,
              },
            },
          },
          grid: {
            line: {
              stroke: cssVars.grid,
              strokeWidth: 1,
              strokeDasharray: '4 6',
            },
          },
          crosshair: {
            line: {
              stroke: singlePalette.crosshair,
              strokeWidth: 1.4,
              strokeDasharray: '4 4',
            },
          },
          tooltip: {
            container: {
              background: cssVars.surfaceRaised,
              color: cssVars.text,
              border: `1px solid ${singlePalette.tooltipBorder}`,
              borderRadius: 10,
              boxShadow: cssVars.shadow,
              padding: '8px 10px',
            },
          },
          labels: {
            text: {
              fill: cssVars.text,
            },
          },
        }}
        defs={singleSeries ? [
          {
            id: gradientId,
            type: 'linearGradient',
            colors: [
              { offset: 0, color: singlePalette.fill, opacity: 0.9 },
              { offset: 100, color: singlePalette.fill, opacity: 0.08 },
            ],
          },
        ] : []}
        fill={singleSeries ? [{ match: '*', id: gradientId }] : []}
        sliceTooltip={({ slice }) => {
          const label = slice.points?.[0]?.data?.xFormatted || slice.points?.[0]?.data?.x || '';
          const items = [...(slice.points || [])].sort((a, b) => {
            const indexA = data.findIndex((entry) => entry.id === a.serieId);
            const indexB = data.findIndex((entry) => entry.id === b.serieId);
            return indexA - indexB;
          });

          return (
            <div className="ui-trend-tooltip ui-trend-tooltip-stack">
              <p>{label}</p>
              {items.map((point) => {
                const palette = paletteMap[point.serieId] || singlePalette;
                const rawValue = point?.data?.yFormatted || point?.data?.y || 0;
                const value = typeof tooltipValueFormatter === 'function'
                  ? tooltipValueFormatter(rawValue, point.serieId)
                  : formatTrendValue(rawValue);
                return (
                  <div key={`${point.serieId}-${point.id}`} className="ui-trend-tooltip-row">
                    <span className="ui-trend-tooltip-series" style={{ color: palette.stroke }}>
                      {point.serieId}
                    </span>
                    <strong>{value}</strong>
                  </div>
                );
              })}
            </div>
          );
        }}
        pointLabelYOffset={-12}
      />
    </div>
  );
};

export default TrendChart;

function normalizeSeries({ points, series, tone }) {
  if (Array.isArray(series) && series.length > 0) {
    return series.map((entry, index) => ({
      id: entry?.id || `Series ${index + 1}`,
      tone: entry?.tone || DEFAULT_MULTI_SERIES_TONES[index % DEFAULT_MULTI_SERIES_TONES.length] || tone,
      data: Array.isArray(entry?.data) ? entry.data : [],
    }));
  }

  return [
    {
      id: ariaLabelFromTone(tone),
      tone,
      data: Array.isArray(points) ? points : [],
    },
  ];
}

function useCompactChartMode() {
  const [compact, setCompact] = useState(() => (
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 760px)').matches : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const media = window.matchMedia('(max-width: 760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return compact;
}

function slugify(value) {
  return String(value || 'chart')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chart';
}

function ariaLabelFromTone(tone) {
  const key = String(tone || 'primary').toLowerCase();
  if (key === 'success') {
    return 'Success';
  }
  if (key === 'accent') {
    return 'Accent';
  }
  return 'Primary';
}

function buildTonePalette(tone, cssVars) {
  const key = String(tone || 'primary').toLowerCase();
  const base = cssVars[key] || TONE_FALLBACKS[key] || cssVars.primary || TONE_FALLBACKS.primary;
  return {
    stroke: colorWithAlpha(base, key === 'accent' ? 0.96 : 0.9),
    fill: colorWithAlpha(base, key === 'accent' ? 0.32 : 0.26),
    point: colorWithAlpha(base, 0.96),
    crosshair: colorWithAlpha(base, 0.58),
    tooltipBorder: colorWithAlpha(base, 0.28),
  };
}

function readChartCssVars() {
  if (typeof window === 'undefined') {
    return FALLBACK_VARS;
  }
  const styles = window.getComputedStyle(document.documentElement);
  const getVar = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  return {
    text: getVar('--color-text', FALLBACK_VARS.text),
    textMuted: getVar('--color-text-muted', FALLBACK_VARS.textMuted),
    surface: getVar('--color-surface', FALLBACK_VARS.surface),
    surfaceRaised: toColorMix(getVar('--color-surface', FALLBACK_VARS.surface), getVar('--color-surface-muted', FALLBACK_VARS.surfaceRaised)),
    grid: colorWithAlpha(getVar('--color-border', FALLBACK_VARS.gridBase), 0.7),
    shadow: '0 2px 12px rgba(13, 21, 38, 0.12)',
    primary: getVar('--color-primary', TONE_FALLBACKS.primary),
    success: getVar('--color-success', TONE_FALLBACKS.success),
    accent: getVar('--color-accent', TONE_FALLBACKS.accent),
    warning: getVar('--color-warning', TONE_FALLBACKS.warning),
    error: getVar('--color-error', TONE_FALLBACKS.error),
    neutral: getVar('--color-text-muted', TONE_FALLBACKS.neutral),
  };
}

function colorWithAlpha(color, alpha) {
  const value = String(color || '').trim();
  if (!value) {
    return `rgba(0, 0, 0, ${alpha})`;
  }
  if (value.startsWith('rgba(') || value.startsWith('hsla(')) {
    return value;
  }
  if (value.startsWith('rgb(')) {
    const parts = value.replace(/[^\d,\s]/g, '').split(',').map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  if (value.startsWith('#')) {
    const normalized = value.length === 4
      ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
      : value;
    const hex = normalized.slice(1);
    if (hex.length === 6) {
      const red = parseInt(hex.slice(0, 2), 16);
      const green = parseInt(hex.slice(2, 4), 16);
      const blue = parseInt(hex.slice(4, 6), 16);
      return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }
  }
  return value;
}

function toColorMix(primary, fallback) {
  return primary || fallback;
}

function formatTrendValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? '--');
  }
  if (Math.abs(numeric) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(numeric);
  }
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 2,
  }).format(numeric);
}

const FALLBACK_VARS = {
  text: '#101828',
  textMuted: '#667085',
  surface: '#ffffff',
  surfaceRaised: '#f8fafc',
  gridBase: '#d0d5dd',
};
