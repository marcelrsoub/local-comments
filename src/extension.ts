import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CommentData {
    [fileName: string]: {
        [lineNumber: number]: string;
    };
}

const commentData: CommentData = {};
// save to user root folder
const rootFolderPath = os.homedir();
const commentFilePath = path.join(rootFolderPath, 'local-comments.json');

function loadComments() {
    if (fs.existsSync(commentFilePath)) {
        const fileData = fs.readFileSync(commentFilePath, 'utf-8');
        try {
            Object.assign(commentData, JSON.parse(fileData));
        } catch (err) {
            console.error('❌ Failed to parse comments file:', err);
        }
    }
}

function saveComments() {
    try {
        fs.writeFileSync(commentFilePath, JSON.stringify(commentData));
        vscode.window.showInformationMessage(`💾 Saved to ${commentFilePath}`);
    } catch (err) {
        console.error('❌ Failed to save comments file:', err);
    }
}

loadComments();

const decorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: 'rgba(255, 255, 0, 0.3)'
});

const statusBarBtn = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
statusBarBtn.text = "💭";
statusBarBtn.tooltip = "Add a local comment";
statusBarBtn.command = 'local-comments.openCommentInput';
statusBarBtn.show();

function updateDecorations() {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        const decorations: vscode.DecorationOptions[] = [];
        const fileName = activeEditor.document.fileName;
        const commentsForFile = commentData[fileName];
        if (commentsForFile) {
            for (const [lineNumberStr, comment] of Object.entries(commentsForFile)) {
                const lineNumber = parseInt(lineNumberStr);
                const line = activeEditor.document.lineAt(lineNumber - 1);
                const range = new vscode.Range(line.range.start, line.range.end);
                const decoration = { range, hoverMessage: comment };
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

function openCommentInput() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        return;
    }
    const position = activeEditor.selection.active;
    const lineNumber = position.line + 1;
    const fileName = activeEditor.document.fileName;
    const existingComment = commentData[fileName]?.[lineNumber] || '';
    vscode.window.showInputBox({
        value: existingComment,
        prompt: `Comment for line ${lineNumber} in ${fileName}`
    }).then((comment) => {
        if (comment !== undefined) {
            commentData[fileName] = commentData[fileName] || {};
            commentData[fileName][lineNumber] = comment;
            updateDecorations();
            saveComments();
        }
        if (comment === '' || comment === undefined && existingComment) {
            delete commentData[fileName][lineNumber];
            updateDecorations();
            saveComments();
        }
    });
}

const disposable = vscode.commands.registerCommand('local-comments.openCommentInput', openCommentInput);

vscode.window.onDidChangeVisibleTextEditors(updateDecorations);

vscode.window.onDidChangeTextEditorSelection(updateDecorations);

vscode.window.onDidChangeWindowState(updateDecorations);

updateDecorations();

export function activate(context: vscode.ExtensionContext) {
    context. subscriptions.push(decorationType);
    context.subscriptions.push(disposable);
    context.subscriptions.push(statusBarBtn);
}

export function deactivate() { }
