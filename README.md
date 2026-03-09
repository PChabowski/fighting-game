# 🥊 JS Fighting Game - Kenji vs Mack

A modular 2D fighting game built with pure JavaScript (ES6 modules), Canvas 2D, and an online multiplayer mode powered by PeerJS.

## Version

- Current release: `v1.6.0`

## 🔗 Play Now

The game is live and playable at: [**https://pchabowski-fighting-game.netlify.app/**](https://pchabowski-fighting-game.netlify.app/)

## 📁 Project Structure

The project has been refactored into a modular architecture to ensure scalability and clean code management.

```
.
├── index.html                # Application entry point
├── style.css                 # UI styles (health bars, timer, overlays)
├── assets/
│   └── images/               # Graphical assets (backgrounds and spritesheets)
│       ├── background.png
│       ├── shop.png
│       ├── Kenji/            # Kenji character animations
│       └── Mack/             # Mack character animations
├── src/
│   ├── game.js               # Main game engine (Game Loop, rendering)
│   ├── classes/              # Logic-related classes
│   │   ├── Sprite.js         # Graphic handling and frame animations
│   │   ├── Fighter.js         # Physics, combat, and character mechanics
│   │   └── NetworkFighter.js  # Multiplayer fighter with state interpolation
│   ├── ui/                    # UI components (menu, timer, lobby, overlays)
│   │   ├── GameMenu.js
│   │   ├── MultiplayerMenu.js
│   │   ├── JoinMenu.js
│   │   ├── MultiplayerLobby.js
│   │   ├── CharacterSelect.js
│   │   └── WinModal.js
│   └── utils/                # Helper tools and functions
│       ├── collision.js      # Hitbox detection
│       ├── constants.js      # Constants (Gravity, speed, dimensions)
│       ├── input.js          # Keyboard and Gamepad handling
│       ├── gameLogic.js       # Time management and game state
│       ├── peer.js            # PeerJS connection manager
│       └── roster.js          # Character definitions shared by multiplayer
└── README.md                 # Project documentation
```

## ✨ Features

- Arcade and local PvP game modes.
- Online multiplayer with Host/Join lobby flow.
- Character selection with shared roster and per-character animations.
- Health/timer UI, win modal, rematch, and return-to-menu flow.
- Keyboard, gamepad, and mobile touch controls.
- Responsive canvas with fixed internal resolution (`1024x576`) and CSS scaling.

## 🛠️ Technical Overview

- **ES6 Modules**: The codebase is split into modules, preventing naming conflicts in the global scope and improving maintainability.
- **Sprite Rendering**: `c.save()` and `c.scale()` are used for dynamic character flipping (mirroring) without duplicate directional assets.
- **Gamepad API**: Full controller support with movement, jump, attack, and menu navigation.
- **PeerJS Networking**: Lightweight peer-to-peer session management for online matches.

## 🎮 Controls

### Player 1:

- **Keyboard**: `W` (Jump), `A` / `D` (Move), `Space` (Attack)
- **Gamepad**: D-pad/Left Stick (Move), Button `A` (Jump), Button `X` (Attack)

### Player 2:

- **Keyboard (Local PvP)**: `Up Arrow` (Jump), `Left` / `Right` (Move), `Down Arrow` (Attack)
- **Gamepad**: D-pad/Left Stick (Move), Button `A` (Jump), Button `X` (Attack)

### Multiplayer (Online)

- Both Host and Guest use local controls for their own fighter.
- **Keyboard**: `W` (Jump), `A` / `D` (Move), `Space` (Attack)
- Network sync is handled through PeerJS state exchange.

*This project was developed for educational purposes. Character sprites for Kenji and Mack are property of their respective creators.*
