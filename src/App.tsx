import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { GameOverlays } from './components/GameOverlays';
import { LeaderboardModal } from './components/LeaderboardModal';
import {
  ensureUserProfile,
  signInWithGoogle,
  signOutUser,
  subscribeAuth,
  subscribeGlobalLeaderboard,
  submitCloudScore,
} from './firebase';
import {
  getLocalBestScore,
  getLocalLeaderboard,
  getSavedPlayerTag,
  saveLocalScore,
  savePlayerTag,
} from './services/leaderboardService';
import { SnakeSimulation } from './three/SnakeSimulation';
import type {
  CameraPreset,
  DifficultyMode,
  HudSnapshot,
  LeaderboardEntry,
  UserProfileSummary,
} from './types/game';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<SnakeSimulation | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(() => ({
    status: 'TITLE',
    score: 0,
    highScore: getLocalBestScore(),
    length: 6,
    combo: 1,
    comboProgress: 0,
    shields: 3,
    maxShields: 3,
    obstaclesCleared: 0,
    difficulty: 'classic',
    cameraPreset: 'diorama',
    muted: false,
    deathReason: '',
    isNewBest: false,
    boostEnergy: 1,
    magnetTimer: 0,
  }));

  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  // Local & Cloud Leaderboard State
  const [localEntries, setLocalEntries] = useState<LeaderboardEntry[]>(() =>
    getLocalLeaderboard()
  );
  const [cloudEntries, setCloudEntries] = useState<LeaderboardEntry[]>([]);
  const [cloudLoading, setCloudLoading] = useState(true);
  const [cloudError, setCloudError] = useState<string | null>(null);

  // Firebase Auth & Profile State
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileSummary | null>(null);
  const [playerTag, setPlayerTag] = useState<string>(() => getSavedPlayerTag());

  // Run Cloud Submission State
  const [cloudSubmitState, setCloudSubmitState] = useState<
    'idle' | 'submitting' | 'submitted' | 'error'
  >('idle');
  const [cloudSubmitError, setCloudSubmitError] = useState<string | null>(null);

  const latestRunRef = useRef<{
    score: number;
    length: number;
    obstaclesCleared: number;
    difficulty: DifficultyMode;
  } | null>(null);

  const userRef = useRef<User | null>(null);
  userRef.current = user;

  const playerTagRef = useRef<string>(playerTag);
  playerTagRef.current = playerTag;

  // Subscribe to Firebase Authentication
  useEffect(() => {
    const unsub = subscribeAuth((nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        if (nextUser.displayName) {
          const cleanTag = savePlayerTag(nextUser.displayName.slice(0, 16));
          setPlayerTag(cleanTag);
        }
        ensureUserProfile(nextUser)
          .then((profile) => {
            if (profile) {
              setUserProfile(profile);
              simRef.current?.setExternalHighScore(profile.bestScore);
            }
          })
          .catch(() => {
            // Handled by structured Firestore error logger
          });
      } else {
        setUserProfile(null);
      }
    });
    return unsub;
  }, []);

  // Subscribe to Real-Time Global Firestore Leaderboard
  useEffect(() => {
    setCloudLoading(true);
    const unsub = subscribeGlobalLeaderboard(
      (entries) => {
        setCloudEntries(entries);
        setCloudLoading(false);
        setCloudError(null);
        if (entries.length > 0) {
          simRef.current?.setExternalHighScore(entries[0].score);
        }
      },
      (errMessage) => {
        setCloudLoading(false);
        setCloudError(errMessage);
      }
    );
    return unsub;
  }, []);

  // Initialize Isolated 3D WebGL Canvas Simulation Once
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const sim = new SnakeSimulation({
      container,
      initialHighScore: getLocalBestScore(),
      onHudUpdate: (snapshot) => {
        setHud(snapshot);
      },
      onRunFinished: (summary) => {
        latestRunRef.current = summary;
        setCloudSubmitState('idle');
        setCloudSubmitError(null);

        // Save run immediately to Local Arcade Leaderboard
        const updatedLocal = saveLocalScore({
          playerName: playerTagRef.current,
          score: summary.score,
          snakeLength: summary.length,
          obstaclesCleared: summary.obstaclesCleared,
          difficulty: summary.difficulty,
        });
        setLocalEntries(updatedLocal);
      },
      onContextLostChange: (lost) => {
        setContextLost(lost);
      },
    });

    simRef.current = sim;

    return () => {
      sim.dispose();
      simRef.current = null;
    };
  }, []);

  // Global Keyboard Shortcuts for Dock Collapse (H) and Leaderboard (L)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      } else if (e.code === 'KeyL') {
        setLeaderboardOpen((prev) => !prev);
      } else if (e.code === 'Escape' && leaderboardOpen) {
        setLeaderboardOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [leaderboardOpen]);

  const handleChangePlayerTag = useCallback((nextTag: string) => {
    setPlayerTag(nextTag);
    savePlayerTag(nextTag);
  }, []);

  const handleSubmitCloudRun = useCallback(async () => {
    const activeUser = userRef.current;
    const run = latestRunRef.current;
    if (!activeUser || !run) return;

    setCloudSubmitState('submitting');
    setCloudSubmitError(null);
    try {
      await submitCloudScore({
        user: activeUser,
        playerName: playerTagRef.current || activeUser.displayName || 'SERPENT_ACE',
        score: run.score,
        snakeLength: run.length,
        obstaclesCleared: run.obstaclesCleared,
        difficulty: run.difficulty,
      });
      setCloudSubmitState('submitted');
      const refreshed = await ensureUserProfile(activeUser);
      if (refreshed) setUserProfile(refreshed);
    } catch {
      setCloudSubmitState('error');
      setCloudSubmitError('Could not publish score to cloud. Please try again.');
    }
  }, []);

  const handleSignIn = useCallback(async () => {
    const signedInUser = await signInWithGoogle();
    if (signedInUser.displayName) {
      const saved = savePlayerTag(signedInUser.displayName.slice(0, 16));
      setPlayerTag(saved);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#162019]">
      {/* Dedicated Isolated WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="3D Nokia Serpent Diorama Viewport"
      />

      {/* WebGL Context Lost Fallback Banner */}
      {contextLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#0E1511]/95">
          <div className="max-w-md text-center p-6 border border-[#9BBC0F]/30 rounded-xl bg-[#141F18]">
            <h2 className="font-display text-xl font-bold text-[#ECF2E6]">
              3D Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-[#98A894]">
              Your browser temporarily suspended WebGL rendering. Reload or focus the window to
              restore the 3D arena.
            </p>
          </div>
        </div>
      )}

      {/* Game Shell & Perimeter Telemetry Overlays */}
      <GameOverlays
        hud={hud}
        user={user}
        dockCollapsed={dockCollapsed}
        onToggleDock={() => setDockCollapsed((c) => !c)}
        onStartGame={(diff) => {
          setLeaderboardOpen(false);
          simRef.current?.startNewGame(diff);
        }}
        onSelectDifficulty={(diff) => simRef.current?.setDifficulty(diff)}
        onTogglePause={() =>
          simRef.current?.setPaused(hud.status === 'PLAYING')
        }
        onReturnToTitle={() => simRef.current?.returnToTitle()}
        onToggleCamera={() => simRef.current?.toggleCameraPreset()}
        onSetCamera={(preset: CameraPreset) => simRef.current?.setCameraPreset(preset)}
        onToggleMute={() => simRef.current?.toggleMute()}
        onOpenLeaderboard={() => setLeaderboardOpen(true)}
        onSignIn={handleSignIn}
        playerTag={playerTag}
        onChangePlayerTag={handleChangePlayerTag}
        cloudSubmitState={cloudSubmitState}
        cloudSubmitError={cloudSubmitError}
        onSubmitCloudRun={handleSubmitCloudRun}
        onVirtualInput={(x, y, boost) =>
          simRef.current?.setVirtualInput(x, y, boost)
        }
      />

      {/* High Score Leaderboard Modal */}
      <LeaderboardModal
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
        cloudEntries={cloudEntries}
        localEntries={localEntries}
        cloudError={cloudError}
        cloudLoading={cloudLoading}
        user={user}
        userProfile={userProfile}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />
    </main>
  );
}
