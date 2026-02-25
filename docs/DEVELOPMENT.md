# Development Setup

This guide covers local development setup for contributing to Local Comments.

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager

## Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/marcelrsoub/local-comments.git
   cd local-comments
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

## Development Workflow

### Compile and Watch

For continuous compilation during development:
```bash
yarn watch
```

### One-time Compile

```bash
yarn compile
```

### Lint

Check for code issues:
```bash
yarn lint
```

### Production Build

Build the minified production version:
```bash
yarn package
```

## Testing the Extension Locally

### Method 1: Launch VS Code with Extension

Run VS Code with the extension loaded in development mode:

```bash
code --extensionDevelopmentPath="$PWD" .
```

Or with an absolute path:

```bash
code --extensionDevelopmentPath="/path/to/local-comments" .
```

After making code changes:
1. Run `yarn compile` to rebuild
2. Reload the Extension Development Host window:
   - `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
   - Type "Developer: Reload Window"
   - Press Enter

### Method 2: F5 Debug Mode

1. Open the project in VS Code
2. Press `F5` to launch Extension Development Host
3. Make changes in the original VS Code window
4. Reload the Extension Development Host to see changes

### Method 3: Watch Mode + F5

For the fastest development cycle:

1. Start watch mode in terminal:
   ```bash
   yarn watch
   ```

2. In VS Code, press `F5` to launch Extension Development Host

3. Make changes - they will compile automatically

4. Reload the Extension Development Host to see changes

## Project Structure

```
local-comments/
├── src/
│   └── extension.ts      # Main extension code
├── dist/
│   └── extension.js      # Compiled extension (generated)
├── media/
│   └── icon.png          # Sidebar icon
├── docs/                 # Documentation
├── package.json          # Extension manifest and configuration
├── tsconfig.json         # TypeScript configuration
├── webpack.config.js     # Webpack build configuration
├── CHANGELOG.md          # Version history
└── README.md             # Extension overview
```

## Key Files

- **`src/extension.ts`**: Contains all extension logic including:
  - Comment storage and management
  - Sidebar webview rendering
  - Editor decorations
  - Command handlers

- **`package.json`**: Defines:
  - Extension metadata
  - Commands and keybindings
  - Configuration options
  - Menu contributions

## Configuration Options

The extension supports various settings (defined in `package.json`):

- `localComments.saveLocation`: Where to store comments (home/workspace/custom)
- `localComments.highlightColor`: Background color for commented lines
- `localComments.showStatusBarButton`: Show/hide status bar button
- `localComments.confirmDelete`: Confirmation dialog before deleting
- And more...

## Debugging

### View Extension Logs

Open the Output panel and select "Local Comments" from the dropdown.

### Webview Developer Tools

To inspect the sidebar webview:
1. Open the Local Comments sidebar
2. `Cmd+Shift+P` → "Open Webview Developer Tools"
3. Inspect HTML, CSS, and JavaScript

### Common Issues

**Extension not loading**: Ensure `yarn compile` ran successfully and check the Output panel for errors.

**Changes not visible**: Reload the Extension Development Host window after compiling.

**Webview not updating**: The webview HTML is regenerated on each `refreshSidebar()` call. Check the browser console in Webview Developer Tools.
