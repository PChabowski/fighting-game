Keep a Changelog
===============

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning.

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
