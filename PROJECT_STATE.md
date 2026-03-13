## Project State – React + Vite Fighting Game

This document describes the current architecture and implementation of the React + Vite version of the HTML5 Canvas fighting game. The project has been migrated from a purely Vanilla JS implementation into a modernized React application managed with Zustand for state management.

---

### Current Architecture

- **Core Framework**: React 19 + Vite.
- **State Management**: `zustand` is used for global state (UI view, game active state, player options, health, timer, etc.).
- **Rendering layer**: Single `<canvas>` element managed by `GameCanvas.jsx` component.
- **Game loop**: Vanilla JS `requestAnimationFrame` loop abstracted into `GameEngine.js`, bridging React state via callbacks to Zustand.
- **Multiplayer Networking**: PeerJS is used to handle WebRTC connections, with game state interpolation managed by the `NetworkFighter` class.
- **Styling**: Standard CSS with dynamic inline styles where necessary. GSAP is available for some UI animations if needed.

---

### Current File Structure

```text
.
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── App.jsx                 # Main application UI router
│   ├── main.jsx                # React mount point
│   ├── style.css               # Global styles
│   ├── components/             # React UI Components
│   │   ├── CharacterSelect.jsx
│   │   ├── GameCanvas.jsx      # Canvas integration
│   │   ├── GameInterface.jsx   # HUD wrapper
│   │   ├── GameMenu.jsx
│   │   ├── JoinMenu.jsx
│   │   ├── MobileControls.jsx
│   │   ├── MobileOrientationModal.jsx
│   │   ├── MultiplayerLobby.jsx
│   │   ├── MultiplayerMenu.jsx
│   │   ├── Preloader.jsx
│   │   └── ui/                 # Reusable smaller sub-components
│   │       ├── HealthBar.jsx
│   │       ├── Timer.jsx
│   │       └── WinModal.jsx
│   ├── engine/                 # Vanilla JS Engine logic & Classes
│   │   ├── GameEngine.js       # Game Loop & Scene Management
│   │   ├── classes/            # Object Oriented entities
│   │   │   ├── AudioManager.js
│   │   │   ├── Enemy.js        # AI Fighter extension with FSM
│   │   │   ├── Fighter.js
│   │   │   ├── NetworkFighter.js
│   │   │   └── Sprite.js
│   │   └── utils/              # Helper pure functions
│   │       ├── collision.js
│   │       ├── constants.js
│   │       ├── gameLogic.js
│   │       ├── input.js
│   │       ├── mobile.js
│   │       ├── peer.js
│   │       ├── responsive.js
│   │       ├── roster.js
│   │       └── scale.js
│   ├── hooks/                  # React Hooks
│   │   └── useGamepadMenu.js
│   └── store/                  # Zustand Store
│       └── useGameStore.js     # Single source of truth for UI state
```

---

### Logic Overview

#### State Management (`src/store/useGameStore.js`)
Uses Zustand to manage:
- **`currentView`**: Controls which UI overlay is visible (`MENU`, `CHAR_SELECT`, `GAME`, `MULTI_MENU`, etc.).
- **Health & Time**: `playerHealth`, `enemyHealth`, and `timer` sync with the canvas engine.
- **Match Setup**: `player1Char`, `player2Char`, `isMultiplayer`.

#### React Components (`src/components/`)
UI is built strictly in React.
- `App.jsx`: Wrapper displaying either Canvas, UI Overlays, or Menus based on Zustand state.
- `GameCanvas.jsx`: A crucial bridge component with a `useEffect` that initializes the `GameEngine` and watches for cleanup.

#### Engine & Classes (`src/engine/`)
The `GameEngine.js` initializes `Sprites` and `Fighters`, handles collisions, input, networking, and invokes Zustand actions (e.g. `useGameStore.getState().setPlayerHealth()`) to sync data back to the React UI hooks.
- **`Sprite` & `Fighter`**: Core logic is very similar to the old Vanilla version, preserving manual `canvas` drawing and animation states.
- **`Enemy`**: Extends `Fighter` with a Finite State Machine (FSM) AI logic to battle the player in Arcade mode. Features target-finding capabilities, cooldown management, overlap unblocking, and jumping/dodging techniques.
- **`NetworkFighter`**: Extends logic to buffer incoming remote state from PeerJS for smooth multiplayer handling.

### Networking & Multiplayer
Handled via `src/engine/utils/peer.js`.
- Peer connections send state blobs continuously.
- UI elements like `JoinMenu.jsx` and `MultiplayerLobby.jsx` handle connecting logic.

---

### Resolution Model

- The engine runs at a strict internal virtual resolution of `1024x576`.
- React handles the outer container resizing, maintaining the aspect ratio of the Canvas element via CSS properties (`object-fit: contain` / responsive layouts).

