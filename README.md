# Local Comments

> **"Commenting code doesn't have to be public"**

Store comments on code locally instead of in the repository. Perfect for personal notes, TODOs, and observations that shouldn't be committed to the codebase.


![gif recording of extension usage](demo1.gif)


## ✨ Features

### 🎯 Comment Types
- **Line Comments**: Comment entire lines of code
- **Text Selection Comments**: Comment specific text selections within lines
- **Timestamp Tracking**: Automatic timestamps for when comments are created

### 🎨 Rich Sidebar Interface
- **Dedicated Panel**: Beautiful comments sidebar in VS Code's native panel layout
- **Real-time Search**: Find comments instantly with highlighting
- **Smart Sorting**: Timestamped comments first, then intelligently mixed to prevent file grouping
- **Inline Actions**: Edit and delete comments directly from the sidebar

### ⚙️ Extensive Configuration
- **Flexible Save Locations**: Home directory, workspace root, or custom path
- **Custom File Names**: Choose your own comments file name
- **Visual Customization**: Configurable highlight colors and status bar appearance
- **Behavior Settings**: Auto-save, notifications, backups, and stale comment detection

### 🚀 Advanced Features  
- **Stale Comment Detection**: Automatically detect when commented code has changed
- **Backward Compatibility**: Seamlessly handles both old line-only and new selection comments
- **Cross-platform**: Works on Windows, macOS, and Linux with platform-specific UI adaptations

## 🎮 Usage

### Quick Start
1. **Add a comment**: Press `Alt+C` (⌥+C on Mac) while your cursor is on any line or select text first
2. **View comments**: Open the Local Comments panel on the right sidebar  
3. **Search**: Use the search box in the sidebar to find specific comments
4. **Manage**: Click Edit/Delete buttons on any comment in the sidebar

### Detailed Workflow

#### Adding Comments
- **Line Comment**: Place cursor on any line → `Alt+C` → Type comment → Enter
- **Selection Comment**: Select text → `Alt+C` → Type comment → Enter

#### Managing Comments
- **Edit**: Click the edit button in the sidebar
- **Delete**: Click the delete button in the sidebar or clear the text when editing
- **Navigate**: Click any comment in the sidebar to jump to that location

#### Organization
- Comments are automatically sorted with timestamped ones first
- Search instantly filters comments across all files
- Each comment shows file location, timestamp (if available), and code snippet

## ⚙️ Configuration

Access settings and customize keybindings for Local Comments in VS Code:
- **Settings**: Command Palette → "Local Comments: Open Settings" or click the gear icon in the sidebar
- **Keybindings**: File → Preferences → Keyboard Shortcuts → Search for "Local Comments"

### Storage Options
```json
{
  "localComments.saveLocation": "home",  // "home" | "workspace" | "custom"
  "localComments.customFilePath": "",    // When using "custom"
  "localComments.fileName": "local-comments.json"
}
```

### Visual Customization  

![icon in status bar](demo3.png)


```json
{
  "localComments.highlightColor": "rgba(255, 255, 0, 0.3)",
  "localComments.showStatusBarButton": true,
  "localComments.statusBarButtonText": "💭"  // Can use emoji or codicons like "$(comment)"
}
```

### Behavior Settings
```json
{
  "localComments.autoSave": true,
  "localComments.showNotifications": true, 
  "localComments.backupEnabled": false,
  "localComments.hideStaleComments": true
}
```

## 🗂️ File Format

Comments are stored as JSON with full metadata:

```json
{
  "/path/to/file.js": [
    {
      "id": "unique-id",
      "text": "This needs refactoring",
      "timestamp": 1755698292758,
      "range": {
        "startLine": 42,
        "startCharacter": 0,
        "endLine": 42,
        "endCharacter": 9007199254740991,
        "selectedText": "function complexLogic() {"  // Only for selection comments
      }
    }
  ]
}
```

## 📝 Changelog

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

**Enjoy coding with your personal comment system!** 🎉