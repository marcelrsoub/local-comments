import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CommentRange {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
    selectedText?: string; // Optional - only for text span comments
}

interface Comment {
    range: CommentRange;
    text: string;
    id: string; // Unique identifier for each comment
    timestamp?: number; // Optional timestamp when comment was created
}

interface CommentData {
    [fileName: string]: Comment[];
}

interface PendingComment {
    fileName: string;
    range: CommentRange;
    existingCommentId?: string;
    existingText?: string;
}

const commentData: CommentData = {};
let pendingComment: PendingComment | undefined = undefined;

function getCommentFilePath(): string {
    const config = vscode.workspace.getConfiguration('localComments');
    const saveLocation = config.get<string>('saveLocation', 'home');
    const fileName = config.get<string>('fileName', 'local-comments.json');
    
    switch (saveLocation) {
        case 'workspace':
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                return path.join(workspaceFolder.uri.fsPath, fileName);
            }
            // Fall back to home if no workspace
            return path.join(os.homedir(), fileName);
        case 'custom':
            const customPath = config.get<string>('customFilePath', '');
            if (customPath) {
                return path.isAbsolute(customPath) ? customPath : path.join(os.homedir(), customPath);
            }
            // Fall back to home if custom path is empty
            return path.join(os.homedir(), fileName);
        case 'home':
        default:
            return path.join(os.homedir(), fileName);
    }
}

function loadComments() {
    const commentFilePath = getCommentFilePath();
    if (fs.existsSync(commentFilePath)) {
        const fileData = fs.readFileSync(commentFilePath, 'utf-8');
        try {
            const parsedData = JSON.parse(fileData);
            
            // Handle backward compatibility with old format
            for (const [fileName, fileComments] of Object.entries(parsedData)) {
                if (Array.isArray(fileComments)) {
                    // New format - array of Comment objects
                    commentData[fileName] = fileComments as Comment[];
                } else {
                    // Old format - object with line numbers as keys
                    const oldComments = fileComments as { [lineNumber: number]: string };
                    commentData[fileName] = [];
                    
                    for (const [lineNumberStr, commentText] of Object.entries(oldComments)) {
                        const lineNumber = parseInt(lineNumberStr) - 1; // Convert to 0-based
                        const newComment: Comment = {
                            id: generateCommentId(),
                            text: commentText,
                            // Don't set timestamp for migrated comments
                            range: {
                                startLine: lineNumber,
                                startCharacter: 0,
                                endLine: lineNumber,
                                endCharacter: Number.MAX_SAFE_INTEGER, // Span entire line
                                // Don't set selectedText for migrated line comments
                            }
                        };
                        commentData[fileName].push(newComment);
                    }
                }
            }
        } catch (err) {
            console.error('❌ Failed to parse comments file:', err);
        }
    }
}

function createBackupIfEnabled(filePath: string) {
    const config = vscode.workspace.getConfiguration('localComments');
    const backupEnabled = config.get<boolean>('backupEnabled', false);
    
    if (backupEnabled && fs.existsSync(filePath)) {
        const backupPath = `${filePath}.backup`;
        try {
            fs.copyFileSync(filePath, backupPath);
        } catch (err) {
            console.error('❌ Failed to create backup:', err);
        }
    }
}

