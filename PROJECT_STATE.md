## Project State – Vanilla JS Fighting Game

This document describes the current architecture and implementation of the HTML5 Canvas + Vanilla JavaScript version of the fighting game. It is intended as a technical hand‑off for recreating the same behavior in a future React + Phaser implementation.

---

### Current Architecture

- **Rendering layer**: Single `<canvas>` element (`index.html`) rendered with the 2D context.
- **Language & modules**: **Pure ES6 modules**, no bundler – modules are loaded directly from the browser using `type="module"` in `index.html`.
- **Game loop**: Manual `requestAnimationFrame` loop in `src/game.js` that:
  - Draws background and foreground sprites.
  - Updates fighters (physics, animations, attacks).
  - Handles hit detection and win conditions.
- **OOP model**:
  - `Sprite` base class for rendering animated spritesheets and handling frame timing + horizontal flipping.
  - `Fighter` subclass adds physics, attacks, health, and stateful animations.
- **Input layer**:
  - Keyboard (two players).
  - Gamepad (two players) via the Browser Gamepad API.
  - Touch / on‑screen buttons on mobile.
- **UI layer (DOM)**:
  - UI components under `src/ui/` (interface bar, health bars, timer, win modal, game menu, action buttons).
  - Optional health bar animation using GSAP (when `window.gsap` is present).
- **Resolution model**:
  - Fixed logical canvas resolution (`1024 x 576`) via `initResponsiveCanvas`.
  - CSS scaling for responsive fit on different screens without changing logical coordinates (virtual resolution).

---

### Current File Structure

Approximate directory tree (root is the project directory):

```text
.
├── .gitattributes
├── index.html
├── style.css
├── README.md
├── VS_CODE_AI_RULES.md
├── assets/
│   └── images/
│       ├── background.png
│       ├── shop.png
│       ├── Kenji/
│       │   ├── Attack1.png
│       │   ├── Attack2.png
│       │   ├── Death.png
│       │   ├── Fall.png
│       │   ├── Idle.png
│       │   ├── Jump.png
│       │   └── Take hit.png
│       └── Mack/
│           ├── Attack1.png
│           ├── Attack2.png
│           ├── Death.png
│           ├── Fall.png
│           ├── Idle.png
│           ├── Jump.png
│           ├── Run.png
│           ├── Take Hit.png
│           └── Take Hit - white silhouette.png
└── src/
    ├── game.js
    ├── classes/
    │   ├── Fighter.js
    │   └── Sprite.js
    ├── utils/
    │   ├── collision.js
    │   ├── constants.js
    │   ├── gameLogic.js
    │   ├── input.js
    │   ├── mobile.js
    │   ├── responsive.js
    │   └── scale.js
    └── ui/
        ├── ActionButton.js
        ├── GameInterface.js
        ├── GameMenu.js
        ├── HealthBar.js
        ├── Timer.js
        └── WinModal.js
```

- **Assets location**: All images are under `assets/images/`, with per‑character folders (`assets/images/Mack/`, `assets/images/Kenji/`).
- **Source layout**:
  - `src/classes/`: Core game entities (`Sprite`, `Fighter`).
  - `src/utils/`: Pure logic helpers (collision, input, mobile controls, scaling, game logic, constants).
  - `src/ui/`: DOM‑based UI components (health bars, timers, overlays, menu, win modal, generic buttons).
  - `src/game.js`: Game bootstrap, scene setup, and main loop.

---

### Logic Overview

#### Sprite class (`src/classes/Sprite.js`)

**Responsibility**: Generic animated sprite that knows how to draw a specific frame from a spritesheet onto the canvas and optionally flip horizontally.

- **Constructor signature**:
  - Accepts `{ position, imageSrc, scale = 1, frameMax = 1, offset = { x: 0, y: 0 } }`.
  - Normalizes `imageSrc` by converting legacy `./img/...` paths to `../assets/images/...`.
  - Initializes animation state: `framesCurrent`, `framesElapsed`, `framesHold`, `frameMax`.
  - Stores `facing` direction (`'right'` by default).
