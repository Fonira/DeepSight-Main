#!/bin/bash
# git-push-async.sh - Async git push with automatic retries
# Usage: ./git-push-async.sh [branch] [--wait]
#
# This script pushes to remote in background with:
# - Automatic retry with exponential backoff (2s, 4s, 8s, 16s)
# - Dynamic proxy detection (re-reads git remote before each attempt)
# - Non-blocking by default (use --wait to block)
# - Log file for tracking push status

set -e

# Configuration
MAX_RETRIES=4
LOG_DIR="${HOME}/.git-push-logs"
LOG_FILE="${LOG_DIR}/push-$(date +%Y%m%d-%H%M%S).log"
LOCK_FILE="/tmp/git-push-async.lock"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
BRANCH="${1:-$(git branch --show-current)}"
WAIT_MODE=false
if [[ "$2" == "--wait" ]] || [[ "$1" == "--wait" ]]; then
    WAIT_MODE=true
    if [[ "$1" == "--wait" ]]; then
        BRANCH="$(git branch --show-current)"
    fi
fi

# Create log directory
mkdir -p "$LOG_DIR"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"

    case "$level" in
        "INFO")  echo -e "${BLUE}[INFO]${NC} $message" ;;
        "OK")    echo -e "${GREEN}[OK]${NC} $message" ;;
        "WARN")  echo -e "${YELLOW}[WARN]${NC} $message" ;;
        "ERROR") echo -e "${RED}[ERROR]${NC} $message" ;;
    esac
}

# Check if another push is in progress
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid=$(cat "$LOCK_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            log "WARN" "Another push is in progress (PID: $pid)"
            log "INFO" "Check status: cat ~/.git-push-logs/latest.log"
            return 1
        else
            rm -f "$LOCK_FILE"
        fi
    fi
    return 0
}

# Create lock
create_lock() {
    echo $$ > "$LOCK_FILE"
}

# Remove lock
remove_lock() {
    rm -f "$LOCK_FILE"
}

# Refresh remote URL (handles dynamic proxy ports)
refresh_remote() {
    local current_url=$(git remote get-url origin 2>/dev/null)
    log "INFO" "Current remote: $current_url"
}

# Push with retry logic
push_with_retry() {
    local attempt=1
    local delay=2

    while [[ $attempt -le $MAX_RETRIES ]]; do
        log "INFO" "Push attempt $attempt/$MAX_RETRIES for branch: $BRANCH"

        # Refresh remote URL before each attempt (dynamic proxy)
        refresh_remote

        # Attempt push
        if git push -u origin "$BRANCH" 2>&1 | tee -a "$LOG_FILE"; then
            log "OK" "Push successful on attempt $attempt"
            return 0
        else
            local exit_code=${PIPESTATUS[0]}
            log "WARN" "Push failed with exit code $exit_code"

            if [[ $attempt -lt $MAX_RETRIES ]]; then
                log "INFO" "Waiting ${delay}s before retry..."
                sleep $delay
                delay=$((delay * 2))
            fi
        fi

        attempt=$((attempt + 1))
    done

    log "ERROR" "Push failed after $MAX_RETRIES attempts"
    return 1
}

# Main push function
do_push() {
    log "INFO" "Starting async push for branch: $BRANCH"
    log "INFO" "Log file: $LOG_FILE"

    # Create symlink to latest log
    ln -sf "$LOG_FILE" "${LOG_DIR}/latest.log"

    create_lock
    trap remove_lock EXIT

    # Verify we have commits to push
    local unpushed=$(git log origin/"$BRANCH".."$BRANCH" --oneline 2>/dev/null | wc -l)
    if [[ "$unpushed" -eq 0 ]]; then
        log "INFO" "No new commits to push"
        return 0
    fi

    log "INFO" "Found $unpushed commit(s) to push"

    # Execute push with retry
    if push_with_retry; then
        log "OK" "All commits pushed successfully"

        # Desktop notification if available
        if command -v notify-send &>/dev/null; then
            notify-send "Git Push" "Successfully pushed to $BRANCH" -i dialog-information
        fi
        return 0
    else
        log "ERROR" "Failed to push after all retries"

        if command -v notify-send &>/dev/null; then
            notify-send "Git Push Failed" "Could not push to $BRANCH" -i dialog-error
        fi
        return 1
    fi
}

# Main execution
main() {
    if ! check_lock; then
        exit 1
    fi

    if [[ "$WAIT_MODE" == true ]]; then
        # Blocking mode
        do_push
    else
        # Non-blocking mode (background)
        log "INFO" "Running push in background..."
        log "INFO" "Check status: tail -f ~/.git-push-logs/latest.log"

        (do_push &)

        echo -e "${GREEN}Push started in background${NC}"
        echo "Monitor: tail -f ~/.git-push-logs/latest.log"
        echo "You can continue working!"
    fi
}

main