function saveComments() {
    const config = vscode.workspace.getConfiguration('localComments');
    const showNotifications = config.get<boolean>('showNotifications', true);
    const commentFilePath = getCommentFilePath();
    
    try {
        // Ensure directory exists
        const dir = path.dirname(commentFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        createBackupIfEnabled(commentFilePath);
        fs.writeFileSync(commentFilePath, JSON.stringify(commentData, null, 2));
        
        if (showNotifications) {
            vscode.window.showInformationMessage(`💾 Saved to ${commentFilePath}`);
        }
    } catch (err) {
        console.error('❌ Failed to save comments file:', err);
        vscode.window.showErrorMessage(`Failed to save comments: ${err}`);
    }
}

loadComments();

function createDecorationType(): vscode.TextEditorDecorationType {
    const config = vscode.workspace.getConfiguration('localComments');
    const highlightColor = config.get<string>('highlightColor', 'rgba(255, 255, 0, 0.3)');
    
    return vscode.window.createTextEditorDecorationType({
        backgroundColor: highlightColor
    });
}

let decorationType = createDecorationType();

function createStatusBarButton(): vscode.StatusBarItem | null {
    const config = vscode.workspace.getConfiguration('localComments');
    const showStatusBarButton = config.get<boolean>('showStatusBarButton', true);
    
    if (!showStatusBarButton) {
        return null;
    }
    
    const statusBarButtonText = config.get<string>('statusBarButtonText', 'media/icon.png');
    const statusBarBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarBtn.text = statusBarButtonText;
    statusBarBtn.tooltip = "Show Local Comments";
    statusBarBtn.command = 'localComments.focus';
    statusBarBtn.show();
    return statusBarBtn;
}

let statusBarBtn = createStatusBarButton();

function updateDecorations() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const config = vscode.workspace.getConfiguration('localComments');
        const hideStaleComments = config.get<boolean>('hideStaleComments', true);
        
        const decorations: vscode.DecorationOptions[] = [];
        const fileName = activeEditor.document.fileName;
        const commentsForFile = commentData[fileName];
        
        if (commentsForFile) {
            for (const comment of commentsForFile) {
                // Check if we should validate comment freshness
                if (hideStaleComments && !isCommentStillValid(comment, activeEditor.document)) {
                    continue; // Skip stale comments
                }
                
                const range = new vscode.Range(
                    comment.range.startLine,
                    comment.range.startCharacter,
                    comment.range.endLine,
                    comment.range.endCharacter
                );
                
                // Create hover message with formatted comment and timestamp
                const hoverMessage = new vscode.MarkdownString();
                hoverMessage.appendMarkdown(`**Local Comments:** ${comment.text}`);
                
                // Add timestamp if present
                if (comment.timestamp) {
                    const date = new Date(comment.timestamp);
                    const formattedDate = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    hoverMessage.appendMarkdown(`\n\n*${formattedDate}*`);
                }
                
                // Add validation status if not hiding stale comments
                if (!hideStaleComments && !isCommentStillValid(comment, activeEditor.document)) {
                    const validationType = comment.range.selectedText ? "the original text has changed" : "the line no longer exists";
                    hoverMessage.appendMarkdown(`\n\n⚠️ *This comment may be outdated - ${validationType}.*`);
                }
                
                const decoration = { 
                    range, 
                    hoverMessage: hoverMessage
                };
                decorations.push(decoration);
            }
        }
        activeEditor.setDecorations(decorationType, decorations);
    }
}

updateDecorations();

vscode.window.onDidChangeActiveTextEditor(updateDecorations);

vscode.workspace.onDidChangeTextDocument((event) => {
    if (event.document === vscode.window.activeTextEditor?.document) {
        updateDecorations();
    }
});

function generateCommentId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function isCommentStillValid(comment: Comment, document: vscode.TextDocument): boolean {
    try {
        const range = new vscode.Range(
            comment.range.startLine,
            comment.range.startCharacter,
            comment.range.endLine,
            comment.range.endCharacter
        );
        
        // Check if the range is still valid in the document
        if (range.end.line >= document.lineCount) {
            return false;
        }
        
        // If this is a line-only comment (no selectedText), just check if the line exists
        if (!comment.range.selectedText) {
            return comment.range.startLine < document.lineCount;
        }
        
        // For text-span comments, compare the actual text
        const currentText = document.getText(range);
        
        // Compare with the originally commented text
        // We'll be flexible with whitespace and line endings
        const normalizeText = (text: string) => text.trim().replace(/\s+/g, ' ');
        const currentNormalized = normalizeText(currentText);
        const originalNormalized = normalizeText(comment.range.selectedText);
        
        return currentNormalized === originalNormalized;
    } catch (error) {
        // If there's any error (invalid range, etc.), consider it stale
        return false;
    }
}

function findExistingCommentForRange(fileName: string, range: vscode.Range): Comment | undefined {
    const fileComments = commentData[fileName];
    if (!fileComments) {
        return undefined;
    }
    
    return fileComments.find(comment => 
        comment.range.startLine === range.start.line &&
        comment.range.startCharacter === range.start.character &&
        comment.range.endLine === range.end.line &&
        comment.range.endCharacter === range.end.character
    );
}

function openCommentInput() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }
    
    const selection = activeEditor.selection;
    const fileName = activeEditor.document.fileName;
    
    let range: vscode.Range;
    let selectedText: string | undefined;
    
    if (selection.isEmpty) {
        const line = activeEditor.document.lineAt(selection.active.line);
        range = new vscode.Range(line.range.start, line.range.end);
        selectedText = undefined;
    } else {
        range = new vscode.Range(selection.start, selection.end);
        selectedText = activeEditor.document.getText(selection);
    }
    
    const existingComment = findExistingCommentForRange(fileName, range);
    
    pendingComment = {
        fileName,
        range: {
            startLine: range.start.line,
            startCharacter: range.start.character,
            endLine: range.end.line,
            endCharacter: range.end.character,
            selectedText
        },
        existingCommentId: existingComment?.id,
        existingText: existingComment?.text
    };
    
    refreshSidebar();
    vscode.commands.executeCommand('localComments.focus');
}

