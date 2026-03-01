import { useEffect, useState } from 'react';
import { ResponsiveBar } from '@nivo/bar';

const TONE_FALLBACKS = {
  primary: '#1c386c',
  success: '#0f8a5f',
  accent: '#f2c45a',
  warning: '#d0a235',
  error: '#d95c5c',
  neutral: '#98a2b3',
};

const BarChart = ({
  data = [],
  keys = [],
  indexBy = 'label',
  ariaLabel = 'Bar chart',
  layout = 'vertical',
  groupMode = 'grouped',
  maxValue = 'auto',
  valueSuffix = '',
  labelSkipWidth = 18,
  labelSkipHeight = 12,
  axisBottom = undefined,
  axisLeft = undefined,
  padding = 0.26,
  indexScale = { type: 'band', round: true },
  colorByKey = {},
  tooltipValueFormatter,
}) => {
  const compact = useCompactChartMode();
  const chartData = Array.isArray(data) ? data : [];
  const safeKeys = Array.isArray(keys) ? keys : [];
  const cssVars = readChartCssVars();
  const verticalLayout = layout !== 'horizontal';

  return (
    <div className="ui-bar-chart" role="img" aria-label={ariaLabel}>
      <ResponsiveBar
        data={chartData}
        keys={safeKeys}
        indexBy={indexBy}
        layout={layout}
        groupMode={groupMode}
        margin={{ top: 18, right: 20, bottom: verticalLayout && compact ? 78 : layout === 'horizontal' ? 24 : 48, left: layout === 'horizontal' ? 98 : 52 }}
        padding={padding}
        innerPadding={6}
        valueScale={{ type: 'linear', max: maxValue }}
        indexScale={indexScale}
        colors={({ id }) => resolveToneColor(colorByKey[id] || 'primary', cssVars)}
        borderRadius={10}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.32]] }}
        enableGridX={layout === 'horizontal'}
        enableGridY={layout !== 'horizontal'}
        gridYValues={maxValue === 100 ? [0, 20, 40, 60, 80, 100] : 5}
        axisTop={null}
        axisRight={null}
        axisBottom={axisBottom ?? {
          tickSize: 0,
          tickPadding: verticalLayout && compact ? 8 : 12,
          tickRotation: verticalLayout && compact ? -32 : 0,
          truncateTickAt: 0,
        }}
        axisLeft={axisLeft ?? {
          tickSize: 0,
          tickPadding: 10,
          tickValues: maxValue === 100 ? 5 : 5,
          truncateTickAt: 0,
        }}
        enableLabel={false}
        labelSkipWidth={labelSkipWidth}
        labelSkipHeight={labelSkipHeight}
        role="application"
        ariaLabel={ariaLabel}
        animate
        motionConfig="gentle"
        enableTotals={groupMode === 'stacked' && layout !== 'horizontal'}
        totalsOffset={10}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.25]] }}
        tooltip={({ id, value, indexValue, color }) => {
          const formattedValue = typeof tooltipValueFormatter === 'function'
            ? tooltipValueFormatter(value, id)
            : formatBarValue(value, valueSuffix);
          return (
            <div className="ui-trend-tooltip ui-bar-tooltip">
              <p>{String(indexValue || '')}</p>
              <strong style={{ color }}>{String(id)}</strong>
              <span>{formattedValue}</span>
            </div>
          );
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
          tooltip: {
            container: {
              background: cssVars.surfaceRaised,
              color: cssVars.text,
              border: `1px solid ${cssVars.tooltipBorder}`,
              borderRadius: 10,
              boxShadow: cssVars.shadow,
              padding: '8px 10px',
            },
          },
        }}
      />
    </div>
  );
};

export default BarChart;

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

function readChartCssVars() {
  if (typeof window === 'undefined') {
    return {
      text: '#101828',
      textMuted: '#667085',
      grid: 'rgba(152, 162, 179, 0.38)',
      surfaceRaised: '#ffffff',
      tooltipBorder: 'rgba(28, 56, 108, 0.24)',
      shadow: '0 2px 12px rgba(13, 21, 38, 0.12)',
    };
  }
  const styles = window.getComputedStyle(document.documentElement);
  const getVar = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;

  return {
    text: getVar('--color-text', '#101828'),
    textMuted: getVar('--color-text-muted', '#667085'),
    grid: colorWithAlpha(getVar('--color-border', '#d0d5dd'), 0.7),
    surfaceRaised: getVar('--color-surface', '#ffffff'),
    tooltipBorder: colorWithAlpha(getVar('--color-primary', '#1c386c'), 0.24),
    shadow: '0 2px 12px rgba(13, 21, 38, 0.12)',
    primary: getVar('--color-primary', TONE_FALLBACKS.primary),
    success: getVar('--color-success', TONE_FALLBACKS.success),
    accent: getVar('--color-accent', TONE_FALLBACKS.accent),
    warning: getVar('--color-warning', TONE_FALLBACKS.warning),
    error: getVar('--color-error', TONE_FALLBACKS.error),
    neutral: getVar('--color-text-muted', TONE_FALLBACKS.neutral),
  };
}

function resolveToneColor(tone, cssVars) {
  const key = String(tone || 'primary').toLowerCase();
  return cssVars[key] || TONE_FALLBACKS[key] || cssVars.primary || TONE_FALLBACKS.primary;
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

function formatBarValue(value, suffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? '--');
  }
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: numeric % 1 === 0 ? 0 : 1,
  }).format(numeric);
  return `${formatted}${suffix}`;
}
