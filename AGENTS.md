# AGENTS.md

## Purpose

You are an engineering agent working on `local-comments`, a VS Code extension that stores comments locally instead of in the repository.

Optimize for simple, maintainable changes that fit the existing extension architecture. Prefer the smallest safe fix that preserves the current UX and data format.

This file applies to this repo unless the user explicitly overrides it.

---

## Repo Shape

This project is a TypeScript VS Code extension built with webpack.

Key areas:

- `src/extension.ts`: extension runtime, comment storage, sidebar UI, commands, and file watching
- `src/test/`: integration tests for the extension
- `dist/`: compiled output
- `docs/DEVELOPMENT.md`: local development workflow
- `README.md`: product-facing usage and settings
- `package.json`: commands, configuration, scripts, and extension manifest

---

## Operating Loop

For non-trivial work:

1. Inspect the existing code and docs first.
2. Identify the actual behavior to change.
3. Keep the implementation small and aligned with the current architecture.
4. Make the change in a reviewable slice.
5. Run the most relevant checks.
6. Report what changed and how it was verified.

If the task is tiny, keep the process lightweight. If the user asks for a broader change, be more deliberate.

---

## Working Rules

- Reuse the existing stack: TypeScript, VS Code API, webpack, Yarn, Mocha, `@vscode/test-electron`.
- Do not add dependencies unless there is a clear benefit and the existing stack cannot solve the problem cleanly.
- Prefer surgical edits over broad rewrites.
- Preserve the current comment file schema unless the user explicitly wants a migration.
- Treat the on-disk comments JSON as the source of truth.
- Keep UI and behavior changes consistent with the existing sidebar and editor actions.

---

## Suggested Commands

Use the repo’s actual scripts:

- `yarn compile`
- `yarn watch`
- `yarn lint`
- `yarn test`
- `yarn package`
- `yarn compile-tests`

For local extension testing:

- `code --extensionDevelopmentPath="$PWD" .`
- Or launch the extension development host from VS Code with `F5`

For webview or sidebar changes, verify the behavior in the Extension Development Host, not just in source.

---

## Testing Expectations

Testing is part of the change.

Prefer the cheapest meaningful verification:

- Unit or integration tests for comment parsing, persistence, and reload behavior
- `yarn lint` for style and correctness checks
- `yarn compile` or `yarn test` when runtime behavior changes
- Manual VS Code testing for sidebar, commands, and webview behavior

When a bug involves file watching, refresh behavior, or the sidebar webview, verify it against a real comments file and not just by reading code.

Do not claim a fix is proven unless you ran a relevant test or manual check.

---

## Implementation Guidelines

- Keep `src/extension.ts` understandable. Split helper logic only when it improves clarity.
- Be careful with global state such as cached comment data, pending comment state, and file watcher state.
- Dispose watchers, editors, and subscriptions cleanly.
- Handle missing files, invalid JSON, and stale data gracefully.
- Avoid leaking repo-only paths or unnecessary temp files into the workspace.

---

## Communication Style

Be concise, practical, and explicit.

When describing work:

- State the goal.
- Summarize the change.
- List the verification you actually ran.
- Call out any remaining risk or follow-up.

If you are unsure, say so and inspect the repo rather than guessing.

---

## Definition of Done

A task is done when:

- The requested behavior is implemented.
- The extension still compiles.
- The relevant tests or manual checks were run.
- Any important repo-specific trade-offs are clear.
- The final response tells the user exactly what changed and how it was verified.

