import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Camera,
  ChevronDown,
  ChevronUp,
  Gamepad2,
  LogIn,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  AuthNotice,
  CameraPreset,
  DifficultyMode,
  HudSnapshot,
} from '../types/game';

interface GameOverlaysProps {
  hud: HudSnapshot;
  user: User | null;
  authBusy: boolean;
  authNotice: AuthNotice | null;
  onDismissAuthNotice: () => void;
  dockCollapsed: boolean;
  onToggleDock: () => void;
  onStartGame: (difficulty: DifficultyMode) => void;
  onSelectDifficulty: (difficulty: DifficultyMode) => void;
  onTogglePause: () => void;
  onReturnToTitle: () => void;
  onToggleCamera: () => void;
  onSetCamera: (preset: CameraPreset) => void;
  onToggleMute: () => void;
  onOpenLeaderboard: () => void;
  onSignIn: () => Promise<void>;
  playerTag: string;
  onChangePlayerTag: (tag: string) => void;
  cloudSubmitState: 'idle' | 'submitting' | 'submitted' | 'error';
  cloudSubmitError: string | null;
  onSubmitCloudRun: () => Promise<void>;
  onVirtualInput: (x: number, y: number, boost: boolean) => void;
}

const DIFFICULTIES: Array<{
  id: DifficultyMode;
  label: string;
  summary: string;
}> = [
  {
    id: 'classic',
    label: 'Classic',
    summary: '3 Shields · Balanced Speed & Obstacles',
  },
  {
    id: 'chaos',
    label: 'Physics Chaos',
    summary: '2 Shields · Dual Portals & Gravity Wells',
  },
  {
    id: 'overdrive',
    label: 'Overdrive',
    summary: '1 Shield · High Velocity & 1.5x Score',
  },
];

