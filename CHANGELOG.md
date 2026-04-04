Keep a Changelog
===============

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

## [2.6.0] - 2026-03-16

## [2.7.0] - 2026-04-04

### Added
- Platform texture support and updated platform scenes (`src/engine/scenes/*`) to accept textures and interactions.
- Dodge/back-step animation (moonwalk) and improved dodge behavior for fighters.
- Preparatory groundwork for platform interactions (control takeover, flag pickup mechanics).

### Fixed
- Restore strong attack sound and correct strong attack timing/behavior (`src/engine/classes/Fighter.js`).
- Fix mobile main menu touch handling after match end (`src/components/GameInterface.jsx`).
- Various engine, input and networking improvements to stabilize gameplay and animations.


## [2.6.1] - 2026-03-17

### Fixed
- Improved native mobile scrolling for `Authors` and `Privacy` pages; added bottom padding to avoid hidden footer content.
- Updated authors list: removed LavaFlame2 and added Artem Brullov.

### Added
- Added Google Search Console verification meta tag to `index.html`.


### Added
- React Router integration with two static pages: `/authors` and `/privacy`.
- Cookie consent banner with settings modal and persistent preferences (localStorage).
- Dynamic Google Analytics loading (gtag.js) — analytics disabled by default and loaded only after user consent.

### Changed
- Stabilized main views to avoid remounting the game canvas (prevents HP rollback/visual flash during navigation).
- Mobile-friendly cookie banner layout and UI polish.

## [2.5.0] - 2026-03-15

### Added
- Added Google Analytics `gtag.js` tag to `index.html` to enable site analytics collection.

### Changed
- Prepared release for deployment: bumped package version to `2.5.0`.

## [2.4.0] - 2026-03-13

### Added
- **Mirror Match Mode**: Added dark/shadow tinting (`grayscale(100%) brightness(75%) contrast(120%)`) for Player 2 (or AI) when both players select the same character, improving visual clarity in both Arcade and PVP modes.

## [2.3.0] - 2026-03-13

### Added
- **Intelligent FSM-based AI Opponent**: Added the `Enemy` class extending `Fighter` to serve as a smart bot in the updated Arcade Mode.
- **AI Behaviors**: The bot utilizes a Finite State Machine to transition between states: `APPROACH`, `ATTACK`, `RETREAT`, and `IDLE`.
- **Advanced Combat Tactics**: 
  - Dynamic orientation tracking prevents the bot from "moonwalking" or attacking backward.
  - Active overlap repulsion prevents the bot from getting stuck inside the player and missing attacks.
  - The AI smartly utilizes jumps to occasionally close long distances, counter aggressive play, or dodge tight collisions.
- The `useGameStore` now distinguishes between `PVP` and `ARCADE` game modes.

### Fixed
- Fixed an issue where receiving hits (`takeHit`) could interrupt normal attack loop resets in `Fighter.js`, causing the attacker to ghost-attack and permanently freeze. `takeHit` now firmly overrides `isAttacking`.

## [2.2.3] - 2026-03-13

### Fixed
- Fixed the `MobileOrientationModal` issue where installed PWA apps on Android were incorrectly prompted to activate Fullscreen mode. The modal now intelligently detects PWA `standalone`/`fullscreen` display modes and suppresses unnecessary browser API requests.

## [2.2.2] - 2026-03-13

### Changed
- Unified keyboard controls in Multiplayer mode: both Host and Guest now use `W, A, S, D` and `Space` for movement and attacking. Arrow keys are now ignored during online matches to prevent control conflicts.

### Fixed
- Fixed mobile controls for Guest players in Multiplayer mode by routing input globally to the modernized WASD engine mapping.
- Added a fallback copy method for the "Copy ID" button in the Multiplayer Lobby to support browsers connecting via local network HTTP (non-secure context).
- Fixed input delay on mobile touch controls by adding `touch-action: manipulation`, disabling the browser's native double-tap zoom delay on game buttons.

## [2.2.1] - 2026-03-13

### Fixed
- Fixed and updated texture sprites for **Akane** (`Attack1`, `Death`, `Run`, `Take hit`) to improve animation fidelity.

## [2.2.0] - 2026-03-12

### Added
- **PWA Support**: The game can now be installed as a standalone full-screen application on mobile (iOS/Android) and desktop environments.
- **Offline Mode**: Enabled basic offline play using Service Worker caching for assets and engine logic.
- **Update Notification**: Added `UpdateModal` to inform users when a new version of the game is available without abruptly refreshing the page.

### Changed
- Fixed viewport interactions on mobile by adding `touch-action: none` and `user-select: none` to the CSS, preventing unwanted browser scrolling and zoom gestures during gameplay.

## [2.1.0] - 2026-03-12

### Changed
- Game officially renamed to **Blood Honor** (previously generic "Fighting Game").
- Updated application window title (`index.html`), documentations (`README.md`), and NPM config (`package.json`) to reflect the new identity branding.