- **Key properties**:
  - `position`: `{ x, y }` logical coordinates in canvas space.
  - `image`: `HTMLImageElement` loaded from `imageSrc`.
  - `scale`: scalar applied to both x and y.
  - `frameMax`: number of frames in the spritesheet row.
  - `offset`: `{ x, y }` offset to align sprite relative to logical position.
  - `facing`: `'right'` or `'left'` (used for horizontal mirroring).
- **Important methods**:
  - `draw(c)`:
    - Computes a single frame width: `image.width / frameMax`.
    - Applies `scale` to derive on‑screen width and height.
    - Uses `c.save()` / `c.restore()` to confine transformations.
    - When `facing === 'left'`:
      - Translates and applies `c.scale(-1, 1)` to flip horizontally.
      - Draws the current animation frame mirrored, preserving hitbox logic based on position.
    - When `facing === 'right'`:
      - Draws the frame normally using `position` and `offset`.
  - `animateFrames()`:
    - Increments `framesElapsed`.
    - Every `framesHold` ticks, advances `framesCurrent` within `[0, frameMax - 1]` and loops.
  - `update(c)`:
    - Calls `draw(c)` and then `animateFrames()`.

**Migration note**: In Phaser, `Sprite` maps naturally to a `Phaser.GameObjects.Sprite` or `Phaser.Physics.Arcade.Sprite`. Facing/mirroring can be implemented via `setFlipX(true/false)` or negative scale, while frame animation uses Phaser’s animation system instead of manual frame indices.

#### Fighter class (`src/classes/Fighter.js`)

**Responsibility**: A controllable fighter character with physics, attack hitboxes, health, animation states, and attack logic. Extends `Sprite`.

- **Constructor signature**:
  - Accepts:
    - `position`, `velocity`, `color`, `imageSrc`, `scale`, `frameMax`, `offset`.
    - `sprites`: dictionary of animation definitions, e.g. `{ idle: { imageSrc, frameMax }, run: {...}, jump: {...}, ... }`.
    - `attackBox`: `{ offset, width, height }`.
  - Calls `super(...)` with `position`, `imageSrc`, `scale`, `frameMax`, `offset`.
  - Stores base dimensions and base scaling data for responsive behavior:
    - `baseWidth`, `baseHeight`, and mirrored `width`, `height`.
    - `basePosition`, `baseOffset`, `baseAttackBoxOffset`, `baseScale`.
  - Builds `attackBox`:
    - `attackBox.position` follows the fighter and is re‑computed each frame based on `position`, `attackBox.offset`, and `facing`.
  - Loads each sprite animation frame:
    - For every key in `sprites`, creates an `Image()` and normalizes `imageSrc` similarly to `Sprite`.
  - Initializes combat‑related flags:
    - `health = 100`
    - `dead = false`
    - `isAttacking` and `canAttack` flags for attack rate control.
- **Update loop** – `update(c, canvas, gravity)`:
  - Calls `draw(c)` and `animateFrames()` (unless dead).
  - Updates `facing`:
    - If `velocity.x > 0` → `'right'`.
    - If `velocity.x < 0` → `'left'`.
  - Updates `attackBox.position`:
    - If facing right: `attackBox.position.x = position.x + attackBox.offset.x`.
    - If facing left: moves hitbox to the left side of the fighter, aligned with `width` and `attackBox.width`.
    - Y offset: `attackBox.position.y = position.y + attackBox.offset.y`.
  - Applies physics:
    - `position.x += velocity.x`, `position.y += velocity.y`.
    - Simple gravity: `velocity.y += gravity` when above ground.
    - Ground detection uses `canvas.height - 96` as ground Y:
      - Snap fighter’s feet to ground, zero out vertical velocity.
