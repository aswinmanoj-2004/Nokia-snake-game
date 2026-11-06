import type { DifficultyMode, LeaderboardEntry } from '../types/game';

const LOCAL_SCORES_KEY = 'serpent3310_local_leaderboard_v1';
const LOCAL_TAG_KEY = 'serpent3310_player_tag_v1';
const MAX_LOCAL_ENTRIES = 25;

export function getSavedPlayerTag(): string {
  try {
    const raw = localStorage.getItem(LOCAL_TAG_KEY);
    if (raw && raw.trim().length > 0) {
      return raw.trim().slice(0, 16);
    }
  } catch {
    // Ignore storage restrictions
  }
  return 'NOKIA_01';
}

export function savePlayerTag(tag: string): string {
  const cleaned = tag.trim().replace(/\s+/g, ' ').slice(0, 16) || 'NOKIA_01';
  try {
    localStorage.setItem(LOCAL_TAG_KEY, cleaned);
  } catch {
    // Ignore
  }
  return cleaned;
}

export function getLocalLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_SCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is LeaderboardEntry =>
          typeof item === 'object' &&
          item !== null &&
          typeof item.id === 'string' &&
          typeof item.playerName === 'string' &&
          typeof item.score === 'number'
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LOCAL_ENTRIES);
  } catch {
    return [];
  }
}

export function saveLocalScore(params: {
  playerName: string;
  score: number;
  snakeLength: number;
  obstaclesCleared: number;
  difficulty: DifficultyMode;
}): LeaderboardEntry[] {
  const existing = getLocalLeaderboard();
  const entry: LeaderboardEntry = {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    playerName: savePlayerTag(params.playerName),
    score: Math.max(0, Math.round(params.score)),
    snakeLength: Math.max(3, Math.round(params.snakeLength)),
    obstaclesCleared: Math.max(0, Math.round(params.obstaclesCleared)),
    difficulty: params.difficulty,
    createdAtMs: Date.now(),
    isCloud: false,
  };

  const next = [...existing, entry]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_LOCAL_ENTRIES);

  try {
    localStorage.setItem(LOCAL_SCORES_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function getLocalBestScore(): number {
  const entries = getLocalLeaderboard();
  return entries.length > 0 ? entries[0].score : 0;
}