### Changed
- Complete refactoring from Vanilla JS to React 19 + Vite architecture.
- Replaced manual custom UI with React-based `.jsx` component structure utilizing Zustand for global state management.
- Changed main entry component to `App.jsx` instead of raw `index.html` loading single module.
- Centralized versioning system directly to use `package.json` integrated via Vite Environment `define` plugin, eliminating manual `.js` file modification flow.


## [1.6.0] - 2026-03-09

### Added
- Updated fighter damage handling and roster configuration for improved gameplay.

## [1.5.0] - 2026-03-08

### Added
- Added immersive attack sound effects (`swosh`) to the `Fighter` class using `AudioManager`.
- Added a suite of randomly selected swosh sound effect files for varied attack feedback.

## [1.4.0] - 2026-03-08

### Added
- Added `AudioManager` to handle background music for menus and fights smoothly, overcoming browser autoplay policies.
- Automatically switches between "Stage 1" music for menus and "Boss Fight" music when the game is played.
- Implemented HTML5 Audio integration triggered by the first player interaction.

## [1.3.3] - 2026-03-08

### Added
- Synchronized "Return to Menu" functionality across peers during multiplayer matches. Returning to the main menu immediately disconnects the peer and properly brings the remote guest back to the lobby or main menu logic.

## [1.3.2] - 2026-03-08

### Changed
- Improved `MultiplayerLobby` layout, centering buttons ("Leave Lobby" and "Start Game") side-by-side with appropriate spacing. Guest's "Start Game" button is now hidden properly to keep "Leave Lobby" perfectly centered.
- Pressing "Enter" in the `JoinMenu` now automatically attempts to connect instead of requiring a button click.

### Fixed
- Fixed backward navigation: `JoinMenu` and `MultiplayerLobby` now correctly return to `MultiplayerMenu` without reloading the entire page. Implemented `peerManager.disconnect()` for safe connection cleanup.
- Synchronized Host character selection to Guests on join, avoiding "None" glitches.
- Fixed rematch desynchronization issues. Both `Fighter` and `NetworkFighter`'s `restart` mechanisms were updated to forcefully stop old attack states and animation tracking. NetworkFighter safely ignores old packets slightly after reset.
- Refactored attack registration for Guest in Multiplayer. Attacks are now handled locally, enforcing hit logic on standard and remote clients, followed by broadcasting hit confirmation to the peer instead of relying entirely on remote bounding-box responses.

## [1.3.1] - 2026-03-08

### Added
- Full gamepad navigation support for online multiplayer menus (`MultiplayerMenu`, `JoinMenu`, and `MultiplayerLobby`).

### Fixed
- Fixed bug where gamepad movement (walking) was broken in generic local PvP / Arcade modes caused by over-resetting keys each frame. 
- Resolved issue in Online Multiplayer where gamepads were hardcoded to control Player 1 (Host). Gamepads now dynamically control local fighters based on connection logic.
- Prevented gamepad state resets from blocking or conflicting with keyboard actions logic using a dedicated tracking property (`gpMoved`).

## [1.3.0] - 2026-03-06

### Added
- Online multiplayer mode with PeerJS integration (Host / Join flow).
- New networking layer: `NetworkFighter` for remote state sync and interpolation.
- New multiplayer UI flow: `MultiplayerMenu`, `JoinMenu`, and `MultiplayerLobby`.
- Shared fighter roster configuration in `src/utils/roster.js` for multiplayer character setup.

### Changed
- Main menu now includes a `Multiplayer` option and routes users to online session setup.
- `game.js` updated to handle host/guest roles, state broadcasting, remote updates, and lobby-driven match start.
- Win modal behavior improved for multiplayer flow (rematch and return handling).

### Fixed
- Rematch logic in multiplayer games is now stable and synchronized between peers.
- Mobile controls were adjusted for multiplayer so only the local fighter is controlled.
- Input handling now prevents dead fighters from moving/attacking in both single and multiplayer modes.

## [1.2.0] - 2026-03-06

### Added
- Mobile Orientation Modal to enforce landscape and fullscreen mode for better UX.

### Changed
- Mobile Orientation Modal now automatically reappears when the player exits fullscreen or switches to portrait mode on mobile devices.

## [1.1.0] - 2026-03-05

### Added
- Character selection UI (`CharacterSelect`) and mode choices (Arcade / PvP).
- New `GameMenu` component for the start menu and game mode selection.
- UI components: `GameInterface`, `HealthBar`, `Timer`, `WinModal`, and `ActionButton`.
- Mobile controls support and responsive canvas utilities (`mobile`, `responsive`, `scale`).

### Changed
- Main menu flow refactored: menu is now provided by `GameMenu` and overlays the canvas.
- Canvas rendering pipeline adjusted to support fixed internal resolution (1024x576) with CSS scaling.

### Fixed
- Gamepad focus handling and navigation across `CharacterSelect`, `GameMenu`, and `WinModal`.
- Timer handling and restart flow to ensure timer updates correctly on rematch/return-to-menu.

---

For detailed commit history, see the `fix-control` branch.
