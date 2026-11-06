# Firestore Security Specification & Red-Team Audit

## 1. Data Invariants

1. **Identity Integrity**: Every `/leaderboard/{entryId}` document created must bind `uid` strictly to `request.auth.uid`, and every `/users/{userId}` document must match `userId == request.auth.uid` with `email_verified == true`.
2. **PII Isolation**: `/leaderboard/{entryId}` documents strictly whitelist non-PII fields (`uid`, `playerName`, `score`, `snakeLength`, `obstaclesCleared`, `difficulty`, `createdAt`) and reject any extra/shadow fields such as `email` or `isAdmin`. `/users/{userId}` documents contain `email` and are strictly restricted to `isOwner(userId)` for both `get` and `list`.
3. **Immutable Arcade Runs & Temporal Integrity**: `/leaderboard/{entryId}` records are append-only (`allow update: if false;`) and require `createdAt == request.time`. `/users/{userId}` updates enforce `uid == existing().uid`, `createdAt == existing().createdAt`, `updatedAt == request.time`, and `affectedKeys().hasOnly(['displayName', 'email', 'bestScore', 'bestLength', 'runsPlayed', 'updatedAt'])`.
4. **Volumetric & Type Bounds**: Document IDs must match `^[a-zA-Z0-9_-]{1,128}$`. Strings enforce explicit `.size()` bounds (`playerName` 1..32, `displayName` 1..64, `email` 3..128), integers enforce realistic arcade caps (`score` 0..10,000,000, `snakeLength` 3..5,000), and `difficulty` is constrained to `['classic', 'chaos', 'overdrive']`.

## 2. Adversarial Payloads ("Dirty Dozen")

1. **Unauthenticated Leaderboard Write**: Unauthenticated client attempts `setDoc(doc(db, 'leaderboard', 'run_1'), validPayload)` -> **DENIED** (`request.auth == null`).
2. **Unverified Email Write**: Signed-in user with `email_verified: false` attempts to create a leaderboard score -> **DENIED** (`request.auth.token.email_verified != true`).
3. **Identity Spoofing on Score Creation**: User `alice` (`uid: "alice"`) submits `uid: "bob"` in `/leaderboard/run_2` -> **DENIED** (`incoming().uid != request.auth.uid`).
4. **Shadow Field Injection (PII / Privilege Escalation)**: User submits `validPayload` plus `isAdmin: true` or `email: "leak@example.com"` -> **DENIED** (`data.keys().hasOnly(...)` fails).
5. **Score Tampering / Post-Creation Mutation**: User attempts `updateDoc(doc(db, 'leaderboard', 'run_1'), { score: 9999999 })` on their own existing entry -> **DENIED** (`allow update: if false`).
6. **Negative or Overflow Score Poisoning**: User submits `score: -50` or `score: 999999999` -> **DENIED** (`score >= 0 && score <= 10000000` fails).
7. **Invalid Difficulty Enum Injection**: User submits `difficulty: "godmode"` -> **DENIED** (`difficulty in ['classic', 'chaos', 'overdrive']` fails).
8. **Client Clock Backdating / Future-Dating**: User submits `createdAt: Timestamp.fromMillis(0)` instead of `serverTimestamp()` -> **DENIED** (`incoming().createdAt == request.time` fails).
9. **ID Poisoning / Oversized Document ID**: User targets `/leaderboard/${'a'.repeat(300)}` or `/leaderboard/bad$id` -> **DENIED** (`isValidId(entryId)` fails).
10. **String Buffer Exhaustion**: User submits `playerName: 'X'.repeat(5000)` -> **DENIED** (`playerName.size() <= 32` fails).
11. **Cross-User Profile Read (PII Leak)**: User `alice` attempts `getDoc(doc(db, 'users', 'bob'))` or `getDocs(collection(db, 'users'))` -> **DENIED** (`isOwner(userId)` fails).
12. **Immutable Field Mutation on Profile Update**: User `alice` attempts to update `createdAt` or `uid` on `/users/alice` -> **DENIED** (`affectedKeys().hasOnly(...)` and `incoming().createdAt == existing().createdAt` fail).

## 3. Red-Team Audit Summary

- **Shadow Update Test**: PASS — `hasOnly(...)` on create and `affectedKeys().hasOnly(...)` on update block all shadow fields.
- **Email Spoofing Test**: PASS — `request.auth.token.email_verified == true` is mandated before any write.
- **PII Blanket Test**: PASS — `/users/{userId}` restricts `get` and `list` to `isOwner(userId)`; `/leaderboard/{entryId}` stores zero PII.
- **Query Trust Test**: PASS — `/leaderboard` `allow list` explicitly evaluates `resource.data.score >= 0` (matching the client's `where('score', '>=', 0), orderBy('score', 'desc'), limit(25)` query) and `/users` `allow list` explicitly evaluates `isOwner(userId) && resource.data.uid == request.auth.uid`.
