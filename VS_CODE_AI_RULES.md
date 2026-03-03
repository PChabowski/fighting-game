# 🤖 AI Coding Rules for This Project

You are an expert Game Architect. Follow these rules strictly when refactoring or adding features:

## 1. File Structure Consistency

- NEVER add helper functions (like rectangularCollision) into the Fighter or Sprite classes.

- UTILITIES: All generic logic must go to src/utils/.

- CONSTANTS: All magic numbers (gravity, speeds, dimensions) must be imported from src/utils/constants.js.

## 2. Responsive Canvas Policy

- VIRTUAL RESOLUTION: The game logic must ALWAYS run on a fixed internal resolution (e.g., 1024x576).

- NO HARDCODED HEIGHTS: Do not use window.innerHeight inside classes. Use the internal canvas.height.

- SCALING: Scaling for mobile must be done via CSS (object-fit: contain) or canvas.style, NOT by changing the canvas.width attribute in JS, which breaks hitboxes.

## 3. Class Patterns

- Every class must be in its own file in src/classes/.

- Use ES6 Exports/Imports.

- Context (c) and gravity should be passed as arguments or imported, never used as globals.

## 4. Path Mapping

- Assets must be referenced as ../assets/images/ from within src/classes/.