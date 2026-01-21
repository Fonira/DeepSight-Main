#!/usr/bin/env node

/**
 * Check git push status and view logs
 *
 * Usage:
 *   node scripts/git-push-status.js         # Show current status
 *   node scripts/git-push-status.js --tail  # Follow log output
 *   node scripts/git-push-status.js -f      # Follow log output (alias)
 */

import { existsSync, readFileSync, watchFile, statSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Configuration
const LOG_DIR = join(homedir(), '.git-push-logs');
const LOCK_FILE = join(LOG_DIR, 'push.lock');
const LOG_FILE = join(LOG_DIR, 'push.log');

// Parse arguments
const args = process.argv.slice(2);
const tailMode = args.includes('--tail') || args.includes('-f') || args.includes('--follow');

/**
 * Format timestamp for display
 */
function formatAge(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Check lock file status
 */
function checkLockStatus() {
  if (!existsSync(LOCK_FILE)) {
    return { inProgress: false };
  }

  try {
    const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    const lockAge = Date.now() - lockData.timestamp;

    // Consider stale if older than 5 minutes
    if (lockAge > 5 * 60 * 1000) {
      return { inProgress: false, stale: true, lockData };
    }

    return { inProgress: true, lockData, age: lockAge };
  } catch {
    return { inProgress: false };
  }
}

/**
 * Get recent log entries
 */
function getRecentLogs(lines = 20) {
  if (!existsSync(LOG_FILE)) {
    return [];
  }

  const content = readFileSync(LOG_FILE, 'utf8');
  const allLines = content.trim().split('\n').filter(Boolean);
  return allLines.slice(-lines);
}

/**
 * Display current status
 */
function showStatus() {
  console.log('=== Git Push Status ===\n');

  const status = checkLockStatus();

  if (status.inProgress) {
    console.log(`Status: PUSH IN PROGRESS`);
    console.log(`Branch: ${status.lockData.branch}`);
    console.log(`PID: ${status.lockData.pid}`);
    console.log(`Started: ${formatAge(status.age)}`);
  } else if (status.stale) {
    console.log(`Status: STALE LOCK (possible crash)`);
    console.log(`Branch: ${status.lockData?.branch || 'unknown'}`);
  } else {
    console.log(`Status: IDLE (no push in progress)`);
  }

  console.log('\n=== Recent Logs ===\n');

  const logs = getRecentLogs();
  if (logs.length === 0) {
    console.log('No logs found.');
  } else {
    logs.forEach(line => console.log(line));
  }
}

/**
 * Follow log file (tail -f mode)
 */
function tailLogs() {
  console.log('Following git push logs (Ctrl+C to exit)...\n');

  // Show existing content first
  const existingLogs = getRecentLogs(10);
  existingLogs.forEach(line => console.log(line));

  if (!existsSync(LOG_FILE)) {
    console.log('(waiting for log file to be created...)');
  }

  let lastSize = existsSync(LOG_FILE) ? statSync(LOG_FILE).size : 0;

  // Watch for changes
  const checkInterval = setInterval(() => {
    if (!existsSync(LOG_FILE)) return;

    const currentSize = statSync(LOG_FILE).size;
    if (currentSize > lastSize) {
      const content = readFileSync(LOG_FILE, 'utf8');
      const newContent = content.slice(lastSize);
      process.stdout.write(newContent);
      lastSize = currentSize;
    }
  }, 500);

  // Handle exit
  process.on('SIGINT', () => {
    clearInterval(checkInterval);
    console.log('\n');
    process.exit(0);
  });
}

// Main entry point
if (tailMode) {
  tailLogs();
} else {
  showStatus();
}