function savePendingComment(text: string) {
    if (!pendingComment) {
        return;
    }
    
    const config = vscode.workspace.getConfiguration('localComments');
    const autoSave = config.get<boolean>('autoSave', true);
    const { fileName, range, existingCommentId } = pendingComment;
    
    if (text.trim() === '') {
        if (existingCommentId) {
            const fileComments = commentData[fileName];
            const index = fileComments?.findIndex(c => c.id === existingCommentId);
            if (index !== undefined && index !== -1) {
                fileComments.splice(index, 1);
                if (fileComments.length === 0) {
                    delete commentData[fileName];
                }
            }
        }
    } else {
        commentData[fileName] = commentData[fileName] || [];
        
        if (existingCommentId) {
            const existing = commentData[fileName].find(c => c.id === existingCommentId);
            if (existing) {
                existing.text = text;
                if (range.selectedText !== undefined) {
                    existing.range.selectedText = range.selectedText;
                }
            }
        } else {
            const newComment: Comment = {
                id: generateCommentId(),
                text: text,
                timestamp: Date.now(),
                range: {
                    startLine: range.startLine,
                    startCharacter: range.startCharacter,
                    endLine: range.endLine,
                    endCharacter: range.endCharacter,
                    selectedText: range.selectedText
                }
            };
            commentData[fileName].push(newComment);
        }
    }
    
    pendingComment = undefined;
    updateDecorations();
    if (autoSave) {
        saveComments();
    }
    refreshSidebar();
}

function cancelPendingComment() {
    pendingComment = undefined;
    refreshSidebar();
}

function openSettings() {
    vscode.commands.executeCommand('workbench.action.openSettings', 'localComments');
}

class CommentTreeItem extends vscode.TreeItem {
    constructor(
        public readonly fileName: string,
        public readonly comment: Comment,
        public readonly relativePath: string,
        public readonly lineNumber: number
    ) {
        const label = `${relativePath}:${lineNumber}`;
        super(label, vscode.TreeItemCollapsibleState.None);
        
        this.description = comment.text;
        this.tooltip = this.getTooltip();
        this.contextValue = 'comment';
        this.command = {
            command: 'local-comments.navigateToComment',
            title: 'Go to Comment',
            arguments: [fileName, comment.range.startLine, comment.range.startCharacter]
        };
        
        // Add timestamp if available
        if (comment.timestamp) {
            const date = new Date(comment.timestamp);
            this.resourceUri = vscode.Uri.parse(`comment:${comment.id}`);
        }
    }
    
    private getTooltip(): string {
        let tooltip = `Comment: ${this.comment.text}\nFile: ${this.relativePath}\nLine: ${this.lineNumber}`;
        
        if (this.comment.timestamp) {
            const date = new Date(this.comment.timestamp);
            tooltip += `\nCreated: ${date.toLocaleString()}`;
        }
        
        if (this.comment.range.selectedText) {
            tooltip += `\nOriginal text: ${this.comment.range.selectedText}`;
        }
        
        return tooltip;
    }
}

class CommentsTreeDataProvider implements vscode.TreeDataProvider<CommentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<CommentTreeItem | undefined | null | void> = new vscode.EventEmitter<CommentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<CommentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: CommentTreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: CommentTreeItem): Thenable<CommentTreeItem[]> {
        if (!element) {
            // Root level - return all comments
            const allComments: CommentTreeItem[] = [];
            
            for (const [fileName, comments] of Object.entries(commentData)) {
                for (const comment of comments) {
                    const relativePath = vscode.workspace.asRelativePath(fileName);
                    const lineNumber = comment.range.startLine + 1;
                    allComments.push(new CommentTreeItem(fileName, comment, relativePath, lineNumber));
                }
            }
            
            // Sort by timestamp, then by filename and line to break ties
            allComments.sort((a, b) => {
                const aTime = a.comment.timestamp || 0;
                const bTime = b.comment.timestamp || 0;
                
                // Primary sort: timestamp (newest first)
                if (aTime !== bTime) {
                    return bTime - aTime;
                }
                
                // Secondary sort: filename (alphabetical)
                const fileCompare = a.fileName.localeCompare(b.fileName);
                if (fileCompare !== 0) {
                    return fileCompare;
                }
                
                // Tertiary sort: line number
                return a.comment.range.startLine - b.comment.range.startLine;
            });
            
            return Promise.resolve(allComments);
        }
        
        return Promise.resolve([]);
    }
}

const commentsTreeDataProvider = new CommentsTreeDataProvider();

let sidebarWebview: vscode.WebviewView | undefined = undefined;
let extensionContext: vscode.ExtensionContext | undefined = undefined;