- **Input‑facing helpers**:
  - `moveLeft(speed)`, `moveRight(speed)`: set horizontal velocity to a signed `speed`.
  - `stopHorizontal()`: zero horizontal velocity; called every frame before applying input to avoid drift.
  - `getState()`: returns a serializable object with `position`, `velocity`, current animation key, `framesCurrent`, `health`, `dead` – useful for networking/sync if needed.
  - `setState(data)`: applies an external state object back onto the fighter and optionally switches animation.
- **Combat & animation helpers**:
  - `attack()`:
    - Early‑exits if `dead` or `canAttack` is false.
    - Prevents attack animation from being restarted mid‑swing (checks current sprite and `framesCurrent`).
    - Switches to `'attack'` animation, sets `isAttacking = true`, `canAttack = false`.
  - `takeHit()`:
    - Reduces `health` by a fixed amount.
    - If health drops to or below zero: switches to `'death'` animation.
    - Otherwise switches to `'takeHit'` animation.
  - `switchSprite(spriteName)`:
    - Guards:
      - If already in death animation and it is not finished, do nothing.
      - While in `attack` or `takeHit` animations and those sequences are incomplete, they cannot be interrupted by other states.
    - When switching, updates:
      - `image` from the selected animation.
      - `frameMax` to match the animation’s frame count.
      - Resets `framesCurrent` to 0.
  - `restart(startPosition)`:
    - Resets `dead`, `health`, `velocity`.
    - Places fighter at `startPosition`.
    - Forces an immediate switch back to `idle` sprite, bypassing `switchSprite` guards.

**Migration note**: In Phaser, `Fighter` maps to a physics‑enabled sprite (e.g. Arcade Physics body) with:
- Horizontal velocity controlled via `setVelocityX`.
- Gravity handled by the physics system.
- Attack boxes can be separate invisible physics bodies or overlap checks.
- Animation state machine logic can be moved into Phaser’s animation events with similar “uninterruptible” windows.

---

### Utility Functions (`src/utils/`)

All utilities are written as pure functions (no classes) and imported into `game.js` or UI modules.

- **`collision.js`**
  - `rectangularCollision({ rectangle1, rectangle2 })`:
    - Expects each rectangle to have:
      - `attackBox.position.x`, `attackBox.position.y`, `attackBox.width`, `attackBox.height`.
      - `position.x`, `position.y`, `width`, `height`.
    - Returns `true` when the attacking fighter’s `attackBox` overlaps the other fighter’s bounding box on both axes.

- **`constants.js`**
  - `GRAVITY`:
    - Scalar `0.7`, applied to fighters’ vertical velocity each frame until they reach ground.
  - `START_POSITIONS`:
    - `player: { x: 200, y: 330 }`
    - `enemy: { x: 700, y: 330 }`
    - Used for initial placement and restarts.

- **`gameLogic.js`**
  - `export let timer = 60;`:
    - Global countdown in seconds.
  - `whoWins(player, enemy)`:
    - Stops internal timer timeout.
    - Compares `player.health` vs `enemy.health`.
    - Returns `'Tie'`, `'Player 1 Wins'`, or `'Player 2 Wins'` (UI uses this string).
  - `decrementTimer(onEnd, onTick)`:
    - Recursive `setTimeout` every 1 second.
    - Decrements `timer` and calls optional `onTick(timer)` callback.
    - When `timer === 0`, calls `onEnd()`.
  - `jump(player)`:
    - If `player.velocity.y === 0` (on ground), applies `player.velocity.y = -15`.
  - `restartGame(player, enemy, onTick, onEnd)`:
    - Resets `timer` to 60.
    - Restarts countdown via `decrementTimer(onEnd, onTick)`.
    - Calls `player.restart({ x: 200, y: 330 })` and `enemy.restart({ x: 700, y: 330 })` when available.

