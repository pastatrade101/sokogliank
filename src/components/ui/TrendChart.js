import { useState } from 'react';

const SVG_WIDTH = 720;
const SVG_HEIGHT = 220;
const PAD_X = 24;
const PAD_TOP = 12;
const PAD_BOTTOM = 26;

const TrendChart = ({ points = [], tone = 'primary', ariaLabel = 'Trend chart' }) => {
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const safePoints = Array.isArray(points) ? points : [];
  const values = safePoints.map((point) => Number(point?.value ?? 0));
  const maxValue = Math.max(1, ...values);
  const minValue = 0;
  const innerWidth = SVG_WIDTH - PAD_X * 2;
  const innerHeight = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = safePoints.length > 1 ? innerWidth / (safePoints.length - 1) : 0;

  const coords = safePoints.map((point, index) => {
    const value = Number(point?.value ?? 0);
    const normalized = maxValue === minValue ? 0 : (value - minValue) / (maxValue - minValue);
    return {
      ...point,
      value,
      x: PAD_X + stepX * index,
      y: PAD_TOP + innerHeight - normalized * innerHeight,
    };
  });

  const linePath = coords.reduce((path, point, index) => {
    const command = `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    return `${path}${path ? ' ' : ''}${command}`;
  }, '');

  const areaPath = coords.length
    ? `${linePath} L ${coords[coords.length - 1].x} ${SVG_HEIGHT - PAD_BOTTOM} L ${coords[0].x} ${SVG_HEIGHT - PAD_BOTTOM} Z`
    : '';

  const tickCount = Math.max(2, Math.min(5, safePoints.length));
  const tickStep = safePoints.length > 1 ? Math.ceil((safePoints.length - 1) / (tickCount - 1)) : 1;
  const axisLabels = safePoints.map((point, index) => {
    const show = index === 0 || index === safePoints.length - 1 || index % tickStep === 0;
    return show ? point.label : '';
  });
  const activePoint = hoveredIndex >= 0 ? coords[hoveredIndex] : null;
  const hitAreaWidth = safePoints.length > 1 ? Math.max(18, stepX) : innerWidth;
  const axisColumns = Math.max(1, safePoints.length);
  const tooltipLeft = activePoint ? Math.max(4, Math.min(96, (activePoint.x / SVG_WIDTH) * 100)) : 0;
  const tooltipTop = activePoint ? Math.max(8, ((activePoint.y - 8) / SVG_HEIGHT) * 100) : 0;

  return (
    <div className={`ui-trend-chart tone-${tone}`.trim()} role="img" aria-label={ariaLabel}>
      <svg className="ui-trend-svg" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = PAD_TOP + innerHeight * ratio;
          return <line key={ratio} x1={PAD_X} y1={y} x2={SVG_WIDTH - PAD_X} y2={y} className="ui-trend-grid-line" />;
        })}
        {areaPath ? <path d={areaPath} className="ui-trend-area" /> : null}
        {linePath ? <path d={linePath} className="ui-trend-path" /> : null}
        {activePoint ? (
          <line
            x1={activePoint.x}
            y1={PAD_TOP}
            x2={activePoint.x}
            y2={SVG_HEIGHT - PAD_BOTTOM}
            className="ui-trend-crosshair"
          />
        ) : null}
        {coords.map((point, index) => (
          <g key={point.key || `${point.label}-${point.x}`}>
            <rect
              x={Math.max(PAD_X, point.x - hitAreaWidth / 2)}
              y={PAD_TOP}
              width={index === 0 || index === coords.length - 1 ? Math.max(hitAreaWidth / 2, 12) : hitAreaWidth}
              height={innerHeight}
              className="ui-trend-hit"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(-1)}
            />
            <circle
              cx={point.x}
              cy={point.y}
              r={activePoint?.key === point.key ? '4.6' : '3'}
              className={`ui-trend-point ${activePoint?.key === point.key ? 'is-active' : ''}`.trim()}
            />
          </g>
        ))}
      </svg>

      {activePoint ? (
        <div
          className="ui-trend-tooltip"
          style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
          aria-live="polite"
        >
          <p>{activePoint.label}</p>
          <strong>{activePoint.value}</strong>
        </div>
      ) : null}

      <div className="ui-trend-axis" style={{ gridTemplateColumns: `repeat(${axisColumns}, minmax(0, 1fr))` }}>
        {axisLabels.map((label, index) => (
          <span key={`${label}-${index}`} className="ui-trend-axis-label">
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default TrendChart;
