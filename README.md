# 🥊 JS Fighting Game - Kenji vs Mack

A professional 2D fighting game built with pure JavaScript, utilizing Object-Oriented Programming (OOP) and modern ES6 modules.

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
│   │   └── Fighter.js        # Physics, combat, and character mechanics
│   └── utils/                # Helper tools and functions
│       ├── collision.js      # Hitbox detection
│       ├── constants.js      # Constants (Gravity, speed, dimensions)
│       ├── input.js          # Keyboard and Gamepad handling
│       └── gameLogic.js      # Time management and game state
└── README.md                 # Project documentation
```

## 🛠️ Technical Overview

- **ES6 Modules**: The codebase is split into modules, preventing naming conflicts in the global scope and improving maintainability.
- **Sprite Rendering**: Advanced `c.save()` and `c.scale()` implementation allows for dynamic character flipping (mirroring) without the need for separate assets for both directions.
- **Gamepad API**: Full controller support is implemented, mapping analog stick axes for movement and buttons for jumping and attacking actions.

## 🎮 Controls

### Player 1:

- **Keyboard**: `W` (Jump), `A` / `D` (Move), `Space` (Attack)
- **Gamepad**: D-pad/Left Stick (Move), Button `A` (Jump), Button `X` (Attack)

### Player 2:

- **Keyboard**: `Up Arrow` (Jump), `Left` / `Right` (Move), `M` (Attack)
- **Gamepad**: D-pad/Left Stick (Move), Button `A` (Jump), Button `X` (Attack)

*This project was developed for educational purposes. Character sprites for Kenji and Mack are property of their respective creators.*