- **`input.js`**
  - `handleGamepadInput(player, enemy, keys, { jump, restartGame })`:
    - Reads `navigator.getGamepads()` for connected controllers.
    - **Player 1 (Gamepad 0)**:
      - Movement:
        - Uses axis `axes[0]` (left stick) and `buttons[14]`/`[15]` for left/right D‑pad.
        - Sets `keys.a.pressed` / `keys.d.pressed` and updates `player.lastKey` accordingly.
      - Jump:
        - `buttons[0]` or `buttons[12]` (A or D‑pad up) → calls `jump(player)`.
      - Attack:
        - `buttons[2]` or `buttons[1]` (X or B) → `player.attack()`.
        - When not pressed, resets `player.canAttack = true` (simulating keyup).
      - Restart:
        - `buttons[9]` (Start) → calls `restartGame(player, enemy)` if provided.
    - **Player 2 (Gamepad 1)**:
      - Same mapping pattern, but using `keys.ArrowLeft` / `keys.ArrowRight` and `enemy.lastKey`.
      - Jump and attack call `jump(enemy)` and `enemy.attack()` respectively.

- **`mobile.js`**
  - `isMobile()`:
    - Detects mobile devices via `navigator.maxTouchPoints` or a mobile user agent regex.
  - `initMobileControls(keys, callbacks)`:
    - Creates a `#mobile-controls` container with:
      - A D‑pad (`btn-left`, `btn-right`) for horizontal movement.
      - Action buttons (`btn-jump`, `btn-attack`) for jump and attack.
    - Uses `ActionButton` UI component to render each button.
    - Wires `touchstart` / `touchend` / `mousedown` / `mouseup` / `mouseleave` events:
      - Press: sets the corresponding `keys[keyName].pressed = true`, adds `.active` class, and fires optional callbacks (`onLeft`, `onRight`, `jump`, `attack`).
      - Release: sets `keys[keyName].pressed = false`, removes `.active`, calls release callbacks (including `attackRelease` for resetting `player.canAttack`).
    - Returns references `{ container, left, right, jumpBtn, attackBtn }` or `null` if not mobile.
  - `hideMobileControls()`, `showMobileControls()`, `removeMobileControls()`:
    - Simple helpers to control visibility or remove the mobile controls container.

- **`responsive.js`**
  - `initResponsiveCanvas(canvas)`:
    - Sets fixed internal resolution:
      - `canvas.width = 1024`
      - `canvas.height = 576`
    - Listens to `window.resize` and:
      - Computes `windowRatio` vs `gameRatio`.
      - Adjusts `canvas.style.width` and `canvas.style.height` so the canvas always maintains aspect ratio and fits within the viewport.
    - This ensures all game logic uses stable logical coordinates while the rendered canvas scales visually (virtual resolution).

- **`scale.js`**
  - `computeDisplayScale(canvasSize, defaultSize = 1024)`:
    - Returns `canvasSize / defaultSize`.
    - Intended for computing a consistent scaling factor based on canvas dimensions.
  - `scaleFighter(fighter, displayScale, canvasHeight, defaultHeight = 576)`:
    - Uses `basePosition`, `baseOffset`, `baseAttackBoxOffset`, `baseWidth`, `baseHeight`, `baseScale` on the fighter to:
      - Scale position, offset, attack box offset, and size proportionally.
    - Aligns fighter vertically to the same ground line as other sprites based on `canvasHeight`:
      - Computes ground Y from `defaultHeight - groundOffset` and maps it to current `canvasHeight`.
  - `alignSpriteToGround(sprite, canvasHeight, groundOffset = 96)`:
    - Aligns a generic sprite so its bottom sits on the ground line at `canvasHeight - groundOffset`.
    - Uses image’s height and sprite’s `scale`/`offset` when available, or falls back to `sprite.height`.
    - Handles `image.onload` to re‑align when dimensions become known.
  - `scaleShop(shop, displayScale, defaultHeight = 576)`:
    - Uses `shop.basePosition` and `shop.baseScale` to adjust the shop sprite according to the display scale.

---

### Asset Mapping

All assets live under `assets/images/`. The game uses the following key sprites and backgrounds:

