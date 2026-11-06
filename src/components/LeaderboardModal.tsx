import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import { LogIn, LogOut, Trophy, X } from 'lucide-react';
import type { LeaderboardEntry, UserProfileSummary } from '../types/game';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  cloudEntries: LeaderboardEntry[];
  localEntries: LeaderboardEntry[];
  cloudError: string | null;
  cloudLoading: boolean;
  user: User | null;
  userProfile: UserProfileSummary | null;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  classic: 'Classic',
  chaos: 'Physics Chaos',
  overdrive: 'Overdrive',
};

function formatDateShort(ms: number): string {
  try {
    return new Date(ms).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  isOpen,
  onClose,
  cloudEntries,
  localEntries,
  cloudError,
  cloudLoading,
  user,
  userProfile,
  onSignIn,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'cloud' | 'local'>('cloud');
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const entries = activeTab === 'cloud' ? cloudEntries : localEntries;

  const handleGoogleSignIn = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await onSignIn();
    } catch (err) {
      const msg =
        err instanceof Error && err.message.includes('popup-closed-by-user')
          ? 'Sign-in window was closed before completing.'
          : 'Unable to complete Google sign-in. Check popup settings and try again.';
      setAuthMessage(msg);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setAuthBusy(true);
    setAuthMessage(null);
    try {
      await onSignOut();
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#090E0B]/90 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leaderboard-heading"
    >
      <div className="w-full max-w-2xl bg-[#0F1712] border border-[#9BBC0F]/30 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[86vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-[#9BBC0F]/15">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-[#9BBC0F] shrink-0" aria-hidden="true" />
            <h2
              id="leaderboard-heading"
              className="font-display text-xl font-bold tracking-tight text-[#ECF2E6]"
            >
              High Score Leaderboard
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] text-xs font-semibold text-[#98A894] hover:text-[#ECF2E6] bg-[#16221B] hover:bg-[#1E2E24] border border-white/10 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
            <span>Close</span>
          </button>
        </div>

        {/* Google Account & Personal Cloud Best Bar */}
        <div className="px-6 py-3.5 bg-[#131E17] border-b border-[#9BBC0F]/15 flex flex-wrap items-center justify-between gap-4">
          {user ? (
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="text-sm font-semibold text-[#ECF2E6] truncate">
                {user.displayName || userProfile?.displayName || 'Google Player'}
              </div>
              <div className="text-xs text-[#98A894] font-mono-tabular flex flex-wrap items-center gap-2">
                <span>Cloud Best {(userProfile?.bestScore ?? 0).toLocaleString()}</span>
                <span aria-hidden="true">·</span>
                <span>Peak Length {userProfile?.bestLength ?? 6}</span>
                <span aria-hidden="true">·</span>
                <span>Runs {userProfile?.runsPlayed ?? 0}</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[#98A894] leading-relaxed max-w-md">
              Sign in with Google to publish verified runs to the global cloud leaderboard and sync
              your personal best across devices.
            </div>
          )}

          {user ? (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleGoogleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#ECF2E6] bg-[#1B2A21] hover:bg-[#24382C] border border-white/15 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Sign Out</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={authBusy}
              onClick={handleGoogleSignIn}
              className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-xs font-semibold text-[#0F1F12] bg-[#9BBC0F] hover:bg-[#B2D419] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{authBusy ? 'Signing In...' : 'Sign in with Google'}</span>
            </button>
          )}
        </div>

        {authMessage && (
          <div className="px-6 py-2.5 bg-[#2A1815] border-b border-[#EF4444]/30 text-xs text-[#FCA5A5]">
            {authMessage}
          </div>
        )}

        {/* Segmented Tab Switcher */}
        <div className="px-6 pt-4 pb-2 flex items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Leaderboard source"
            className="inline-flex items-center gap-1 p-1 bg-[#16221B] border border-white/10 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'cloud'}
              onClick={() => setActiveTab('cloud')}
              className={`px-4 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'cloud'
                  ? 'bg-[#9BBC0F] text-[#0F1F12]'
                  : 'text-[#98A894] hover:text-[#ECF2E6]'
              }`}
            >
              Global Cloud ({cloudEntries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'local'}
              onClick={() => setActiveTab('local')}
              className={`px-4 py-1.5 min-h-[36px] text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'local'
                  ? 'bg-[#9BBC0F] text-[#0F1F12]'
                  : 'text-[#98A894] hover:text-[#ECF2E6]'
              }`}
            >
              Local Arcade ({localEntries.length})
            </button>
          </div>

          <span className="text-xs text-[#98A894]">Top 25 Ranked Runs</span>
        </div>

        {/* Table Content */}
        <div className="px-6 pb-6 pt-2 overflow-y-auto arcade-scroll flex-1">
          {activeTab === 'cloud' && cloudError && (
            <div className="mb-3 px-4 py-3 rounded-lg bg-[#2A1815] border border-[#EF4444]/30 text-xs text-[#FCA5A5]">
              {cloudError}
            </div>
          )}

          {activeTab === 'cloud' && cloudLoading && entries.length === 0 ? (
            <div className="py-14 text-center text-sm text-[#98A894]">
              Loading global leaderboard standings...
            </div>
          ) : entries.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm font-medium text-[#ECF2E6]">
                {activeTab === 'cloud'
                  ? 'No global runs recorded yet.'
                  : 'No local arcade runs recorded yet.'}
              </p>
              <p className="mt-1 text-xs text-[#98A894]">
                {activeTab === 'cloud'
                  ? 'Complete a run and sign in with Google to claim the top rank.'
                  : 'Complete a run in the arena to set your first local high score.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold text-[#98A894]">
                  <th className="py-2.5 pr-3 w-12">Rank</th>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Length</th>
                  <th className="py-2.5 px-3 text-right">Obstacles</th>
                  <th className="py-2.5 pl-3 text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {entries.map((entry, index) => {
                  const isCurrentUser = Boolean(user && entry.uid && entry.uid === user.uid);
                  return (
                    <tr
                      key={entry.id}
                      className={
                        isCurrentUser ? 'bg-[#9BBC0F]/10 text-[#ECF2E6]' : 'text-[#ECF2E6]'
                      }
                    >
                      <td className="py-3 pr-3 font-mono-tabular font-bold text-[#9BBC0F]">
                        #{index + 1}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold truncate max-w-[180px]">
                          {entry.playerName}
                        </div>
                        <div className="text-xs text-[#98A894]">
                          {formatDateShort(entry.createdAtMs)}
                          {isCurrentUser ? ' · You' : ''}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#98A894] whitespace-nowrap">
                        {DIFFICULTY_LABEL[entry.difficulty] || entry.difficulty}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-[#ECF2E6]">
                        {entry.snakeLength}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-[#98A894]">
                        {entry.obstaclesCleared}
                      </td>
                      <td className="py-3 pl-3 text-right font-mono-tabular font-bold text-[#9BBC0F]">
                        {entry.score.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
