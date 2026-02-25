# Releasing (publish to npm)
Publishing to npm is what makes `npx @samboyd/bep-cli@latest ...` work.

This repo publishes the **package** `@samboyd/bep-cli` and exposes two **binaries**: `bep` and `bep-cli` (both run the same CLI).

## One-time setup
1. Create an npm account, then run:
   ```bash
   npm login
   ```
2. Ensure you can publish the package name:
   ```bash
   npm view @samboyd/bep-cli version
   ```
   If this returns a 404, it likely means the name hasn’t been published yet.

## Release a new version
1. Run tests:
   ```bash
   npm test
   ```
2. Bump the version (patch/minor/major):
   ```bash
   npm version patch
   ```
   This updates `package.json`, creates a git commit, and creates a git tag.
3. Verify what will ship:
   ```bash
   npm pack --dry-run
   ```
4. Publish:
   ```bash
   npm publish
   ```
   This repo sets `"publishConfig.access": "public"` so scoped publishing works without extra flags. If your npm account enforces 2FA, you may need `--otp <code>`.

## Verify end-to-end
```bash
npx -y @samboyd/bep-cli@latest --help
```

To run the shorter `bep` binary via `npx`:
```bash
npx -y -p @samboyd/bep-cli@latest bep --help
```

## Optional: CI publishing
If you want “tag → publish”, add a GitHub Action that runs on version tags (for example `v0.1.1`) and publishes with an `NPM_TOKEN` secret.

## Troubleshooting
- If `npm pack`/`npm publish` fails with `EPERM` under `~/.npm/_cacache`, fix cache ownership:
  ```bash
  sudo chown -R "$(id -u):$(id -g)" ~/.npm
  ```
