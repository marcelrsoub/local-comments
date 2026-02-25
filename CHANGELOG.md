# Changelog

All notable changes to the Local Comments extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-02-25

### Added
- **Quick-Fix Menu**: Add comments via the light bulb menu (Ctrl+. or ⌘+.)
- **Right-Click Context Menu**: Add comments from the editor context menu
- **Multi-line Comment Editor**: New webview-based editor with full textarea support
- **Dismissable Hint Banner**: Click × to hide the "To add a comment" hint permanently
- **Keyboard Shortcuts in Editor**: Ctrl+Enter/⌘+Enter to save, Escape to cancel
- **Skip Delete Confirmation**: New `confirmDelete` setting to bypass the confirmation dialog when deleting comments (default: enabled) (@rlebel12)

### Changed
- **Comment Editor UI**: Replaced single-line input box with rich multi-line editor in sidebar
- **Edit Comment Flow**: Editing existing comments now uses the same webview editor
- **Hint Text**: Updated to mention right-click option for selected text

### Fixed
- **Navigation/Edit/Delete on Windows**: Fixed broken click handlers due to unescaped backslashes in file paths
- **Multi-line Comment Display**: Comments with line breaks now display correctly in the sidebar

## [1.0.0] - 2025-08-20

### Added
- **Text Selection Comments**: Comment specific text selections, not just entire lines
- **Rich Sidebar Interface**: Dedicated comments panel in VS Code's native panel layout
- **Real-time Search**: Instant search with highlighting across all comments
- **Timestamp Tracking**: Automatic timestamps for comment creation
- **Stale Comment Detection**: Detect when commented code has changed
- **Extensive Configuration**: Comprehensive settings for all aspects of the extension
- **Native Panel Layout**: Comments sidebar in VS Code's right panel area
- **Smart Sorting**: Intelligent comment ordering to prevent file-based grouping
- **Platform-specific UI**: Proper Alt/⌥ key display for different operating systems
- **Settings Integration**: Gear icon in sidebar for quick access to settings
- **Flexible Save Locations**: Choose between home directory, workspace root, or custom path
- **Custom File Names**: Configurable comments file name
- **Visual Customization**: Customizable highlight colors and status bar appearance
- **Behavior Controls**: Auto-save, notifications, backups, and stale comment handling
- **Status Bar Options**: Support for emojis and codicons in status bar button
- **Keyboard Shortcut**: `Alt+C` (⌥+C on Mac) as official comment creation shortcut
- **Command Palette Integration**: Multiple commands with descriptive titles
- **MIT License**: Open source licensing for the extension

### Changed
- **Sidebar Interface**: Migrated from tree view to rich webview in panel container
- **Comment Data Structure**: Enhanced with support for text span comments and timestamps
- **HTML Generation**: Implemented proper escaping for all dynamic content
- **Sorting Algorithm**: Improved to prevent same-file comment clustering
- **CSS Styling**: Enhanced visual separation between comment cards
- **Date Display**: Empty timestamps now show nothing instead of "No date"
- **Comment Cards**: Better spacing, shadows, and visual separation

### Fixed
- **Comment Grouping**: Resolved visual parent-child relationships in sidebar
- **HTML Structure**: Fixed malformed HTML caused by unescaped code snippets
- **Sorting Logic**: Prevented comments from same file clustering together
- **TypeScript Compilation**: Enhanced type safety and error handling
- **Production Build**: Clean compilation without warnings

### Security
- **HTML Escaping**: Proper sanitization of all user-generated content to prevent XSS

## [0.0.4] and earlier

### Added
- Basic line commenting functionality  
- Status bar integration
- JSON file storage
- Simple comment management

---