import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type {
  DifficultyMode,
  LeaderboardEntry,
  UserProfileSummary,
} from './types/game';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();

export function subscribeAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export interface SignInResult {
  user: User | null;
  cancelled: boolean;
  code: string | null;
  errorMessage: string | null;
}

let activeSignInPromise: Promise<SignInResult> | null = null;
const inFlightProfileSyncs = new Map<string, Promise<UserProfileSummary | null>>();

function getAuthErrorDetails(err: unknown): {
  cancelled: boolean;
  code: string | null;
  errorMessage: string;
} {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return {
      cancelled: true,
      code,
      errorMessage:
        'Google sign-in popup was closed before completing. Your scores continue saving locally.',
    };
  }

  if (code === 'auth/popup-blocked') {
    return {
      cancelled: false,
      code,
      errorMessage:
        'Pop-up was blocked by your browser. Allow pop-ups for this site or open in a new tab to sign in.',
    };
  }

  if (code === 'auth/unauthorized-domain') {
    return {
      cancelled: false,
      code,
      errorMessage:
        'This preview domain is not authorized for Google Sign-In in Firebase Authentication.',
    };
  }

  if (code === 'auth/operation-not-allowed') {
    return {
      cancelled: false,
      code,
      errorMessage:
        'Google Sign-In is not enabled for this Firebase project.',
    };
  }

  if (code === 'auth/network-request-failed') {
    return {
      cancelled: false,
      code,
      errorMessage:
        'Network error while contacting Google Sign-In. Check your connection and try again.',
    };
  }

  return {
    cancelled: false,
    code: code || null,
    errorMessage: 'Unable to complete Google sign-in right now. Please try again.',
  };
}

export async function signInWithGoogle(): Promise<SignInResult> {
  if (activeSignInPromise) {
    return activeSignInPromise;
  }

  activeSignInPromise = (async (): Promise<SignInResult> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await ensureUserProfile(result.user).catch(() => null);
      return {
        user: result.user,
        cancelled: false,
        code: null,
        errorMessage: null,
      };
    } catch (error) {
      const details = getAuthErrorDetails(error);
      return {
        user: null,
        cancelled: details.cancelled,
        code: details.code,
        errorMessage: details.errorMessage,
      };
    } finally {
      activeSignInPromise = null;
    }
  })();

  return activeSignInPromise;
}

export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore transient sign-out failures
  }
}

function sanitizePlayerName(raw: string | null | undefined): string {
  const cleaned = (raw || 'SERPENT_ACE').trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) return 'SERPENT_ACE';
  return cleaned.slice(0, 32);
}

function sanitizeDisplayName(raw: string | null | undefined): string {
  const cleaned = (raw || 'Arcade Pilot').trim().replace(/\s+/g, ' ');
  if (cleaned.length === 0) return 'Arcade Pilot';
  return cleaned.slice(0, 64);
}

function sanitizeEmail(raw: string | null | undefined): string {
  const cleaned = (raw || 'player@arcade.local').trim();
  if (cleaned.length < 3) return 'player@arcade.local';
  return cleaned.slice(0, 128);
}

