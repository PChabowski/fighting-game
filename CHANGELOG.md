Keep a Changelog
===============

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

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
