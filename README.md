# 🥊 Blood Honor - JS Fighting Game

A modular 2D fighting game built with React, Vite, ES6 modules, Canvas 2D, and an online multiplayer mode powered by PeerJS.

## Version

- Current release: `v2.7.0`

## 🔗 Play Now

The game is live and playable at: [**https://bloodhonor.netlify.app/**](https://bloodhonor.netlify.app/)

## 📁 Project Structure

The project has been refactored into a React/Vite modular architecture utilizing Zustand for pure state management to ensure scalability and clean code management.

```text
.
├── index.html                # Application entry point
├── package.json              # Main project definition and dependencies
├── vite.config.js            # Vite configuration
├── src/
│   ├── App.jsx               # React Main UI View Router
│   ├── components/           # React UI and App Components
│   │   ├── GameCanvas.jsx    # React wrapper for game engine execution
│   │   ├── ...
│   ├── engine/               # Pure Vanilla JS game core logic (Loop, rendering)
│   │   ├── GameEngine.js     # Orchestrator
│   │   ├── classes/          # Logic-related classes (Sprite, Fighter, NetworkFighter)
│   │   └── utils/            # Helper tools, inputs, network, globals
│   ├── store/                # UI States mapping
│   │   └── useGameStore.js   # Zustand single store interface
└── README.md                 # Project documentation
```

## ✨ Features

- **React Architecture**: Fully managed standard modern web app setup.
- **PWA Support**: Installable as a standalone app on iOS, Android, and Desktop with offline caching capabilities.
- Arcade mode with an intelligent FSM-based AI opponent.
- Local PvP and Online multiplayer with Host/Join lobby flow.
- Character selection with shared roster and per-character animations.
- Keyboard, gamepad, and mobile touch controls.
- Responsive canvas with fixed internal resolution (`1024x576`) and CSS scaling.

## Controls

Controls are consistent across modes. The engine maps keyboard and mobile inputs to the local fighter.

- Keyboard:
	- Movement: `A` / `D` (left/right)
	- Jump: `W`
	- Light attack: `Space`
	- Heavy (strong) attack: `E`
	- Dodge: `F`

- Gamepad (recommended mapping):
	- Jump: `A` / D-Pad Up (button 0)
	- Light attack: `X` (button 2)
	- Heavy (strong) attack: `B` / `Circle` (button 1)
	- Dodge: `Y` / `Triangle` or Bumpers (button 3,4,5)

- Mobile/touch overlay:
	- On mobile the on-screen buttons map to the same keys (`A/D` for movement, `J` for jump (maps to `W`), `A` attack (Space), `S` heavy attack (E), `D` dodge (F)).

Gameplay notes:
- Strong attack is a slower, higher-damage attack — use the heavy attack button (`E` / gamepad B) when you have time to commit the move.
- Dodge performs a quick back-step; it now plays the moonwalk/back-step animation and avoids incoming attacks when timed correctly.


## 🛠️ Build and RUN

You can run this project locally:

```bash
npm install
npm run dev
```

*This project was developed for educational purposes. Character sprites for Kenji, Mack, and Akane are property of their respective creators.*
