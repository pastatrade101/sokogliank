import React from 'react';

const ICONS = {
  menu: [
    ['path', { d: 'M4 7h16' }],
    ['path', { d: 'M4 12h16' }],
    ['path', { d: 'M4 17h16' }],
  ],
  home: [
    ['path', { d: 'M4 10.5 12 4l8 6.5V20H4z' }],
  ],
  chart: [
    ['path', { d: 'M4 18h16' }],
    ['path', { d: 'M6 15l4-4 3 3 5-6' }],
    ['path', { d: 'M18 8h0' }],
  ],
  payments: [
    ['rect', { x: '3', y: '6', width: '18', height: '12', rx: '2' }],
    ['path', { d: 'M3 10h18' }],
    ['path', { d: 'M7 14h3' }],
  ],
  signal: [
    ['path', { d: 'M5 16h14' }],
    ['path', { d: 'M7 12a5 5 0 0 1 10 0' }],
    ['path', { d: 'M10 8a2 2 0 0 1 4 0' }],
  ],
  tips: [
    ['path', { d: 'M12 3a7 7 0 0 0-4.8 12.1c.9.9 1.3 1.7 1.4 2.9h6.8c.1-1.2.5-2 1.4-2.9A7 7 0 0 0 12 3z' }],
    ['path', { d: 'M9.5 21h5' }],
  ],
  upgrade: [
    ['path', { d: 'M12 3 15 9h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z' }],
  ],
  search: [
    ['circle', { cx: '11', cy: '11', r: '6.5' }],
    ['path', { d: 'm16 16 5 5' }],
  ],
  bell: [
    ['path', { d: 'M7 10a5 5 0 1 1 10 0v4l2 2H5l2-2z' }],
    ['path', { d: 'M10 18a2 2 0 0 0 4 0' }],
  ],
  settings: [
    ['circle', { cx: '12', cy: '12', r: '3.2' }],
    ['path', { d: 'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1' }],
  ],
  user: [
    ['circle', { cx: '12', cy: '8', r: '3.2' }],
    ['path', { d: 'M5 20a7 7 0 0 1 14 0' }],
  ],
  logout: [
    ['path', { d: 'M9 4H5v16h4' }],
    ['path', { d: 'M15 8l4 4-4 4' }],
    ['path', { d: 'M10 12h9' }],
  ],
  sun: [
    ['circle', { cx: '12', cy: '12', r: '4' }],
    ['path', { d: 'M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1' }],
  ],
  moon: [
    ['path', { d: 'M20 13a8 8 0 1 1-9-9 6.5 6.5 0 1 0 9 9z' }],
  ],
  chevronRight: [
    ['path', { d: 'm9 6 6 6-6 6' }],
  ],
  chevronLeft: [
    ['path', { d: 'm15 6-6 6 6 6' }],
  ],
  chevronDown: [
    ['path', { d: 'm6 9 6 6 6-6' }],
  ],
  pin: [
    ['path', { d: 'M9 3h6l-1 6 3 3-5 2-5-2 3-3z' }],
    ['path', { d: 'M12 14v7' }],
  ],
  star: [
    ['path', { d: 'M12 3 15 9h6l-5 4 2 7-6-4-6 4 2-7-5-4h6z' }],
  ],
  crown: [
    ['path', { d: 'M3 18h18l-1.3-9-4.7 3-3-5-3 5-4.7-3z' }],
    ['path', { d: 'M6 21h12' }],
  ],
  check: [
    ['path', { d: 'm5 12 4 4 10-10' }],
  ],
  alert: [
    ['path', { d: 'M12 3 2 21h20z' }],
    ['path', { d: 'M12 9v5' }],
    ['path', { d: 'M12 18h.01' }],
  ],
  filter: [
    ['path', { d: 'M4 6h16l-6 7v5l-4 2v-7z' }],
  ],
  refresh: [
    ['path', { d: 'M20 6v5h-5' }],
    ['path', { d: 'M4 18v-5h5' }],
    ['path', { d: 'M6 11a7 7 0 0 1 12-2' }],
    ['path', { d: 'M18 13a7 7 0 0 1-12 2' }],
  ],
  external: [
    ['path', { d: 'M14 4h6v6' }],
    ['path', { d: 'M20 4 11 13' }],
    ['path', { d: 'M5 7v12h12v-4' }],
  ],
  phone: [
    ['path', { d: 'M6 3h4l1 5-2 2a14 14 0 0 0 5 5l2-2 5 1v4a2 2 0 0 1-2 2C9.2 20 4 14.8 4 8a2 2 0 0 1 2-2z' }],
  ],
  message: [
    ['path', { d: 'M4 5h16v11H8l-4 4z' }],
  ],
  copy: [
    ['rect', { x: '9', y: '9', width: '11', height: '11', rx: '2' }],
    ['path', { d: 'M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1' }],
  ],
  close: [
    ['path', { d: 'M6 6 18 18' }],
    ['path', { d: 'M18 6 6 18' }],
  ],
  arrowUp: [
    ['path', { d: 'M12 19V5' }],
    ['path', { d: 'm5 12 7-7 7 7' }],
  ],
  arrowDown: [
    ['path', { d: 'M12 5v14' }],
    ['path', { d: 'm19 12-7 7-7-7' }],
  ],
  clock: [
    ['circle', { cx: '12', cy: '12', r: '9' }],
    ['path', { d: 'M12 7v5l3 2' }],
  ],
  sparkles: [
    ['path', { d: 'm12 2 2 5 5 2-5 2-2 5-2-5-5-2 5-2z' }],
    ['path', { d: 'm5 15 1 2 2 1-2 1-1 2-1-2-2-1 2-1z' }],
    ['path', { d: 'm19 14 1 2 2 1-2 1-1 2-1-2-2-1 2-1z' }],
  ],
};

const AppIcon = ({ name, size = 18, strokeWidth = 1.8, className = '' }) => {
  const icon = ICONS[name] || ICONS.alert;

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon.map(([tag, props], index) => React.createElement(tag, { ...props, key: `${name}-${index}` }))}
    </svg>
  );
};

export default AppIcon;
