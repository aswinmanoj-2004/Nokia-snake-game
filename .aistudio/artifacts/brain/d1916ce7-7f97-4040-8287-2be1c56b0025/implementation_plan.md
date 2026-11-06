# Tactile 3D Nokia Snake: Physics Diorama & Leaderboard

A modern 3D reimagining of classic Nokia Snake staged inside a tactile olive-jade LCD and brushed titanium hardware diorama, featuring continuous momentum physics, randomized mechanical obstacles, peristalsis growth animations, switchable dual cameras, and a persistent cloud and local high-score leaderboard.

## User Review & Critical Decisions

> [!IMPORTANT]
> All core visual, camera, physics, and leaderboard preferences from Phase 1 have been locked into the design below. Review the gameplay rules and leaderboard architecture before approving to begin implementation.

- **Confirmed Aesthetic & Environment**: Tactile Nokia olive-jade backlit LCD matrix framed inside a precision-machined brushed titanium and anodized copper hardware diorama.
- **Confirmed Camera & Movement**: Switchable elevated angled diorama camera and dynamic third-person chase camera with smooth momentum steering, cornering drift, and boost physics.
- **Confirmed Obstacles & Physics**: Randomized kinetic spring bumpers, rail-guided sliding barriers, radial gravity blocks, and paired wrap portals that interact physically with both the snake and spawned food.
- **Confirmed Leaderboard Persistence**: Cloud leaderboard backed by Google Sign-In alongside an instant local arcade score table so players can compete immediately or sync verified scores online.

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the grid-bound handheld classic into a continuous-space 3D physics arcade game. Players steer an articulated biomechanical serpent across a backlit olive-jade arena to consume energy berries, triggering a visible digestive wave down its spine that automatically increments its segment count, speed, and score multiplier while navigating randomized kinetic, gravitational, and spatial hazards.
- **Target Audience & Context**: Arcade players and retro-hardware enthusiasts playing in a full-viewport desktop or mobile browser session who want immediate keyboard/touch responsiveness paired with tactile 3D physical feedback.
- **Key Value**: Preserves the unmistakable visual DNA and escalating spatial tension of classic Nokia Snake while elevating every turn, collision, portal warp, and growth cycle with modern 3D kinematics, procedural PBR materials, and persistent competitive rankings.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Title Screen & Live Diorama**: Launches directly into a full-viewport 3D scene where an autonomous demo serpent glides smoothly around the olive-jade and brushed titanium arena. A minimal title lockup sits over clean negative space alongside a difficulty selector, a primary Start CTA (`Enter` or `Space`), a Leaderboard trigger, and a single-line control hint.
2. **Active Gameplay & Camera Switching**: Pressing Start transitions the camera smoothly into the active play rig (`Angled Diorama` or `Chase Cam`, switchable anytime via `C` or the collapsible bottom dock). Steering (`WASD` or Arrow keys) applies smooth angular torque and forward momentum; holding `Space` triggers a speed boost with widening field of view.
3. **Food Consumption & Growth**: Approaching food prompts the snake's articulated jaw and forked tongue to react. Eating a berry spawns a particle burst, triggers a harmonic chime, and sends a physical peristalsis bulge traveling down the spine; when the wave reaches the tail, a new articulated body segment seamlessly attaches and increments the snake's length.
4. **Obstacle & Physics Encounters**:
   - **Kinetic Bumpers**: Spring-loaded copper-amber rings compress on contact, deflecting the snake's heading with lateral tail recoil and bonus ricochet points rather than instant failure on glancing hits.
   - **Sliding Barriers**: Titanium blocks glide along recessed floor tracks with pre-motion amber chevron telegraphs, dynamically reshaping corridors as the snake grows.
   - **Gravity Blocks**: Levitating core monoliths project visible radial rings that gently curve the snake's trajectory and pull nearby food into orbital drift.
   - **Wrap Portals**: Paired glowing jade vortex gates on opposite quadrants teleport the snake head and trailing segments across the arena while preserving momentum.
5. **Collision, Game Over & Leaderboard Submission**: High-speed head-on impacts into perimeter walls, sliding barriers, or the snake's own body trigger brief hitstop, camera shake, and a Game Over summary modal showing final score, peak length, obstacles cleared, and instant submission to either the local arcade table or the Google-authenticated global cloud leaderboard.

### Visual Identity & Theme

- **Aesthetic Direction**: Tactile Handheld Hardware Diorama — fusing nostalgic backlit olive-jade pixel matrix geometry with studio-lit brushed titanium, anodized copper, and optical ruby sensors.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - *60% Dominant Arena Canvas*: Deep studio olive-charcoal horizon (`#18221B`) blending via exponential fog into a backlit Nokia olive-jade playfield (`#3B5233` base matrix with `#8BAC0F` illuminated grid traces).
  - *30% Structural Hardware & Surfaces*: Brushed titanium perimeter chassis (`#8C97A6`), dark gunmetal mechanical recesses (`#1C2420`), and solid/translucent slate HUD panels (`rgba(16, 24, 20, 0.90)`) with crisp hairline borders.
  - *10% Focal Accents*: High-contrast backlit lime-jade (`#9BBC0F`) for primary actions and snake spine nodes, warm amber-copper (`#F59E0B`) for kinetic bumpers and bonus berries, and optical crimson (`#EF4444`) for hazard telegraphs and snake eyes.
