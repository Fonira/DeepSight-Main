#!/bin/bash
# git-push-status.sh - Check status of async push operations
# Usage: ./git-push-status.sh [--tail]

LOG_DIR="${HOME}/.git-push-logs"
LOCK_FILE="/tmp/git-push-async.lock"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "=== Git Push Status ==="
echo

# Check if push is in progress
if [[ -f "$LOCK_FILE" ]]; then
    pid=$(cat "$LOCK_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo -e "${YELLOW}Push in progress${NC} (PID: $pid)"
    else
        echo -e "${GREEN}No push in progress${NC}"
        rm -f "$LOCK_FILE"
    fi
else
    echo -e "${GREEN}No push in progress${NC}"
fi

echo

# Show latest log
if [[ -f "${LOG_DIR}/latest.log" ]]; then
    echo "Latest push log:"
    echo "----------------"
    tail -10 "${LOG_DIR}/latest.log"
    echo
    echo "Full log: ${LOG_DIR}/latest.log"
else
    echo "No push logs found"
fi

# Tail mode
if [[ "$1" == "--tail" ]] || [[ "$1" == "-f" ]]; then
    echo
    echo "Following log (Ctrl+C to stop)..."
    tail -f "${LOG_DIR}/latest.log"
fi
