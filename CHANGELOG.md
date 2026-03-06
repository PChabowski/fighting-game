Keep a Changelog
===============

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

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