export const GameOverlays: React.FC<GameOverlaysProps> = ({
  hud,
  user,
  authBusy,
  authNotice,
  onDismissAuthNotice,
  dockCollapsed,
  onToggleDock,
  onStartGame,
  onSelectDifficulty,
  onTogglePause,
  onReturnToTitle,
  onSetCamera,
  onToggleMute,
  onOpenLeaderboard,
  onSignIn,
  playerTag,
  onChangePlayerTag,
  cloudSubmitState,
  cloudSubmitError,
  onSubmitCloudRun,
  onVirtualInput,
}) => {
  const [touchPadVisible, setTouchPadVisible] = useState(false);

  const activeDiffInfo =
    DIFFICULTIES.find((d) => d.id === hud.difficulty) || DIFFICULTIES[0];

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between">
      {/* =====================================================================
          1. TITLE SCREEN OVERLAY
         ===================================================================== */}
      {hud.status === 'TITLE' && (
        <div className="flex-1 flex flex-col justify-between p-6 md:p-10">
          {/* Top Bar: Minimal Brand & Account / Leaderboard Action */}
          <div className="flex items-center justify-between gap-4">
            <div className="pointer-events-auto flex items-center gap-3 px-4 py-2.5 bg-[#0E1511]/90 border border-[#9BBC0F]/25 rounded-lg">
              {/* Bespoke geometric Nokia-inspired pixel-serpent emblem */}
              <svg
                width="26"
                height="26"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                <rect x="2" y="16" width="6" height="6" rx="1" fill="#4D7C0F" />
                <rect x="9" y="16" width="6" height="6" rx="1" fill="#65A30D" />
                <rect x="9" y="9" width="6" height="6" rx="1" fill="#84CC16" />
                <rect x="16" y="9" width="8" height="6" rx="1.5" fill="#9BBC0F" />
                <rect x="21" y="10.5" width="2" height="2" rx="0.5" fill="#EF4444" />
                <rect x="24" y="11.5" width="3" height="1" fill="#F59E0B" />
              </svg>
              <span className="font-display text-base font-bold tracking-wide text-[#ECF2E6] whitespace-nowrap">
                SERPENT 3310
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-3">
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#ECF2E6] bg-[#0E1511]/90 hover:bg-[#17231C] border border-[#9BBC0F]/25 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-[#9BBC0F]" aria-hidden="true" />
                <span>Leaderboard</span>
                {hud.highScore > 0 && (
                  <span className="font-mono-tabular text-[#9BBC0F]">
                    · {hud.highScore.toLocaleString()}
                  </span>
                )}
              </button>

              {!user ? (
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void onSignIn()}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#ECF2E6] bg-[#0E1511]/90 hover:bg-[#17231C] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#9BBC0F]" aria-hidden="true" />
                  <span>{authBusy ? 'Signing In...' : 'Google Sign-In'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenLeaderboard}
                  className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#9BBC0F] bg-[#0E1511]/90 hover:bg-[#17231C] border border-[#9BBC0F]/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span className="truncate max-w-[140px]">
                    {user.displayName || 'Signed In'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Auth Status Notice Banner (if sign-in cancelled or blocked) */}
          {authNotice && (
            <div className="pointer-events-auto max-w-lg mt-3 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#0E1511]/95 border border-[#9BBC0F]/30 rounded-lg text-xs text-[#ECF2E6]">
              <div className="flex flex-wrap items-center gap-2">
                <span className={authNotice.isError ? 'text-[#FCA5A5]' : 'text-[#98A894]'}>
                  {authNotice.message}
                </span>
                {authNotice.suggestNewTab && typeof window !== 'undefined' && (
                  <a
                    href={window.location.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-[#9BBC0F] hover:underline whitespace-nowrap"
                  >
                    Open in New Tab
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={onDismissAuthNotice}
                className="px-2 py-1 text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] whitespace-nowrap shrink-0 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Center-Left Title Lockup staged over negative space */}
          <div className="my-auto max-w-lg pointer-events-auto bg-[#0E1511]/90 border border-[#9BBC0F]/25 rounded-xl p-6 md:p-8 shadow-2xl">
            <h1
              className="font-display font-bold tracking-tight text-[#ECF2E6] leading-[1.05]"
              style={{
                fontSize: 'clamp(2.25rem, 4.2vw, 3.5rem)',
                textWrap: 'balance',
              }}
            >
              Tactile 3D Nokia Serpent
            </h1>

            <p className="mt-3 text-sm md:text-base text-[#98A894] leading-relaxed">
              Steer an articulated titanium-jade serpent across a backlit LCD arena with continuous
              momentum physics, kinetic spring bumpers, sliding barriers, gravity wells, and wrap
              portals.
            </p>

            {/* Segmented Difficulty Selector */}
            <div className="mt-6">
              <div
                role="radiogroup"
                aria-label="Arena physics difficulty"
                className="grid grid-cols-3 gap-1.5 p-1 bg-[#152019] border border-white/10 rounded-lg"
              >
                {DIFFICULTIES.map((diff) => {
                  const selected = hud.difficulty === diff.id;
                  return (
                    <button
                      key={diff.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onSelectDifficulty(diff.id)}
                      className={`px-3 py-2 min-h-[40px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                        selected
                          ? 'bg-[#9BBC0F] text-[#0F1F12]'
                          : 'text-[#98A894] hover:text-[#ECF2E6]'
                      }`}
                    >
                      {diff.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-[#98A894]">{activeDiffInfo.summary}</p>
            </div>

            {/* Daily Randomized Challenge Preview */}
            <div className="mt-5 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-[#98A894]">
                  Daily Challenge
                  {hud.dailyObjective.completedToday ? ' · Completed Today' : ''}
                </span>
                <span className="font-mono-tabular font-bold text-[#F59E0B]">
                  +{hud.dailyObjective.bonusPoints} pts
                </span>
              </div>
              <p className="mt-1 text-xs md:text-sm text-[#ECF2E6]">
                {hud.dailyObjective.description}
              </p>
            </div>

            {/* Primary CTA Row */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onStartGame(hud.difficulty)}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] text-sm font-bold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Start Game</span>
              </button>

              <button
                type="button"
                onClick={onToggleMute}
                aria-label={hud.muted ? 'Unmute audio' : 'Mute audio'}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[44px] text-xs font-semibold text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {hud.muted ? (
                  <VolumeX className="w-4 h-4 text-[#98A894]" aria-hidden="true" />
                ) : (
                  <Volume2 className="w-4 h-4 text-[#9BBC0F]" aria-hidden="true" />
                )}
                <span>{hud.muted ? 'Muted' : 'Sound On'}</span>
              </button>
            </div>
          </div>

          {/* Single Flat Control Hint Line */}
          <div className="flex justify-center">
            <div className="px-4 py-2 bg-[#0E1511]/88 border border-white/10 rounded-lg text-xs text-[#98A894] text-center">
              WASD / Arrows Steer · Space Boost · C Switch Camera · H Hide Controls · Esc Pause
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          2. ACTIVE PLAYING HUD & COLLAPSIBLE BOTTOM CONTROL DOCK
         ===================================================================== */}
      {hud.status === 'PLAYING' && (
        <>
          {/* Top Perimeter Telemetry Bar (< 12% viewport footprint) */}
          <div className="flex items-start justify-between gap-4 p-4 md:p-5">
            {/* Top-Left Score, Length, Combo, Shield & Daily Objective Cluster */}
            <div className="bg-[#0E1511]/90 border border-[#9BBC0F]/25 rounded-xl px-4 py-3 w-[252px]">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs font-semibold text-[#98A894]">Score</span>
                {hud.combo > 1 && (
                  <span className="font-mono-tabular text-xs font-bold text-[#F59E0B]">
                    Combo x{hud.combo}
                  </span>
                )}
              </div>

              <div className="font-mono-tabular text-2xl md:text-3xl font-bold text-[#9BBC0F] leading-tight">
                {hud.score.toLocaleString()}
              </div>

              {hud.combo > 1 && (
                <div className="mt-1.5 h-1 w-full bg-[#1B2820] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] transition-transform duration-75 origin-left"
                    style={{ transform: `scaleX(${hud.comboProgress})` }}
                  />
                </div>
              )}

              <div className="mt-2 flex items-center gap-2 text-xs text-[#ECF2E6] font-mono-tabular">
                <span>Length {hud.length}</span>
                <span className="text-[#98A894]" aria-hidden="true">
                  ·
                </span>
                <span className="text-[#98A894]">Obstacles {hud.obstaclesCleared}</span>
              </div>

              {/* Non-hue-only Shield Integrity Indicator */}
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-xs text-[#98A894]">
                  Shield {hud.shields}/{hud.maxShields}
                </span>
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: hud.maxShields }).map((_, idx) => {
                    const active = idx < hud.shields;
                    return (
                      <span
                        key={idx}
                        className={`h-2.5 w-5 rounded-sm border ${
                          active
                            ? 'bg-[#9BBC0F] border-[#9BBC0F]'
                            : 'bg-[#162019] border-white/15'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Live Daily Objective Progress */}
              <div className="mt-2.5 pt-2.5 border-t border-white/10">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#98A894]">Daily Goal</span>
                  <span
                    className={`font-mono-tabular font-bold ${
                      hud.dailyObjective.completedThisRun
                        ? 'text-[#9BBC0F]'
                        : 'text-[#F59E0B]'
                    }`}
                  >
                    {hud.dailyObjective.completedThisRun
                      ? `Bonus +${hud.dailyObjective.bonusPoints}`
                      : `+${hud.dailyObjective.bonusPoints} pts`}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-[#ECF2E6] truncate">
                    {hud.dailyObjective.shortTitle}
                  </span>
                  <span className="font-mono-tabular font-semibold text-[#ECF2E6] shrink-0">
                    {hud.dailyObjective.progress}/{hud.dailyObjective.target}
                  </span>
                </div>
                <div className="mt-1.5 h-1 w-full bg-[#1B2820] rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-transform duration-150 origin-left ${
                      hud.dailyObjective.completedThisRun
                        ? 'bg-[#9BBC0F]'
                        : 'bg-[#F59E0B]'
                    }`}
                    style={{
                      transform: `scaleX(${Math.min(
                        1,
                        hud.dailyObjective.progress /
                          Math.max(1, hud.dailyObjective.target)
                      )})`,
                    }}
                  />
                </div>
              </div>

              {hud.magnetTimer > 0 && (
                <div className="mt-2 text-xs font-mono-tabular font-semibold text-[#38BDF8]">
                  Magnet Active · {Math.ceil(hud.magnetTimer)}s
                </div>
              )}
            </div>

            {/* Top-Right High Score & Quick Actions */}
            <div className="pointer-events-auto flex items-center gap-2.5">
              <div className="hidden sm:flex flex-col items-end px-4 py-2 bg-[#0E1511]/90 border border-[#9BBC0F]/25 rounded-xl">
                <span className="text-xs text-[#98A894]">Best</span>
                <span className="font-mono-tabular text-base font-bold text-[#ECF2E6]">
                  {hud.highScore.toLocaleString()}
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#ECF2E6] bg-[#0E1511]/90 hover:bg-[#17231C] border border-[#9BBC0F]/25 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="w-4 h-4 text-[#9BBC0F]" aria-hidden="true" />
                <span>Ranks</span>
              </button>

              <button
                type="button"
                onClick={onTogglePause}
                aria-label="Pause game"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#ECF2E6] bg-[#0E1511]/90 hover:bg-[#17231C] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pause className="w-4 h-4" aria-hidden="true" />
                <span>Pause</span>
              </button>
            </div>
          </div>

          {/* Optional On-Screen Touch / Mouse Directional Pad */}
          {touchPadVisible && (
            <div className="pointer-events-auto fixed bottom-24 right-5 z-20 flex flex-col items-center gap-1.5 p-2.5 bg-[#0E1511]/92 border border-[#9BBC0F]/30 rounded-xl">
              <button
                type="button"
                aria-label="Steer North"
                onPointerDown={() => onVirtualInput(0, -1, false)}
                onPointerUp={() => onVirtualInput(0, 0, false)}
                onPointerLeave={() => onVirtualInput(0, 0, false)}
                className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#18261E] active:bg-[#9BBC0F] active:text-[#0F1F12] text-[#ECF2E6] font-bold text-sm cursor-pointer"
              >
                ▲
              </button>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label="Steer West"
                  onPointerDown={() => onVirtualInput(-1, 0, false)}
                  onPointerUp={() => onVirtualInput(0, 0, false)}
                  onPointerLeave={() => onVirtualInput(0, 0, false)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#18261E] active:bg-[#9BBC0F] active:text-[#0F1F12] text-[#ECF2E6] font-bold text-sm cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  aria-label="Boost Speed"
                  onPointerDown={() => onVirtualInput(0, 0, true)}
                  onPointerUp={() => onVirtualInput(0, 0, false)}
                  onPointerLeave={() => onVirtualInput(0, 0, false)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#F59E0B] text-[#0F1F12] font-bold text-xs cursor-pointer"
                >
                  BST
                </button>
                <button
                  type="button"
                  aria-label="Steer East"
                  onPointerDown={() => onVirtualInput(1, 0, false)}
                  onPointerUp={() => onVirtualInput(0, 0, false)}
                  onPointerLeave={() => onVirtualInput(0, 0, false)}
                  className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#18261E] active:bg-[#9BBC0F] active:text-[#0F1F12] text-[#ECF2E6] font-bold text-sm cursor-pointer"
                >
                  ▶
                </button>
              </div>
              <button
                type="button"
                aria-label="Steer South"
                onPointerDown={() => onVirtualInput(0, 1, false)}
                onPointerUp={() => onVirtualInput(0, 0, false)}
                onPointerLeave={() => onVirtualInput(0, 0, false)}
                className="w-11 h-11 flex items-center justify-center rounded-lg bg-[#18261E] active:bg-[#9BBC0F] active:text-[#0F1F12] text-[#ECF2E6] font-bold text-sm cursor-pointer"
              >
                ▼
              </button>
            </div>
          )}

          {/* Collapsible Bottom Control Dock */}
          <div className="flex flex-col items-center pb-4 px-3">
            <div
              className="pointer-events-auto flex flex-col items-center transition-transform duration-200 ease-out"
              style={{
                transform: dockCollapsed ? 'translateY(calc(100% - 34px))' : 'translateY(0)',
              }}
            >
              {/* Collapse / Expand Handle */}
              <button
                type="button"
                onClick={onToggleDock}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] bg-[#0E1511]/95 border border-b-0 border-[#9BBC0F]/25 rounded-t-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                {dockCollapsed ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-[#9BBC0F]" aria-hidden="true" />
                    <span>Show Controls (H)</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-[#9BBC0F]" aria-hidden="true" />
                    <span>Hide Controls (H)</span>
                  </>
                )}
              </button>

              {/* Unified Horizontal Dock */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 px-3.5 py-2.5 bg-[#0E1511]/95 border border-[#9BBC0F]/25 rounded-xl shadow-xl max-w-[min(860px,95vw)]">
                {/* Camera Preset Segmented Switch */}
                <div
                  role="group"
                  aria-label="Camera perspective"
                  className="inline-flex items-center gap-1 p-1 bg-[#16221B] border border-white/10 rounded-lg"
                >
                  <button
                    type="button"
                    onClick={() => onSetCamera('diorama')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      hud.cameraPreset === 'diorama'
                        ? 'bg-[#9BBC0F] text-[#0F1F12]'
                        : 'text-[#98A894] hover:text-[#ECF2E6]'
                    }`}
                  >
                    <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Angled Diorama</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCamera('chase')}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[34px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      hud.cameraPreset === 'chase'
                        ? 'bg-[#9BBC0F] text-[#0F1F12]'
                        : 'text-[#98A894] hover:text-[#ECF2E6]'
                    }`}
                  >
                    <span>Chase Cam (C)</span>
                  </button>
                </div>

                {/* Boost Reserve Meter */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#16221B] border border-white/10 rounded-lg">
                  <span className="text-xs font-semibold text-[#98A894] whitespace-nowrap">
                    Boost
                  </span>
                  <div className="w-16 h-2 bg-[#0B110D] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F59E0B] transition-transform duration-75 origin-left"
                      style={{ transform: `scaleX(${hud.boostEnergy})` }}
                    />
                  </div>
                </div>

                {/* Touch D-Pad Toggle */}
                <button
                  type="button"
                  onClick={() => setTouchPadVisible((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    touchPadVisible
                      ? 'bg-[#9BBC0F]/20 text-[#9BBC0F] border-[#9BBC0F]/50'
                      : 'bg-[#16221B] text-[#98A894] hover:text-[#ECF2E6] border-white/10'
                  }`}
                >
                  <Gamepad2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Pad</span>
                </button>

                {/* Audio Mute Toggle */}
                <button
                  type="button"
                  onClick={onToggleMute}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[38px] text-xs font-semibold text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {hud.muted ? (
                    <VolumeX className="w-3.5 h-3.5 text-[#98A894]" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-[#9BBC0F]" aria-hidden="true" />
                  )}
                  <span>{hud.muted ? 'Muted' : 'Audio'}</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =====================================================================
          3. PAUSE MODAL
         ===================================================================== */}
      {hud.status === 'PAUSED' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090E0B]/75 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pause-heading"
        >
          <div className="w-full max-w-md bg-[#0F1712] border border-[#9BBC0F]/30 rounded-xl p-6 shadow-2xl">
            <h2
              id="pause-heading"
              className="font-display text-2xl font-bold text-[#ECF2E6]"
            >
              Simulation Paused
            </h2>
            <p className="mt-1 text-xs text-[#98A894] font-mono-tabular">
              Score {hud.score.toLocaleString()} · Length {hud.length} · Obstacles{' '}
              {hud.obstaclesCleared}
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={onTogglePause}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] text-sm font-bold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Resume Game</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onSetCamera(hud.cameraPreset === 'diorama' ? 'chase' : 'diorama')
                }
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/15 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <Camera className="w-4 h-4 text-[#9BBC0F]" aria-hidden="true" />
                <span>
                  Camera:{' '}
                  {hud.cameraPreset === 'diorama' ? 'Angled Diorama' : 'Chase Cam'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onStartGame(hud.difficulty)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[42px] text-xs font-semibold text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/15 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Restart Run</span>
              </button>

              <button
                type="button"
                onClick={onReturnToTitle}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 min-h-[42px] text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] bg-transparent hover:bg-white/5 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Return to Title Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. GAME OVER & LEADERBOARD SUBMISSION MODAL
         ===================================================================== */}
      {hud.status === 'GAME_OVER' && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center p-4 bg-[#090E0B]/80 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gameover-heading"
        >
          <div className="w-full max-w-lg bg-[#0F1712] border border-[#9BBC0F]/30 rounded-xl p-6 md:p-7 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="gameover-heading"
                  className="font-display text-2xl md:text-3xl font-bold text-[#ECF2E6]"
                >
                  Run Complete
                </h2>
                <p className="mt-1 text-xs text-[#98A894]">
                  {hud.deathReason || 'Arena collision'}
                  {hud.isNewBest ? ' · New Personal Record' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenLeaderboard}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-[#9BBC0F] bg-[#16221B] hover:bg-[#1E2E24] border border-[#9BBC0F]/30 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trophy className="w-4 h-4" aria-hidden="true" />
                <span>Rankings</span>
              </button>
            </div>

            {/* 3-Column Tabular Run Telemetry */}
            <div className="mt-5 grid grid-cols-3 gap-3 p-4 bg-[#141F18] border border-white/10 rounded-lg">
              <div>
                <div className="text-xs text-[#98A894]">Final Score</div>
                <div className="mt-1 font-mono-tabular text-xl md:text-2xl font-bold text-[#9BBC0F]">
                  {hud.score.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#98A894]">Snake Length</div>
                <div className="mt-1 font-mono-tabular text-xl md:text-2xl font-bold text-[#ECF2E6]">
                  {hud.length}
                </div>
              </div>
              <div>
                <div className="text-xs text-[#98A894]">Obstacles</div>
                <div className="mt-1 font-mono-tabular text-xl md:text-2xl font-bold text-[#F59E0B]">
                  {hud.obstaclesCleared}
                </div>
              </div>
            </div>

            {/* Daily Objective Run Status */}
            <div className="mt-4 flex items-center justify-between gap-3 text-xs">
              <span className="text-[#98A894] truncate">
                Daily Challenge · {hud.dailyObjective.shortTitle}
              </span>
              <span
                className={`font-mono-tabular font-semibold shrink-0 ${
                  hud.dailyObjective.completedThisRun
                    ? 'text-[#9BBC0F]'
                    : 'text-[#ECF2E6]'
                }`}
              >
                {hud.dailyObjective.completedThisRun
                  ? `Completed (+${hud.dailyObjective.bonusPoints} pts)`
                  : `${hud.dailyObjective.progress}/${hud.dailyObjective.target}`}
              </span>
            </div>

            {/* Player Tag & Cloud Leaderboard Publish */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <label
                htmlFor="arcade-tag-input"
                className="block text-xs font-semibold text-[#ECF2E6]"
              >
                Arcade Callsign
              </label>
              <div className="mt-2 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <input
                  id="arcade-tag-input"
                  type="text"
                  maxLength={16}
                  value={playerTag}
                  onChange={(e) => onChangePlayerTag(e.target.value)}
                  placeholder="NOKIA_01"
                  className="flex-1 min-w-[140px] px-3.5 py-2 min-h-[40px] text-sm font-mono-tabular text-[#ECF2E6] bg-[#152019] border border-white/15 focus:border-[#9BBC0F] focus:outline-none rounded-lg"
                />

                {user ? (
                  <button
                    type="button"
                    disabled={
                      cloudSubmitState === 'submitting' ||
                      cloudSubmitState === 'submitted'
                    }
                    onClick={() => void onSubmitCloudRun()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-xs font-bold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>
                      {cloudSubmitState === 'submitting'
                        ? 'Publishing...'
                        : cloudSubmitState === 'submitted'
                        ? 'Published to Cloud'
                        : 'Publish Cloud Score'}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void onSignIn()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[40px] text-xs font-bold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{authBusy ? 'Signing In...' : 'Sign in to Publish'}</span>
                  </button>
                )}
              </div>

              <p className="mt-2 text-xs text-[#98A894]">
                Saved automatically to Local Arcade
                {user
                  ? ` · Signed in as ${user.displayName || 'Google Player'}`
                  : ' · Sign in with Google to post globally'}
              </p>

              {!user && authNotice && (
                <div className="mt-2.5 flex items-center justify-between gap-2 px-3 py-2 bg-[#141F18] border border-white/10 rounded-lg text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={authNotice.isError ? 'text-[#FCA5A5]' : 'text-[#98A894]'}>
                      {authNotice.message}
                    </span>
                    {authNotice.suggestNewTab && typeof window !== 'undefined' && (
                      <a
                        href={window.location.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#9BBC0F] hover:underline whitespace-nowrap"
                      >
                        Open in New Tab
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onDismissAuthNotice}
                    className="text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {cloudSubmitError && (
                <p className="mt-2 text-xs text-[#FCA5A5]">{cloudSubmitError}</p>
              )}
            </div>

            {/* Bottom Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onReturnToTitle}
                className="px-4 py-2.5 min-h-[42px] text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/10 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Title Screen
              </button>

              <button
                type="button"
                onClick={() => onStartGame(hud.difficulty)}
                className="inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] text-sm font-bold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Play Again</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
