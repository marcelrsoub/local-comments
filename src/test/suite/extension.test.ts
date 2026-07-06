import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

type TestExtensionModule = {
    testReloadCommentsFromDisk: () => void;
    testGetCommentData: () => Record<string, Array<{
        id: string;
        text: string;
        timestamp?: number;
        range: {
            startLine: number;
            startCharacter: number;
            endLine: number;
            endCharacter: number;
            selectedText?: string;
        };
    }>>;
};

suite('Extension Test Suite', () => {
    test('refresh reloads comments from disk and clears stale entries', async () => {
        const extension = require(path.resolve(__dirname, '../../../dist/extension')) as TestExtensionModule;
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-comments-test-'));
        const commentsPath = path.join(tempDir, 'local-comments.json');
        const fileKey = '/tmp/example.ts';

        try {
            await vscode.workspace.getConfiguration('localComments').update('saveLocation', 'custom', true);
            await vscode.workspace.getConfiguration('localComments').update('customFilePath', commentsPath, true);

            const initialComments = {
                [fileKey]: [
                    {
                        id: 'test-comment-1',
                        text: 'Reload should pick this up',
                        timestamp: 1234567890,
                        range: {
                            startLine: 1,
                            startCharacter: 0,
                            endLine: 1,
                            endCharacter: 12
                        }
                    }
                ]
            };
            fs.writeFileSync(commentsPath, JSON.stringify(initialComments, null, 2));

            extension.testReloadCommentsFromDisk();

            const loadedComments = extension.testGetCommentData();
            assert.strictEqual(Object.keys(loadedComments).length, 1);
            assert.strictEqual(loadedComments[fileKey]?.length, 1);
            assert.strictEqual(loadedComments[fileKey]?.[0].text, 'Reload should pick this up');

            fs.writeFileSync(commentsPath, '{}');
            extension.testReloadCommentsFromDisk();

            const clearedComments = extension.testGetCommentData();
            assert.deepStrictEqual(clearedComments, {});
        } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
            await vscode.workspace.getConfiguration('localComments').update('saveLocation', 'home', true);
            await vscode.workspace.getConfiguration('localComments').update('customFilePath', '', true);
        }
    });
});
