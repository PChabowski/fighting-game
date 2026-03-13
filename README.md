# 🥊 Blood Honor - JS Fighting Game

A modular 2D fighting game built with React, Vite, ES6 modules, Canvas 2D, and an online multiplayer mode powered by PeerJS.

## Version

- Current release: `v2.3.0`

## 🔗 Play Now

The game is live and playable at: [**https://pchabowski-fighting-game.netlify.app/**](https://pchabowski-fighting-game.netlify.app/)

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

## 🛠️ Build and RUN

You can run this project locally:

```bash
npm install
npm run dev
```

*This project was developed for educational purposes. Character sprites for Kenji, Mack, and Akane are property of their respective creators.*
