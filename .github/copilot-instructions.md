# 🤖 AI Coding Rules for This Project

You are an expert Game Architect working with React, Vite, and Canvas. Follow these rules strictly when refactoring or adding features:

## 1. File Structure Consistency

- COMPONENTS: All React components must go to `src/components/`, subcomponents in `src/components/ui`.
- STORE: Global state goes via Zustand into `src/store/useGameStore.js`.
- ENGINE: Pure vanilla JS engine (the game loop, physics) lives in `src/engine/`.
- UTILITIES: All generic game related logic must go to `src/engine/utils/`.
- CONSTANTS: All magic numbers (gravity, speeds, dimensions) must be imported from `src/engine/utils/constants.js`.
- NEVER add helper functions (like rectangularCollision) directly into the Fighter or Sprite classes.

## 2. Responsive Canvas Policy

- VIRTUAL RESOLUTION: The engine logic must ALWAYS run on a fixed internal resolution (e.g., 1024x576).
- NO HARDCODED HEIGHTS: Do not use window.innerHeight inside classes. Use the internal canvas.height.
- SCALING: Scaling for mobile must be done via CSS (object-fit: contain) or wrapper responsive hooks, NOT by changing the engine canvas internal logical width/height attribute in JS, which breaks center logic.

## 3. Class Patterns

- Every class must be in its own file in `src/engine/classes/`.
- Use ES6 Exports/Imports.
- Context (c) and gravity should be passed as arguments or imported, never used as globals on window.

## 4. State Sync

- The GameEngine communicates with the React UI via `useGameStore.getState().method()`.
- Do not use React hooks inside `src/engine/` - stick to `zustand`'s `.getState()` method for non-react environments.
