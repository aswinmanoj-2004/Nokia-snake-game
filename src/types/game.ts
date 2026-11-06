export type GameStatus = 'TITLE' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

export type DifficultyMode = 'classic' | 'chaos' | 'overdrive';

export type CameraPreset = 'diorama' | 'chase';

export type FoodKind = 'berry' | 'amber_crystal' | 'hyper_orb';

export type ObstacleKind = 'bumper' | 'slider' | 'gravity' | 'portal';

export type DailyObjectiveMetric =
  | 'bumpers_bounced'
  | 'portals_warped'
  | 'foods_eaten'
  | 'snake_length'
  | 'combo_streak'
  | 'obstacles_cleared'
  | 'amber_crystals';

export interface DailyObjectiveSnapshot {
  dateKey: string;
  metric: DailyObjectiveMetric;
  shortTitle: string;
  description: string;
  progress: number;
  target: number;
  bonusPoints: number;
  completedThisRun: boolean;
  completedToday: boolean;
}

export interface HudSnapshot {
  status: GameStatus;
  score: number;
  highScore: number;
  length: number;
  combo: number;
  comboProgress: number; // 0..1 remaining combo window
  shields: number;
  maxShields: number;
  obstaclesCleared: number;
  difficulty: DifficultyMode;
  cameraPreset: CameraPreset;
  muted: boolean;
  deathReason: string;
  isNewBest: boolean;
  boostEnergy: number; // 0..1
  magnetTimer: number; // seconds remaining
  dailyObjective: DailyObjectiveSnapshot;
}

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  score: number;
  snakeLength: number;
  obstaclesCleared: number;
  difficulty: DifficultyMode;
  createdAtMs: number;
  isCloud: boolean;
  uid?: string;
}

export interface UserProfileSummary {
  uid: string;
  displayName: string;
  email: string;
  bestScore: number;
  bestLength: number;
  runsPlayed: number;
}

export interface AuthNotice {
  message: string;
  isError: boolean;
  suggestNewTab: boolean;
}
