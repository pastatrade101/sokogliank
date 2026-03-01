const SESSION_DEFINITIONS = [
  { key: 'asia', name: 'Asia', openHour: 3, openMinute: 0, closeHour: 12, closeMinute: 0 },
  { key: 'london', name: 'London', openHour: 11, openMinute: 0, closeHour: 20, closeMinute: 0 },
  { key: 'new_york', name: 'New York', openHour: 16, openMinute: 0, closeHour: 1, closeMinute: 0 },
];

export function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function formatCountdown(durationMs) {
  const safe = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildSessionWindow(baseDate, definition) {
  const opensAt = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    definition.openHour,
    definition.openMinute,
    0,
    0,
  );
  const closesAt = new Date(
    baseDate.getFullYear(),
    baseDate.getMonth(),
    baseDate.getDate(),
    definition.closeHour,
    definition.closeMinute,
    0,
    0,
  );

  if (closesAt <= opensAt) {
    closesAt.setDate(closesAt.getDate() + 1);
  }

  return { opensAt, closesAt };
}

export function buildSessions(now = new Date()) {
  const weekend = isWeekend(now);
  const base = startOfDay(now);
  if (weekend) {
    const offset = now.getDay() === 6 ? 2 : 1;
    base.setDate(base.getDate() + offset);
  }

  return SESSION_DEFINITIONS.map((definition) => {
    const { opensAt, closesAt } = buildSessionWindow(base, definition);
    let status = 'closed';
    let opensIn = opensAt.getTime() - now.getTime();
    let closesIn = 0;
    let nextOpen = opensAt;

    if (weekend) {
      status = 'closed';
    } else if (now < opensAt) {
      status = 'upcoming';
      opensIn = opensAt.getTime() - now.getTime();
    } else if (now < closesAt) {
      status = 'open';
      closesIn = closesAt.getTime() - now.getTime();
    } else {
      nextOpen = new Date(opensAt);
      nextOpen.setDate(nextOpen.getDate() + 1);
      opensIn = nextOpen.getTime() - now.getTime();
      status = 'closed';
    }

    return {
      ...definition,
      opensAt,
      closesAt,
      nextOpen,
      status,
      opensIn,
      closesIn,
    };
  });
}

export function nextOverlap(now = new Date()) {
  if (isWeekend(now)) {
    return null;
  }

  const windows = [];

  SESSION_DEFINITIONS.forEach((definition) => {
    for (let offset = 0; offset <= 1; offset += 1) {
      const base = startOfDay(now);
      base.setDate(base.getDate() + offset);
      const { opensAt, closesAt } = buildSessionWindow(base, definition);
      windows.push({
        key: definition.key,
        name: definition.name,
        start: opensAt,
        end: closesAt,
      });
    }
  });

  let best = null;

  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      const a = windows[i];
      const b = windows[j];
      const start = a.start > b.start ? a.start : b.start;
      const end = a.end < b.end ? a.end : b.end;

      if (end <= start) continue;

      const overlapStart = start > now ? start : now;
      if (end <= overlapStart) continue;

      if (!best || start < best.start) {
        best = { a, b, start, end };
      }
    }
  }

  if (!best) {
    return null;
  }

  const isLive = now > best.start && now < best.end;
  return {
    title: 'Next Overlap',
    subtitle: `${best.a.name} & ${best.b.name}`,
    countdownLabel: isLive
      ? `Ends in ${formatCountdown(best.end.getTime() - now.getTime())}`
      : `Starts in ${formatCountdown(best.start.getTime() - now.getTime())}`,
  };
}

export function formatSessionTime(date) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}
