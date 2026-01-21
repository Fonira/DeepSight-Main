# Git Push Scripts

Cross-platform async git push with retry logic and status monitoring.

## Features

- **Non-blocking pushes**: Push in background, continue working
- **Retry with backoff**: 4 attempts with exponential delays (2s, 4s, 8s, 16s)
- **Lock file**: Prevents concurrent push operations
- **Cross-platform**: Works on Windows, macOS, and Linux
- **Logging**: All operations logged to `~/.git-push-logs/`

## Usage

### npm scripts (recommended)

```bash
# Push in background (non-blocking)
npm run push
npm run p           # shortcut

# Push and wait (blocking)
npm run push:wait

# Check push status
npm run push:status
npm run ps          # shortcut
```

### Direct Node.js

```bash
# Push in background (non-blocking)
node scripts/git-push.js

# Push and wait (blocking)
node scripts/git-push.js --wait

# Check push status
node scripts/git-push-status.js

# Follow logs in real-time
node scripts/git-push-status.js --tail
node scripts/git-push-status.js -f
```

### Legacy bash scripts (Unix only)

```bash
# Push in background
./scripts/git-push-async.sh

# Check status
./scripts/git-push-status.sh
```

## Log Location

Logs are stored in your home directory:
- **Log file**: `~/.git-push-logs/push.log`
- **Lock file**: `~/.git-push-logs/push.lock`

## How It Works

1. **Background Mode** (default): Spawns a detached process and exits immediately
2. **Wait Mode** (`--wait`): Runs in foreground, showing all output
3. **Retry Logic**: On failure, waits 2s, 4s, 8s, 16s between attempts
4. **Lock File**: Prevents multiple simultaneous pushes, auto-clears after 5 minutes