export async function ensureUserProfile(user: User): Promise<UserProfileSummary | null> {
  if (!user || !user.uid) return null;

  const existingTask = inFlightProfileSyncs.get(user.uid);
  if (existingTask) {
    return existingTask;
  }

  const task = (async (): Promise<UserProfileSummary | null> => {
    const path = `users/${user.uid}`;
    const ref = doc(db, 'users', user.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        const displayName = sanitizeDisplayName(user.displayName);
        const email = sanitizeEmail(user.email);
        await setDoc(ref, {
          uid: user.uid,
          displayName,
          email,
          bestScore: 0,
          bestLength: 4,
          runsPlayed: 0,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return {
          uid: user.uid,
          displayName,
          email,
          bestScore: 0,
          bestLength: 4,
          runsPlayed: 0,
        };
      }
      const data = snap.data();
      return {
        uid: user.uid,
        displayName: String(data.displayName || 'Arcade Pilot'),
        email: String(data.email || ''),
        bestScore: Number(data.bestScore || 0),
        bestLength: Number(data.bestLength || 4),
        runsPlayed: Number(data.runsPlayed || 0),
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  })().finally(() => {
    inFlightProfileSyncs.delete(user.uid);
  });

  inFlightProfileSyncs.set(user.uid, task);
  return task;
}

export async function fetchUserProfile(uid: string): Promise<UserProfileSummary | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      uid,
      displayName: String(data.displayName || 'Arcade Pilot'),
      email: String(data.email || ''),
      bestScore: Number(data.bestScore || 0),
      bestLength: Number(data.bestLength || 4),
      runsPlayed: Number(data.runsPlayed || 0),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeGlobalLeaderboard(
  onEntries: (entries: LeaderboardEntry[]) => void,
  onError: (message: string) => void
): () => void {
  const path = 'leaderboard';
  const q = query(
    collection(db, path),
    where('score', '>=', 0),
    orderBy('score', 'desc'),
    limit(25)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: LeaderboardEntry[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const ts = d.createdAt as Timestamp | undefined;
        const diff =
          d.difficulty === 'classic' || d.difficulty === 'chaos' || d.difficulty === 'overdrive'
            ? (d.difficulty as DifficultyMode)
            : 'classic';
        return {
          id: docSnap.id,
          playerName: String(d.playerName || 'SERPENT'),
          score: Number(d.score || 0),
          snakeLength: Number(d.snakeLength || 4),
          obstaclesCleared: Number(d.obstaclesCleared || 0),
          difficulty: diff,
          createdAtMs: ts && typeof ts.toMillis === 'function' ? ts.toMillis() : Date.now(),
          isCloud: true,
          uid: typeof d.uid === 'string' ? d.uid : undefined,
        };
      });
      onEntries(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (err) {
        onError(
          err instanceof Error
            ? 'Unable to sync global leaderboard right now.'
            : 'Leaderboard connection error.'
        );
      }
    }
  );
}

export async function submitCloudScore(params: {
  user: User;
  playerName: string;
  score: number;
  snakeLength: number;
  obstaclesCleared: number;
  difficulty: DifficultyMode;
}): Promise<LeaderboardEntry> {
  const { user, playerName, score, snakeLength, obstaclesCleared, difficulty } = params;
  const entryId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entryPath = `leaderboard/${entryId}`;

  const safeName = sanitizePlayerName(playerName || user.displayName);
  const safeScore = Math.max(0, Math.min(10_000_000, Math.round(score)));
  const safeLength = Math.max(3, Math.min(5_000, Math.round(snakeLength)));
  const safeObstacles = Math.max(0, Math.min(100_000, Math.round(obstaclesCleared)));
  const safeDiff: DifficultyMode =
    difficulty === 'classic' || difficulty === 'chaos' || difficulty === 'overdrive'
      ? difficulty
      : 'classic';

  try {
    await setDoc(doc(db, 'leaderboard', entryId), {
      uid: user.uid,
      playerName: safeName,
      score: safeScore,
      snakeLength: safeLength,
      obstaclesCleared: safeObstacles,
      difficulty: safeDiff,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, entryPath);
  }

  // Also update owner profile summary
  const profilePath = `users/${user.uid}`;
  const profileRef = doc(db, 'users', user.uid);
  try {
    const existingSnap = await getDoc(profileRef);
    const displayName = sanitizeDisplayName(user.displayName || safeName);
    const email = sanitizeEmail(user.email);
    if (!existingSnap.exists()) {
      await setDoc(profileRef, {
        uid: user.uid,
        displayName,
        email,
        bestScore: safeScore,
        bestLength: safeLength,
        runsPlayed: 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const prev = existingSnap.data();
      const prevBest = Number(prev.bestScore || 0);
      const prevLen = Number(prev.bestLength || 4);
      const prevRuns = Number(prev.runsPlayed || 0);
      await updateDoc(profileRef, {
        displayName,
        email,
        bestScore: Math.max(prevBest, safeScore),
        bestLength: Math.max(prevLen, safeLength),
        runsPlayed: Math.min(1_000_000, prevRuns + 1),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, profilePath);
  }

  return {
    id: entryId,
    playerName: safeName,
    score: safeScore,
    snakeLength: safeLength,
    obstaclesCleared: safeObstacles,
    difficulty: safeDiff,
    createdAtMs: Date.now(),
    isCloud: true,
    uid: user.uid,
  };
}