function createSidebarHTML(showHint: boolean = true): string {
    const allComments: Array<{fileName: string, comment: Comment}> = [];
    
    // Collect all comments from all files
    for (const [fileName, comments] of Object.entries(commentData)) {
        for (const comment of comments) {
            allComments.push({ fileName, comment });
        }
    }
    
    // Separate timestamped and non-timestamped comments
    const timestampedComments = allComments.filter(item => item.comment.timestamp);
    const nonTimestampedComments = allComments.filter(item => !item.comment.timestamp);
    
    // Sort timestamped comments by timestamp (newest first)
    timestampedComments.sort((a, b) => b.comment.timestamp! - a.comment.timestamp!);
    
    // Shuffle non-timestamped comments to prevent any file-based grouping
    for (let i = nonTimestampedComments.length - 1; i > 0; i--) {
        // Create deterministic shuffle based on comment properties to avoid random results on each render
        const hash = (nonTimestampedComments[i].comment.id + nonTimestampedComments[i].fileName).split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        const j = Math.abs(hash) % (i + 1);
        [nonTimestampedComments[i], nonTimestampedComments[j]] = [nonTimestampedComments[j], nonTimestampedComments[i]];
    }
    
    // Interleave: start with timestamped, then mix in non-timestamped
    const result: Array<{fileName: string, comment: Comment}> = [];
    let tIndex = 0, nIndex = 0;
    
    while (tIndex < timestampedComments.length || nIndex < nonTimestampedComments.length) {
        // Add timestamped comment first
        if (tIndex < timestampedComments.length) {
            result.push(timestampedComments[tIndex++]);
        }
        
        // Add 1-2 non-timestamped comments to break up patterns
        const addCount = Math.min(2, nonTimestampedComments.length - nIndex);
        for (let i = 0; i < addCount && nIndex < nonTimestampedComments.length; i++) {
            result.push(nonTimestampedComments[nIndex++]);
        }
    }
    
    // Use the interleaved result
    allComments.length = 0;
    allComments.push(...result);
    
    const commentsHTML = allComments.map(({fileName, comment}, index) => {
        const relativePath = vscode.workspace.asRelativePath(fileName);
        const timestamp = comment.timestamp ? new Date(comment.timestamp).toLocaleString() : '';
        const lineNumber = comment.range.startLine + 1;
        const codeSnippet = comment.range.selectedText ? 
            comment.range.selectedText.substring(0, 50) + (comment.range.selectedText.length > 50 ? '...' : '') :
            `Line ${lineNumber}`;
        
        const escapeHtml = (str: string) => {
            return str.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#39;');
        };
        
        const escapeJsString = (str: string) => {
            return str.replace(/\\/g, '\\\\')
                     .replace(/'/g, "\\'")
                     .replace(/"/g, '\\"')
                     .replace(/\n/g, '\\n')
                     .replace(/\r/g, '\\r');
        };
        
        const escapedText = escapeHtml(comment.text);
        const escapedSnippet = escapeHtml(codeSnippet);
        const escapedPath = escapeHtml(relativePath);
        const escapedFileName = escapeJsString(fileName);
        const escapedCommentId = escapeJsString(comment.id);
        
        return `<div class="comment-item comment-${index}" data-comment-id="${comment.id}" data-file="${fileName}" onclick="navigateToComment('${escapedFileName}', ${comment.range.startLine}, ${comment.range.startCharacter})"><div class="comment-header"><span class="file-name">${escapedPath}:${lineNumber}</span><span class="timestamp">${timestamp}</span></div><div class="comment-text">${escapedText}</div><div class="code-snippet">${escapedSnippet}</div><div class="comment-actions"><button onclick="editComment(event, '${escapedCommentId}', '${escapedFileName}')">Edit</button><button onclick="deleteComment(event, '${escapedCommentId}', '${escapedFileName}')">Delete</button></div></div>`;
    }).join('\n');
    
    let editorHTML = '';
    if (pendingComment) {
        const relativePath = vscode.workspace.asRelativePath(pendingComment.fileName);
        const lineNumber = pendingComment.range.startLine + 1;
        const codeSnippet = pendingComment.range.selectedText ? 
            pendingComment.range.selectedText.substring(0, 100) + (pendingComment.range.selectedText.length > 100 ? '...' : '') :
            undefined;
        
        const escapeHtml = (str: string) => {
            return str.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#39;');
        };
        
        const escapeJsString = (str: string) => {
            return str.replace(/\\/g, '\\\\')
                     .replace(/'/g, "\\'")
                     .replace(/"/g, '\\"')
                     .replace(/\n/g, '\\n')
                     .replace(/\r/g, '\\r');
        };
        
        const escapedPath = escapeHtml(relativePath);
        const escapedSnippet = codeSnippet ? escapeHtml(codeSnippet) : '';
        const escapedExistingText = pendingComment.existingText ? escapeJsString(pendingComment.existingText) : '';
        
        editorHTML = `<div class="comment-editor">
            <div class="editor-header">
                <span class="file-info">${escapedPath}:${lineNumber}</span>
                <button class="close-btn" onclick="cancelComment()" title="Cancel">×</button>
            </div>
            ${codeSnippet ? `<div class="editor-code-preview">${escapedSnippet}</div>` : ''}
            <textarea id="commentText" placeholder="Enter your comment...">${escapedExistingText}</textarea>
            <div class="editor-actions">
                <button class="save-btn" onclick="saveComment()">Save</button>
                <button class="cancel-btn" onclick="cancelComment()">Cancel</button>
            </div>
        </div>`;
    }
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Local Comments</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background: var(--vscode-editor-background);
                    padding: 10px;
                    margin: 0;
                }
                
                h1 {
                    color: var(--vscode-foreground);
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 10px;
                }
                
                .keybinding-info {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 10px 12px;
                    margin-bottom: 15px;
                    font-size: 0.95em;
                    color: var(--vscode-foreground);
                    text-align: center;
                    position: relative;
                }
                
                .dismiss-hint {
                    position: absolute;
                    top: 4px;
                    right: 8px;
                    background: none;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    line-height: 1;
                    opacity: 0.6;
                }
                
                .dismiss-hint:hover {
                    opacity: 1;
                }
                
                .keybinding {
                    display: inline-block;
                    background-color: var(--vscode-keybindingLabel-background);
                    color: var(--vscode-keybindingLabel-foreground);
                    border: 1px solid var(--vscode-keybindingLabel-border);
                    border-radius: 3px;
                    padding: 4px 8px;
                    margin: 0 4px;
                    font-family: monospace;
                    font-size: 1.1em;
                    font-weight: bold;
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                }
                
                .comment-item {
                    border: 2px solid var(--vscode-panel-border);
                    border-radius: 8px;
                    margin-bottom: 20px;
                    padding: 18px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                    background-color: var(--vscode-editor-background);
                    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
                    position: relative;
                }
                
                .comment-item:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                
                .comment-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 8px;
                }
                
                .file-name {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                }
                
                .timestamp {
                    font-size: 0.9em;
                    color: var(--vscode-descriptionForeground);
                }
                
                .timestamp:empty {
                    display: none;
                }
                
                .comment-text {
                    margin-bottom: 8px;
                    font-weight: 500;
                    white-space: pre-wrap;
                    word-break: break-word;
                }
                
                .code-snippet {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 3px;
                    padding: 6px 8px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.9em;
                    color: var(--vscode-editor-foreground);
                    margin-bottom: 8px;
                }
                
                .comment-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .comment-actions button {
                    background: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    padding: 4px 8px;
                    border-radius: 3px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                
                .comment-actions button:hover {
                    background: var(--vscode-button-secondaryHoverBackground);
                }
                
                .search-container {
                    position: relative;
                    margin-bottom: 15px;
                }
                
                .search-input {
                    width: 100%;
                    padding: 8px 30px 8px 12px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    font-size: 14px;
                    box-sizing: border-box;
                }
                
                .search-input:focus {
                    outline: none;
                    border-color: var(--vscode-focusBorder);
                }
                
                .search-input::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                }
                
                .clear-button {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: none;
                    align-items: center;
                    justify-content: center;
                }
                
                .clear-button:hover {
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-toolbar-hoverBackground);
                    border-radius: 3px;
                }
                
                .comment-item.hidden {
                    display: none;
                }
                
                .search-highlight {
                    background-color: var(--vscode-editor-findMatchHighlightBackground);
                    color: var(--vscode-editor-findMatchForeground);
                }
                
                .comment-editor {
                    border: 2px solid var(--vscode-button-background);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 15px;
                    background: var(--vscode-editor-background);
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }
                
                .editor-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 10px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                
                .editor-header .file-info {
                    font-weight: bold;
                    color: var(--vscode-textLink-foreground);
                    font-size: 0.9em;
                }
                
                .editor-header .close-btn {
                    background: none;
                    border: none;
                    color: var(--vscode-descriptionForeground);
                    cursor: pointer;
                    font-size: 18px;
                    padding: 0;
                    line-height: 1;
                    opacity: 0.7;
                }
                
                .editor-header .close-btn:hover {
                    opacity: 1;
                    color: var(--vscode-foreground);
                }
                
                .editor-code-preview {
                    background-color: var(--vscode-textCodeBlock-background);
                    border: 1px solid var(--vscode-panel-border);
                    border-radius: 4px;
                    padding: 8px 10px;
                    margin-bottom: 10px;
                    font-family: var(--vscode-editor-font-family);
                    font-size: 0.85em;
                    color: var(--vscode-editor-foreground);
                    max-height: 80px;
                    overflow: hidden;
                    white-space: pre-wrap;
                    word-break: break-all;
                }
                
                .comment-editor textarea {
                    width: 100%;
                    min-height: 100px;
                    resize: vertical;
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    box-sizing: border-box;
                    margin-bottom: 10px;
                }
                
                .comment-editor textarea:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                    border-color: var(--vscode-focusBorder);
                }
                
                .comment-editor textarea::placeholder {
                    color: var(--vscode-input-placeholderForeground);
                }
                
                .editor-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 8px;
                }
                
                .editor-actions .save-btn {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    padding: 6px 16px;
                    cursor: pointer;
                    font-size: 0.9em;
                    font-weight: 500;
                }
                
                .editor-actions .save-btn:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                .editor-actions .cancel-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: none;
                    border-radius: 4px;
                    padding: 6px 16px;
                    cursor: pointer;
                    font-size: 0.9em;
                }
                
                .editor-actions .cancel-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                
                .no-comments {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 40px 20px;
                }
                
                .no-results {
                    text-align: center;
                    color: var(--vscode-descriptionForeground);
                    font-style: italic;
                    padding: 20px;
                }
            </style>
        </head>
        <body>
            ${showHint ? `<div class="keybinding-info">
                <button class="dismiss-hint" onclick="dismissHint()" title="Don't show again">×</button>
                To add a comment, press <span class="keybinding">${process.platform === 'darwin' ? '⌥+C' : 'Alt+C'}</span> or select text and <strong>right-click</strong>
            </div>` : ''}
            ${editorHTML}
            <div class="search-container">
                <input type="text" id="searchInput" placeholder="Search comments..." class="search-input">
                <button id="clearSearch" class="clear-button" title="Clear search">×</button>
            </div>
            <div id="commentsList">
                ${allComments.length === 0 ? 
                    '<div class="no-comments">No comments found in this workspace</div>' :
                    commentsHTML
                }
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function navigateToComment(fileName, line, character) {
                    vscode.postMessage({
                        command: 'navigate',
                        fileName: fileName,
                        line: line,
                        character: character
                    });
                }
                
                function editComment(event, commentId, fileName) {
                    event.stopPropagation();
                    vscode.postMessage({
                        command: 'edit',
                        commentId: commentId,
                        fileName: fileName
                    });
                }
                
                function deleteComment(event, commentId, fileName) {
                    event.stopPropagation();
                    vscode.postMessage({
                        command: 'delete',
                        commentId: commentId,
                        fileName: fileName
                    });
                }
                
                function dismissHint() {
                    vscode.postMessage({
                        command: 'dismissHint'
                    });
                    const hint = document.querySelector('.keybinding-info');
                    if (hint) {
                        hint.style.display = 'none';
                    }
                }
                
                function saveComment() {
                    const textarea = document.getElementById('commentText');
                    if (textarea) {
                        const text = textarea.value;
                        vscode.postMessage({
                            command: 'saveComment',
                            text: text
                        });
                    }
                }
                
                function cancelComment() {
                    vscode.postMessage({
                        command: 'cancelComment'
                    });
                }
                
                // Search functionality
                function highlightText(text, searchTerm) {
                    if (!searchTerm) return text;
                    // Simple case-insensitive highlighting
                    const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
                    if (index === -1) return text;
                    
                    const before = text.substring(0, index);
                    const match = text.substring(index, index + searchTerm.length);
                    const after = text.substring(index + searchTerm.length);
                    
                    return before + '<span class="search-highlight">' + match + '</span>' + after;
                }
                
                function searchComments() {
                    const searchInput = document.getElementById('searchInput');
                    const clearButton = document.getElementById('clearSearch');
                    const commentsList = document.getElementById('commentsList');
                    const searchTerm = searchInput.value.toLowerCase().trim();
                    const comments = commentsList.querySelectorAll('.comment-item');
                    let visibleCount = 0;
                    
                    // Show/hide clear button
                    clearButton.style.display = searchTerm ? 'flex' : 'none';
                    
                    if (!searchTerm) {
                        // Show all comments and remove highlights
                        comments.forEach(comment => {
                            comment.classList.remove('hidden');
                            // Remove search highlights
                            const textElements = comment.querySelectorAll('.comment-text, .file-name, .code-snippet');
                            textElements.forEach(el => {
                                el.innerHTML = el.textContent;
                            });
                        });
                        visibleCount = comments.length;
                    } else {
                        // Filter comments based on search term
                        comments.forEach(comment => {
                            const commentText = comment.querySelector('.comment-text').textContent.toLowerCase();
                            const fileName = comment.querySelector('.file-name').textContent.toLowerCase();
                            const codeSnippet = comment.querySelector('.code-snippet').textContent.toLowerCase();
                            
                            const matches = commentText.includes(searchTerm) || 
                                          fileName.includes(searchTerm) || 
                                          codeSnippet.includes(searchTerm);
                            
                            if (matches) {
                                comment.classList.remove('hidden');
                                visibleCount++;
                                
                                // Add highlights
                                const commentTextEl = comment.querySelector('.comment-text');
                                const fileNameEl = comment.querySelector('.file-name');
                                const codeSnippetEl = comment.querySelector('.code-snippet');
                                
                                commentTextEl.innerHTML = highlightText(commentTextEl.textContent, searchTerm);
                                fileNameEl.innerHTML = highlightText(fileNameEl.textContent, searchTerm);
                                codeSnippetEl.innerHTML = highlightText(codeSnippetEl.textContent, searchTerm);
                            } else {
                                comment.classList.add('hidden');
                            }
                        });
                    }
                    
                    // Show "no results" message if needed
                    const existingNoResults = commentsList.querySelector('.no-results');
                    if (existingNoResults) {
                        existingNoResults.remove();
                    }
                    
                    if (searchTerm && visibleCount === 0) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.textContent = 'No comments found matching "' + searchTerm + '"';
                        commentsList.appendChild(noResults);
                    }
                }
                
                function clearSearch() {
                    const searchInput = document.getElementById('searchInput');
                    searchInput.value = '';
                    searchComments();
                    searchInput.focus();
                }
                
                // Initialize search functionality
                document.addEventListener('DOMContentLoaded', function() {
                    const searchInput = document.getElementById('searchInput');
                    const clearButton = document.getElementById('clearSearch');
                    const commentTextarea = document.getElementById('commentText');
                    
                    if (searchInput) {
                        searchInput.addEventListener('input', searchComments);
                        searchInput.addEventListener('keydown', function(e) {
                            if (e.key === 'Escape') {
                                clearSearch();
                            }
                        });
                    }
                    
                    if (clearButton) {
                        clearButton.addEventListener('click', clearSearch);
                    }
                    
                    // Comment editor functionality
                    if (commentTextarea) {
                        // Auto-focus the textarea
                        commentTextarea.focus();
                        
                        // Keyboard shortcuts
                        commentTextarea.addEventListener('keydown', function(e) {
                            // Ctrl+Enter or Cmd+Enter to save
                            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                e.preventDefault();
                                saveComment();
                            }
                            // Escape to cancel
                            if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelComment();
                            }
                        });
                    }
                });
            </script>
        </body>
        </html>
    `;
}

function refreshSidebar() {
    if (sidebarWebview) {
        const showHint = !extensionContext?.globalState.get<boolean>('hintDismissed', false);
        sidebarWebview.webview.html = createSidebarHTML(showHint);
    }
    commentsTreeDataProvider.refresh();
}

function openSidebar() {
    // Focus on the tree view instead of opening webview
    vscode.commands.executeCommand('localComments.focus');
}

async function navigateToComment(fileName: string, line: number, character: number) {
    const doc = await vscode.workspace.openTextDocument(fileName);
    const editor = await vscode.window.showTextDocument(doc);
    const position = new vscode.Position(line, character);
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(new vscode.Range(position, position));
}

async function editCommentById(commentId: string, fileName: string) {
    const fileComments = commentData[fileName];
    if (!fileComments) {
        return;
    }
    
    const comment = fileComments.find(c => c.id === commentId);
    if (!comment) {
        return;
    }
    
    pendingComment = {
        fileName,
        range: {
            startLine: comment.range.startLine,
            startCharacter: comment.range.startCharacter,
            endLine: comment.range.endLine,
            endCharacter: comment.range.endCharacter,
            selectedText: comment.range.selectedText
        },
        existingCommentId: comment.id,
        existingText: comment.text
    };
    
    refreshSidebar();
    vscode.commands.executeCommand('localComments.focus');
}

async function editCommentFromTree(item: CommentTreeItem) {
    await editCommentById(item.comment.id, item.fileName);
}

async function deleteCommentFromTree(item: CommentTreeItem) {
    await deleteCommentById(item.comment.id, item.fileName);
}

async function deleteCommentById(commentId: string, fileName: string) {
    const config = vscode.workspace.getConfiguration('localComments');
    const confirmDelete = config.get<boolean>('confirmDelete', true);

    if (confirmDelete) {
        const result = await vscode.window.showWarningMessage(
            'Are you sure you want to delete this comment?',
            'Delete', 'Cancel'
        );
        if (result !== 'Delete') {
            return;
        }
    }

    const fileComments = commentData[fileName];
    if (fileComments) {
        const index = fileComments.findIndex(c => c.id === commentId);
        if (index !== -1) {
            fileComments.splice(index, 1);
            if (fileComments.length === 0) {
                delete commentData[fileName];
            }

            updateDecorations();
            const autoSave = config.get<boolean>('autoSave', true);
            if (autoSave) {
                saveComments();
            }

            refreshSidebar();
        }
    }
}

const disposable = vscode.commands.registerCommand('local-comments.openCommentInput', openCommentInput);
const saveDisposable = vscode.commands.registerCommand('local-comments.saveComments', saveComments);
const settingsDisposable = vscode.commands.registerCommand('local-comments.openSettings', openSettings);
const sidebarDisposable = vscode.commands.registerCommand('local-comments.openSidebar', openSidebar);
const navigateDisposable = vscode.commands.registerCommand('local-comments.navigateToComment', navigateToComment);
const editTreeDisposable = vscode.commands.registerCommand('local-comments.editComment', editCommentFromTree);
const deleteTreeDisposable = vscode.commands.registerCommand('local-comments.deleteComment', deleteCommentFromTree);
const refreshDisposable = vscode.commands.registerCommand('local-comments.refreshComments', () => refreshSidebar());

vscode.window.onDidChangeVisibleTextEditors(updateDecorations);

vscode.window.onDidChangeTextEditorSelection(updateDecorations);

vscode.window.onDidChangeWindowState(updateDecorations);

updateDecorations();

function onConfigurationChanged() {
    // Reload comments from potentially new location
    loadComments();
    
    // Update decoration type with new highlight color
    decorationType.dispose();
    decorationType = createDecorationType();
    updateDecorations();
    
    // Update status bar button
    if (statusBarBtn) {
        statusBarBtn.dispose();
    }
    statusBarBtn = createStatusBarButton();
}

class CommentsWebviewViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'localComments';

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private readonly _context: vscode.ExtensionContext
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        sidebarWebview = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        const showHint = !this._context.globalState.get<boolean>('hintDismissed', false);
        webviewView.webview.html = createSidebarHTML(showHint);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(async message => {
            switch (message.command) {
                case 'navigate':
                    await navigateToComment(message.fileName, message.line, message.character);
                    break;
                case 'edit':
                    await editCommentById(message.commentId, message.fileName);
                    break;
                case 'delete':
                    await deleteCommentById(message.commentId, message.fileName);
                    break;
                case 'dismissHint':
                    await this._context.globalState.update('hintDismissed', true);
                    break;
                case 'saveComment':
                    savePendingComment(message.text);
                    break;
                case 'cancelComment':
                    cancelPendingComment();
                    break;
            }
        });
    }
}

class AddCommentCodeActionProvider implements vscode.CodeActionProvider {
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix
    ];

    provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        _context: vscode.CodeActionContext,
        _token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const action = new vscode.CodeAction(
            'Add Local Comment',
            vscode.CodeActionKind.QuickFix
        );
        action.command = {
            command: 'local-comments.openCommentInput',
            title: 'Add Local Comment'
        };
        return [action];
    }
}

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context;
    // Register webview view provider
    const provider = new CommentsWebviewViewProvider(context.extensionUri, context);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(CommentsWebviewViewProvider.viewType, provider)
    );
    
    // Register code action provider for quick-fix menu
    const codeActionProvider = vscode.languages.registerCodeActionsProvider(
        { scheme: 'file' },
        new AddCommentCodeActionProvider(),
        { providedCodeActionKinds: AddCommentCodeActionProvider.providedCodeActionKinds }
    );
    context.subscriptions.push(codeActionProvider);
    
    context.subscriptions.push(decorationType);
    context.subscriptions.push(disposable);
    context.subscriptions.push(saveDisposable);
    context.subscriptions.push(settingsDisposable);
    context.subscriptions.push(sidebarDisposable);
    context.subscriptions.push(navigateDisposable);
    context.subscriptions.push(editTreeDisposable);
    context.subscriptions.push(deleteTreeDisposable);
    context.subscriptions.push(refreshDisposable);
    
    if (statusBarBtn) {
        context.subscriptions.push(statusBarBtn);
    }
    
    // Listen for configuration changes
    const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('localComments')) {
            onConfigurationChanged();
        }
    });
    context.subscriptions.push(configChangeDisposable);
}

export function deactivate() { }
