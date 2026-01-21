#!/usr/bin/env node

/**
 * Cross-platform async git push with retry logic
 *
 * Usage:
 *   node scripts/git-push.js         # Background push (non-blocking)
 *   node scripts/git-push.js --wait  # Foreground push (blocking)
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Configuration
const MAX_RETRIES = 4;
const RETRY_DELAYS = [2000, 4000, 8000, 16000]; // Exponential backoff
const LOG_DIR = join(homedir(), '.git-push-logs');
const LOCK_FILE = join(LOG_DIR, 'push.lock');
const LOG_FILE = join(LOG_DIR, 'push.log');

// Parse arguments
const args = process.argv.slice(2);
const waitMode = args.includes('--wait') || args.includes('-w');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Log message to file and optionally console
 */
function log(message, toConsole = waitMode) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, logLine);
  if (toConsole) {
    console.log(message);
  }
}

/**
 * Get current git branch
 */
function getCurrentBranch() {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => { stdout += data; });
    git.stderr.on('data', (data) => { stderr += data; });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(stderr.trim() || 'Failed to get current branch'));
      }
    });
  });
}

/**
 * Execute git push
 */
function gitPush(branch) {
  return new Promise((resolve, reject) => {
    const git = spawn('git', ['push', 'origin', branch], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => { stdout += data; });
    git.stderr.on('data', (data) => { stderr += data; });

    git.on('close', (code) => {
      if (code === 0) {
        resolve(stdout + stderr);
      } else {
        reject(new Error(stderr || stdout || `git push exited with code ${code}`));
      }
    });
  });
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if lock file exists and is recent (within 5 minutes)
 */
function isLocked() {
  if (!existsSync(LOCK_FILE)) return false;

  try {
    const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    const lockAge = Date.now() - lockData.timestamp;
    // Consider stale if older than 5 minutes
    if (lockAge > 5 * 60 * 1000) {
      unlinkSync(LOCK_FILE);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Create lock file
 */
function createLock(branch) {
  writeFileSync(LOCK_FILE, JSON.stringify({
    timestamp: Date.now(),
    branch,
    pid: process.pid
  }));
}

/**
 * Remove lock file
 */
function removeLock() {
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // Ignore errors when removing lock
  }
}

/**
 * Main push function with retry logic
 */
async function pushWithRetry() {
  // Check for existing push in progress
  if (isLocked()) {
    const lockData = JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    log(`Push already in progress (branch: ${lockData.branch}, pid: ${lockData.pid})`);
    process.exit(1);
  }

  let branch;
  try {
    branch = await getCurrentBranch();
  } catch (error) {
    log(`Error: ${error.message}`);
    process.exit(1);
  }

  // Create lock
  createLock(branch);

  log(`Starting push to origin/${branch}`);

  let lastError;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const output = await gitPush(branch);
      log(`Push successful!`);
      if (output.trim()) {
        log(output.trim());
      }
      removeLock();
      process.exit(0);
    } catch (error) {
      lastError = error;
      const delay = RETRY_DELAYS[attempt];

      if (attempt < MAX_RETRIES - 1) {
        log(`Push failed (attempt ${attempt + 1}/${MAX_RETRIES}): ${error.message}`);
        log(`Retrying in ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  log(`Push failed after ${MAX_RETRIES} attempts: ${lastError.message}`);
  removeLock();
  process.exit(1);
}

/**
 * Run in background (detached) mode
 */
function runInBackground() {
  const child = spawn(process.execPath, [process.argv[1], '--wait'], {
    detached: true,
    stdio: 'ignore',
    cwd: process.cwd()
  });

  child.unref();
  console.log(`Push started in background (pid: ${child.pid})`);
  console.log(`Check status: node scripts/git-push-status.js`);
  process.exit(0);
}

// Main entry point
if (waitMode) {
  pushWithRetry();
} else {
  runInBackground();
}