- **Typography & Hierarchy**:
  - *Display*: `Chakra Petch` (SemiBold/Bold) for hardware-inspired titles and modal headers.
  - *Body & Controls*: `Plus Jakarta Sans` (Regular/SemiBold) for clean, single-line UI actions and instructions.
  - *Telemetry & Scores*: `JetBrains Mono` with `tabular-nums` for stationary alignment of live score, length, combo multiplier, and leaderboard rankings.
- **HUD & Viewport Discipline**: At least 85% of the viewport remains unobstructed during active play. Perimeter telemetry sits cleanly at the top edges without pill-box clutter or backdrop blur over WebGL, paired with a collapsible bottom control dock (`H` to toggle) housing camera mode, audio mute, pause, and leaderboard access.

### Interactive Feedback & Motion

- **Frame-Rate Independent Kinematics**: All camera transitions, steering torque, peristalsis waves, and bumper spring rebounds use exponential damping (`1 - exp(-k * dt)`) and second-order spring physics.
- **Procedural Audio Synthesis**: Built-in Web Audio API synthesizer generates tactile piezo-inspired chimes, pitch-escalating eat combos, spring bumper rebounds, portal phase sweeps, and collision impacts with an instant mute toggle.

---

## 3. Key Product Decisions & Trade-Offs

- **Continuous Momentum Physics vs. Strict Grid Stepping**:
  - *Chosen Approach*: Continuous 2D-plane physics (`x, z` heading, angular velocity, momentum drift, and radial/impulse forces) projected onto a tactile pixel-matrix arena floor.
  - *Why*: Enables realistic bumper deflection, gravitational trajectory bending, smooth spine curve following, and exhilarating third-person chase camera banking while keeping the classic Nokia visual grid immediately recognizable.
  - *Alternatives Considered*: Discrete cell-by-cell grid hopping, which makes kinetic bumpers, gravity wells, and chase-camera steering feel rigid and artificial.
- **Glancing Deflection vs. Instant Wall Death**:
  - *Chosen Approach*: Shallow-angle contacts against kinetic bumpers and outer rails deflect the snake with momentum loss and tail whip, whereas direct head-on impacts into solid barriers, outer walls, or self-segments end the run.
  - *Why*: Rewards skillful near-misses and makes modern physics an active gameplay tool rather than a frustration multiplier.
- **Hybrid Cloud + Local Leaderboard**:
  - *Chosen Approach*: Instant local browser high-score persistence paired with optional one-click Google Sign-In for verified global cloud rankings.
  - *Why*: Eliminates sign-in friction on first launch while providing authentic cross-device competitive persistence when signed in.

---

## 4. Technical Architecture & Data Strategy

### System Architecture & Data Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        Application Shell & Game State                   │
│   (Title Diorama ─▶ Active Simulation ─▶ Paused ─▶ Game Over / Ranks)   │
└───────────────┬───────────────────────────────────┬─────────────────────┘
                │                                   │
                ▼                                   ▼
┌───────────────────────────────┐   ┌─────────────────────────────────────┐
│   3D Diorama & Physics Engine │   │    HUD Overlay & Leaderboard Store  │
│                               │   │                                     │
│ • Studio PBR Rig & Env Map    │   │ • Perimeter Score & Length Readouts │
│ • Procedural Canvas Textures  │   │ • Collapsible Bottom Control Dock   │
│ • Articulated Serpent Spine   │   │ • Google Auth & Cloud Sync Service  │
│ • Randomized Obstacle Spawner │   │ • Local Arcade Score Fallback       │
│ • Dual Damped Camera Controller│  └──────────────────┬──────────────────┘
│ • Web Audio Synth Feedback    │                      │
└───────────────┬───────────────┘                      ▼
                │                       ┌─────────────────────────────────┐
                │ 60fps rAF / Paced GL  │   Cloud Firestore & Auth        │
                └──────────────────────▶│ • Public High-Score Collection  │
                  (Isolated Canvas Ref) │ • Verified User Profile Store   │
                                        └─────────────────────────────────┘
```

### Core Data Models & State

- **Simulation State (Mutable Loop Ref)**: Stores snake spine path history buffer, head position/velocity/heading, active peristalsis digestive pulses, target vs. current segment count, active food items (standard energy berry, high-value amber crystal, speed/magnet orb), randomized obstacle instances (kinetic bumpers with compression spring state, sliding barriers with rail phase, gravity blocks with pull radius, paired wrap portals with cooldown), and camera rig mode.
- **UI Snapshot State (React State)**: Lightweight throttled snapshots synced only on meaningful discrete events (score increment, length growth, combo change, game state transition, camera mode switch, audio mute) so the 60fps WebGL loop never triggers React re-renders.
- **Leaderboard Entry Model**:
  - *Cloud Record*: User UID, sanitized display name, numeric score, final snake length, difficulty tier, obstacles cleared, public visibility flag, and server timestamp.
  - *Local Record*: 3-character arcade tag, numeric score, final snake length, difficulty tier, obstacles cleared, and timestamp.

### Interactive Component & State Mapping

- **Title Overlay**: Binds difficulty tier selection (`Classic`, `Physics Chaos`, `Overdrive`), primary `Start Game` action (`Enter`/`Space`), and `Leaderboard` modal trigger.
- **Active HUD & Collapsible Bottom Dock**: Maps `C` / camera button to damped camera rig switching, `M` / audio button to Web Audio gain mute, `Esc` / `P` to simulation pause/resume, and `H` / chevron handle to dock collapse/expand.
- **Game Over & Leaderboard Modal**: Displays run breakdown, handles 3-letter local arcade tag submission immediately, and provides one-click Google Sign-In (`signInWithPopup`) to publish the run to the cloud leaderboard with strict client-side validation and structured error reporting.