- **Background & environment**
  - **Stage background**: `assets/images/background.png`
    - Loaded as a `Sprite` in `game.js` with `imageSrc: '../assets/images/background.png'`.
    - Tiled horizontally each frame to cover the full canvas.
  - **Shop foreground**: `assets/images/shop.png`
    - Loaded as a `Sprite` with:
      - `position: { x: 650, y: 160 }`
      - `scale: 2.5`
      - `frameMax: 6`
    - Also uses `shop.basePosition` and `shop.baseScale` for scaling helpers.

- **Mack (Player 1) – `assets/images/Mack/`**
  - Idle: `assets/images/Mack/Idle.png`
  - Run: `assets/images/Mack/Run.png`
  - Jump: `assets/images/Mack/Jump.png`
  - Fall: `assets/images/Mack/Fall.png`
  - Attack:
    - Main attack: `assets/images/Mack/Attack1.png`
    - Secondary attack (present but not currently wired in `sprites`): `assets/images/Mack/Attack2.png`
  - Hit:
    - Regular take hit: `assets/images/Mack/Take Hit.png`
    - Special white silhouette take hit: `assets/images/Mack/Take Hit - white silhouette.png` (this one is used in `game.js`).
  - Death: `assets/images/Mack/Death.png`

- **Kenji (Player 2) – `assets/images/Kenji/`**
  - Idle: `assets/images/Kenji/Idle.png`
  - Run: `assets/images/Kenji/Run.png`
  - Jump: `assets/images/Kenji/Jump.png`
  - Fall: `assets/images/Kenji/Fall.png`
  - Attack:
    - Main attack: `assets/images/Kenji/Attack1.png`
    - Secondary attack (present but not currently wired in `sprites`): `assets/images/Kenji/Attack2.png`
  - Hit: `assets/images/Kenji/Take hit.png`
  - Death: `assets/images/Kenji/Death.png`

**Path normalization**:
- The `Sprite` and `Fighter` classes normalize legacy paths of the form `./img/...` to `../assets/images/...`.
- In this version of the project, `game.js` already references the normalized paths directly.

---

### Feature Checklist

- **Character mirroring / flipping**
  - Implemented in `Sprite.draw(c)`:
    - Uses `this.facing` to choose between normal drawing and a horizontally flipped rendering using `c.translate` and `c.scale(-1, 1)`.
  - `Fighter.update` sets `facing` based on horizontal velocity, so characters face the direction of movement.

- **Keyboard controls (two players)**
  - Configured in `game.js`:
    - `keys` object tracks pressed keys (`a`, `d`, `w`, `s`, arrow keys).
    - `keydown` and `keyup` listeners update `keys.*.pressed` and `lastKey`.
  - Mappings:
    - Player 1:
      - Move: `A` / `D`.
      - Jump: `W`.
      - Attack: `Space`.
    - Player 2:
      - Move: `ArrowLeft` / `ArrowRight`.
      - Jump: `ArrowUp`.
      - Attack: `ArrowDown`.

- **Gamepad support (two players)**
  - Implemented in `src/utils/input.js`:
    - Uses `navigator.getGamepads()` when available.
    - Gamepad 0 → Player 1, Gamepad 1 → Player 2.
    - Left stick / D‑pad horizontal axes drive movement by setting the same `keys` flags used by keyboard input.
    - Gamepad buttons mapped to jump and attack mirror the keyboard semantics.
    - Start button can trigger a restart via the `restartGame` callback.
  - `game.js` calls `handleGamepadInput` each animation frame (while the menu is not active).

- **Mobile touch buttons**
  - Implemented in `src/utils/mobile.js`:
    - `initMobileControls` creates on‑screen controls only when `isMobile()` is `true`.
    - Generates:
      - D‑pad arrows bound to `keys.a` / `keys.d`.
      - Jump and attack buttons bound to jump and attack callbacks.
    - Updates `keys` in the same way as keyboard input, ensuring shared movement logic.
    - `game.js` also sets `player.lastKey` when D‑pad buttons are pressed on mobile so movement logic behaves consistently.

