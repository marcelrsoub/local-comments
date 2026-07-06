# Release Process

This document outlines the steps to release a new version of Local Comments.

## Prerequisites

- `vsce` CLI installed globally:
  ```bash
  npm install -g @vscode/vsce
  ```
- Personal Access Token (PAT) from Azure DevOps
- PAT configured for the publisher:
  ```bash
  vsce login marcel-rsoub
  ```

### Creating a Personal Access Token

1. Go to https://dev.azure.com
2. Sign in with your Microsoft/GitHub account
3. Click your profile icon → **Personal access tokens**
4. Create a new token with:
   - **Organization**: All accessible organizations
   - **Scopes**: Marketplace → **Manage**
5. Copy the token and use it with `vsce login marcel-rsoub`

## Release Workflow

1. **Update version** in `package.json`:
   ```json
   "version": "1.x.0"
   ```

2. **Update `CHANGELOG.md`** with a new version section:
   ```markdown
   ## [1.x.0] - YYYY-MM-DD

   ### Added
   - Description of new features

   ### Changed
   - Description of changes

   ### Fixed
   - Description of bug fixes
   ```

3. **Build production package**:
   ```bash
   yarn package
   ```

4. **Commit the release**:
   ```bash
   git add .
   git commit -m "release: v1.x.0"
   ```

5. **Publish to VS Code Marketplace**:
   ```bash
   vsce publish
   ```

6. **Push to GitHub**:
   ```bash
   git push origin main
   ```

7. **Create and push tag**:
   ```bash
   git tag v1.x.0
   git push origin v1.x.0
   ```

## Keeping Changes Local (Development)

To work on changes without releasing:

1. Make code changes
2. Test locally:
   ```bash
   yarn compile
   code --extensionDevelopmentPath="$PWD" .
   ```
3. Repeat until ready to release

See [DEVELOPMENT.md](./DEVELOPMENT.md) for more details on local development.

## Troubleshooting

### PAT Expired or Invalid

Run the login command again with a new token:
```bash
vsce login marcel-rsoub
```

### Build Fails

Ensure dependencies are up to date:
```bash
yarn install
yarn compile
```

### Publish Fails

Verify the publisher name matches your Marketplace publisher ID:
```bash
vsce verify-pat marcel-rsoub
```
