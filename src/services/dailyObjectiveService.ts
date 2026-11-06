import type { DailyObjectiveMetric, DailyObjectiveSnapshot } from '../types/game';

interface ObjectiveTemplate {
  metric: DailyObjectiveMetric;
  shortPattern: string;
  descPattern: string;
  targets: [number, number, number];
  baseBonus: number;
}

const OBJECTIVE_TEMPLATES: ObjectiveTemplate[] = [
  {
    metric: 'bumpers_bounced',
    shortPattern: 'Bounce {target} kinetic bumpers',
    descPattern: 'Bounce off {target} kinetic bumpers in one run',
    targets: [4, 5, 6],
    baseBonus: 850,
  },
  {
    metric: 'portals_warped',
    shortPattern: 'Warp {target} quantum portals',
    descPattern: 'Warp through {target} quantum portals in one run',
    targets: [3, 4, 5],
    baseBonus: 900,
  },
  {
    metric: 'foods_eaten',
    shortPattern: 'Eat {target} arena foods',
    descPattern: 'Consume {target} collectibles in one run',
    targets: [10, 12, 15],
    baseBonus: 750,
  },
  {
    metric: 'snake_length',
    shortPattern: 'Reach serpent length {target}',
    descPattern: 'Grow your serpent to length {target} in one run',
    targets: [14, 16, 18],
    baseBonus: 950,
  },
  {
    metric: 'combo_streak',
    shortPattern: 'Reach a {target}x combo chain',
    descPattern: 'Build a {target}x combo multiplier in one run',
    targets: [4, 5, 6],
    baseBonus: 900,
  },
  {
    metric: 'obstacles_cleared',
    shortPattern: 'Clear {target} arena obstacles',
    descPattern: 'Deflect or warp through {target} obstacles in one run',
    targets: [6, 8, 10],
    baseBonus: 850,
  },
  {
    metric: 'amber_crystals',
    shortPattern: 'Collect {target} amber crystals',
    descPattern: 'Collect {target} bonus amber crystals in one run',
    targets: [2, 3, 4],
    baseBonus: 1000,
  },
];

const DAILY_STORAGE_KEY = 'serpent3310_daily_objective_v1';

export interface DailyObjectiveDefinition {
  dateKey: string;
  metric: DailyObjectiveMetric;
  shortTitle: string;
  description: string;
  target: number;
  bonusPoints: number;
}

export function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailyObjective(date = new Date()): DailyObjectiveDefinition {
  const dateKey = getLocalDateKey(date);
  const rand = mulberry32(hashSeed(`serpent3310_${dateKey}`));

  const templateIdx = Math.floor(rand() * OBJECTIVE_TEMPLATES.length);
  const template = OBJECTIVE_TEMPLATES[templateIdx];

  const targetIdx = Math.floor(rand() * template.targets.length);
  const target = template.targets[targetIdx];

  const scale = target / template.targets[1];
  const bonusPoints = Math.max(
    500,
    Math.round((template.baseBonus * scale) / 50) * 50
  );

  return {
    dateKey,
    metric: template.metric,
    shortTitle: template.shortPattern.replace('{target}', String(target)),
    description: template.descPattern.replace('{target}', String(target)),
    target,
    bonusPoints,
  };
}

export function isDailyObjectiveCompletedToday(dateKey: string): boolean {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { completedDates?: string[] };
    return (
      Array.isArray(parsed.completedDates) &&
      parsed.completedDates.includes(dateKey)
    );
  } catch {
    return false;
  }
}

export function markDailyObjectiveCompleted(dateKey: string): void {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    const parsed = raw
      ? (JSON.parse(raw) as { completedDates?: string[] })
      : {};
    const existing = Array.isArray(parsed.completedDates)
      ? parsed.completedDates.filter((d) => typeof d === 'string')
      : [];
    if (!existing.includes(dateKey)) {
      const updated = [dateKey, ...existing].slice(0, 30);
      localStorage.setItem(
        DAILY_STORAGE_KEY,
        JSON.stringify({ completedDates: updated })
      );
    }
  } catch {
    // Ignore storage quota or private mode restrictions
  }
}

export function createInitialDailyObjectiveSnapshot(): DailyObjectiveSnapshot {
  const def = getDailyObjective();
  return {
    dateKey: def.dateKey,
    metric: def.metric,
    shortTitle: def.shortTitle,
    description: def.description,
    progress: def.metric === 'snake_length' ? 6 : def.metric === 'combo_streak' ? 1 : 0,
    target: def.target,
    bonusPoints: def.bonusPoints,
    completedThisRun: false,
    completedToday: isDailyObjectiveCompletedToday(def.dateKey),
  };
}