- **Virtual resolution scaling (responsive canvas)**
  - Implemented primarily by `initResponsiveCanvas(canvas)` in `src/utils/responsive.js`:
    - Logical resolution fixed at `1024 x 576`.
    - CSS width/height updated on `resize` to preserve aspect ratio and fill available viewport space.
  - Additional helpers in `src/utils/scale.js`:
    - `alignSpriteToGround` used in `game.js` to keep fighters and the shop aligned to the ground line, even when the canvas height changes.
    - `scaleFighter` and `scaleShop` are prepared for more advanced resolution‑aware scaling, using `basePosition`/`baseScale` metadata.

- **Game state and UI**
  - Round timer:
    - Driven by `decrementTimer` from `gameLogic.js`.
    - UI updated through `GameInterface.timer.set(t)`.
  - Health bars:
    - `Fighter.takeHit` reduces `health`.
    - UI updated via `gameInterface.playerUI.update` / `enemyUI.update`, optionally with GSAP animations when `window.gsap` is present.
  - Win conditions:
    - Triggered when either fighter reaches `health <= 0`.
    - Uses `whoWins(player, enemy)` to decide the winner and shows `WinModal` with the result.
  - Game menu:
    - `GameMenu` shown on initial load; hides the interface until “Game Start” is pressed.
    - `GameMenu.onStart` triggers `window.restartGame()` to start a match.

---

### Dependencies

- **Runtime libraries**
  - **GSAP (optional)**:
    - Included in `index.html` via CDN:
      - `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.9.1/gsap.min.js`
    - Used by the UI layer to animate health bar transitions if `window.gsap` is defined.
  - **Google Fonts**:
    - `Press Start 2P` font loaded via Google Fonts for retro UI styling.
- **JavaScript code**
  - Core game logic is **100% custom Vanilla JavaScript with ES6 modules**.
  - No npm dependencies or bundlers; no React or Phaser present yet.

**Summary**: From a migration perspective, the existing codebase can be treated as self‑contained Vanilla JS + Canvas logic, with only optional GSAP‑powered UI transitions.

---

### Notes for React + Phaser Migration

When porting to React + Phaser, these are the key behaviors to preserve:

- **Physics & gravity**:
  - Maintain the simple gravity model (`GRAVITY = 0.7`) and ground height equivalent to `canvas.height - 96`.
  - Map `position`, `velocity`, and jumping rules to Phaser’s physics bodies.
- **Facing / mirroring**:
  - Preserve `facing` semantics of `Fighter` and `Sprite.draw`, using Phaser’s `setFlipX` or negative scale.
- **Attack boxes & collisions**:
  - Implement attack hitboxes as separate Phaser bodies or overlap checks using the same rectangle logic as `rectangularCollision`.
  - Preserve the frame‑based timing of hits (`framesCurrent` thresholds) for both fighters.
- **Input parity**:
  - Recreate:
    - Keyboard mappings for both players.
    - Gamepad mappings (Gamepads 0 and 1, axes and button indices as currently used).
    - Touch controls for mobile (on‑screen buttons or equivalent UI overlay in React).
- **Resolution model**:
  - Keep a virtual resolution of `1024 x 576` (or an equivalent fixed game size in Phaser’s config) and let React/CSS or Phaser’s scaling system handle responsive scaling.
- **UI and flow**:
  - Maintain:
    - Timer countdown and win determination logic (`whoWins`).
    - Health bar updates tied to `Fighter.health`.
    - Start menu gating the first match and the “restart” behavior.
  - If desired, GSAP can continue to be used for React UI animations, or equivalent animation can be implemented in React/Phaser directly.

This document should be sufficient for a React + Phaser implementation to mirror the current game’s behavior, including gamepad support, character flipping, hit detection, and responsive scaling.

