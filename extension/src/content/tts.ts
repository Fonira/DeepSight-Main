// ── TTS Module — Text-to-Speech pour l'extension Chrome ──
// Utilise le backend /api/tts (ElevenLabs) avec gestion plan premium

import { getStoredTokens, getStoredUser } from '../utils/storage';

// ═══════════════════════════════════════════════════════════════════════════════
// Types & Config
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = 'https://api.deepsightsynthesis.com/api';
const SPEED_CYCLE = [1, 1.5, 2, 3];

interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  isPaused: boolean;
  currentText: string;
  currentTime: number;
  duration: number;
  speed: number;
  language: 'fr' | 'en';
  gender: 'male' | 'female';
}

const PLAN_RANK: Record<string, number> = {
  free: 0, decouverte: 0, pro: 1, expert: 1, etudiant: 1, student: 1, starter: 1,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Singleton state
// ═══════════════════════════════════════════════════════════════════════════════

let state: TTSState = {
  isPlaying: false,
  isLoading: false,
  isPaused: false,
  currentText: '',
  currentTime: 0,
  duration: 0,
  speed: 1,
  language: 'fr',
  gender: 'female',
};

let audio: HTMLAudioElement | null = null;
let blobUrl: string | null = null;
let abortController: AbortController | null = null;
let activeButtonId: string | null = null;

// Load persisted settings
function loadSettings(): void {
  chrome.storage.local.get(['tts_speed', 'tts_lang', 'tts_gender'], (data) => {
    if (data.tts_speed) state.speed = data.tts_speed;
    if (data.tts_lang) state.language = data.tts_lang;
    if (data.tts_gender) state.gender = data.tts_gender;
  });
}
loadSettings();

function saveSettings(): void {
  chrome.storage.local.set({
    tts_speed: state.speed,
    tts_lang: state.language,
    tts_gender: state.gender,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Premium check
// ═══════════════════════════════════════════════════════════════════════════════

export async function isTTSPremium(): Promise<boolean> {
  const user = await getStoredUser();
  const plan = user?.plan || 'free';
  return (PLAN_RANK[plan] ?? 0) >= 1; // pro+ = TTS enabled
}

// ═══════════════════════════════════════════════════════════════════════════════
// Core playback
// ═══════════════════════════════════════════════════════════════════════════════

function cleanup(): void {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio = null;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
}

export function ttsStop(): void {
  abortController?.abort();
  abortController = null;
  cleanup();
  activeButtonId = null;
  state.isPlaying = false;
  state.isPaused = false;
  state.isLoading = false;
  state.currentText = '';
  state.currentTime = 0;
  state.duration = 0;
  updateAllButtons();
}

export function ttsPauseResume(): void {
  if (!audio) return;
  if (audio.paused) {
    audio.play().catch(() => {});
    state.isPaused = false;
    state.isPlaying = true;
  } else {
    audio.pause();
    state.isPaused = true;
    state.isPlaying = false;
  }
  updateAllButtons();
}

export async function ttsPlay(text: string, buttonId: string): Promise<void> {
  if (!text?.trim()) return;

  // If same text is playing, toggle pause
  if (state.currentText === text && (state.isPlaying || state.isPaused)) {
    if (state.isPaused) {
      ttsPauseResume();
    } else {
      ttsStop();
    }
    return;
  }

  // Stop any current playback
  ttsStop();
  activeButtonId = buttonId;
  state.isLoading = true;
  state.currentText = text;
  updateAllButtons();

  abortController = new AbortController();

  try {
    const tokens = await getStoredTokens();
    if (!tokens.accessToken) throw new Error('Auth required');

    const response = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        language: state.language,
        gender: state.gender,
        speed: state.speed,
        strip_questions: true,
      }),
      signal: abortController.signal,
    });

    if (abortController.signal.aborted) return;

    if (response.status === 403) {
      throw new Error('TTS réservé aux abonnés Étudiant+');
    }
    if (!response.ok) {
      throw new Error(`TTS erreur (${response.status})`);
    }

    const blob = await response.blob();
    if (blob.size === 0) throw new Error('Audio vide');
    if (abortController.signal.aborted) return;

    cleanup();
    blobUrl = URL.createObjectURL(blob);
    audio = new Audio(blobUrl);
    audio.playbackRate = state.speed;

    audio.onloadedmetadata = () => {
      state.duration = audio!.duration;
      updateAllButtons();
    };

    audio.ontimeupdate = () => {
      state.currentTime = audio!.currentTime;
      updateProgressBar();
    };

    audio.onended = () => {
      state.isPlaying = false;
      state.isPaused = false;
      state.currentTime = 0;
      activeButtonId = null;
      updateAllButtons();
    };

    audio.onerror = () => ttsStop();

    await audio.play();
    state.isPlaying = true;
    state.isPaused = false;
    state.isLoading = false;
    updateAllButtons();

  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return;
    console.warn('[DeepSight TTS]', err);
    cleanup();
    state.isLoading = false;
    state.isPlaying = false;
    state.currentText = '';
    activeButtonId = null;
    updateAllButtons();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Speed cycling
// ═══════════════════════════════════════════════════════════════════════════════

export function ttsCycleSpeed(): void {
  const idx = SPEED_CYCLE.indexOf(state.speed);
  state.speed = SPEED_CYCLE[(idx + 1) % SPEED_CYCLE.length];
  if (audio) audio.playbackRate = state.speed;
  saveSettings();
  updateAllButtons();
}

export function ttsSetLanguage(lang: 'fr' | 'en'): void {
  state.language = lang;
  saveSettings();
}

export function ttsSetGender(g: 'male' | 'female'): void {
  state.gender = g;
  saveSettings();
}

// ═══════════════════════════════════════════════════════════════════════════════
// UI helpers — Format time
// ═══════════════════════════════════════════════════════════════════════════════

function formatTime(t: number): string {
  if (!isFinite(t) || isNaN(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOM update helpers
// ═══════════════════════════════════════════════════════════════════════════════

function updateProgressBar(): void {
  if (!activeButtonId) return;
  const bar = document.getElementById(`${activeButtonId}-progress-fill`);
  const time = document.getElementById(`${activeButtonId}-time`);
  if (bar && state.duration > 0) {
    bar.style.width = `${(state.currentTime / state.duration) * 100}%`;
  }
  if (time) {
    time.textContent = `${formatTime(state.currentTime)}/${formatTime(state.duration)}`;
  }
}

function updateAllButtons(): void {
  document.querySelectorAll('.ds-tts-btn').forEach((el) => {
    const btn = el as HTMLElement;
    const btnId = btn.dataset.ttsId;
    const btnText = btn.dataset.ttsText || '';
    const isActive = activeButtonId === btnId && (state.isPlaying || state.isPaused || state.isLoading);

    if (isActive) {
      btn.classList.add('ds-tts-active');
      btn.innerHTML = buildActivePlayerHtml(btnId || '');
      bindActivePlayerEvents(btn, btnText, btnId || '');
    } else {
      btn.classList.remove('ds-tts-active');
      btn.innerHTML = `<span class="ds-tts-icon">🔊</span>`;
    }
  });
}

function buildActivePlayerHtml(btnId: string): string {
  const icon = state.isLoading
    ? `<svg class="ds-tts-spinner" width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    : state.isPlaying
      ? '⏸️'
      : '▶️';

  return `
    <span class="ds-tts-play-icon">${icon}</span>
    <div class="ds-tts-progress" id="${btnId}-progress">
      <div class="ds-tts-progress-fill" id="${btnId}-progress-fill" style="width:${state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0}%"></div>
    </div>
    <span class="ds-tts-time" id="${btnId}-time">${formatTime(state.currentTime)}/${formatTime(state.duration)}</span>
    <span class="ds-tts-stop" title="Stop">⏹️</span>
    <span class="ds-tts-speed" title="Vitesse">${state.speed}x</span>
  `;
}

function bindActivePlayerEvents(container: HTMLElement, text: string, btnId: string): void {
  const playIcon = container.querySelector('.ds-tts-play-icon');
  const stopBtn = container.querySelector('.ds-tts-stop');
  const speedBtn = container.querySelector('.ds-tts-speed');
  const progressBar = container.querySelector('.ds-tts-progress');

  playIcon?.addEventListener('click', (e) => {
    e.stopPropagation();
    ttsPauseResume();
  });

  stopBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    ttsStop();
  });

  speedBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    ttsCycleSpeed();
  });

  progressBar?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!audio || !state.duration) return;
    const rect = (progressBar as HTMLElement).getBoundingClientRect();
    const pct = ((e as MouseEvent).clientX - rect.left) / rect.width;
    audio.currentTime = pct * state.duration;
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public: render TTS button HTML (inline, for results/chat)
// ═══════════════════════════════════════════════════════════════════════════════

let ttsCounter = 0;

/**
 * Returns HTML for a TTS play button.
 * Call `bindTTSButtons()` after inserting the HTML into the DOM.
 */
export function ttsButtonHtml(text: string, size: 'sm' | 'md' = 'sm'): string {
  const id = `ds-tts-${++ttsCounter}`;
  const escapedText = text.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const sizeClass = size === 'md' ? 'ds-tts-btn-md' : '';
  return `<button class="ds-tts-btn ${sizeClass}" data-tts-id="${id}" data-tts-text="${escapedText}" type="button" title="Écouter"><span class="ds-tts-icon">🔊</span></button>`;
}

/**
 * Returns HTML for a locked TTS button (free users).
 */
export function ttsLockedButtonHtml(): string {
  return `<button class="ds-tts-btn ds-tts-locked" type="button" title="Lecture vocale — Plan Étudiant+"><span class="ds-tts-icon">🔒</span></button>`;
}

/**
 * Bind click handlers on all .ds-tts-btn elements.
 * Call after inserting TTS button HTML into the DOM.
 */
export function bindTTSButtons(): void {
  document.querySelectorAll('.ds-tts-btn:not([data-bound])').forEach((el) => {
    const btn = el as HTMLElement;
    btn.setAttribute('data-bound', '1');

    if (btn.classList.contains('ds-tts-locked')) return;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.dataset.ttsText || '';
      const id = btn.dataset.ttsId || '';
      if (text && id) ttsPlay(text, id);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public: TTS settings bar (language/gender/speed toggles)
// ═══════════════════════════════════════════════════════════════════════════════

export function ttsToolbarHtml(): string {
  return `
    <div class="ds-tts-toolbar">
      <span class="ds-tts-toolbar-label">🔊 Voix</span>
      <button class="ds-tts-toolbar-btn" id="ds-tts-lang" title="Langue">${state.language === 'fr' ? '🇫🇷' : '🇬🇧'}</button>
      <button class="ds-tts-toolbar-btn" id="ds-tts-gender" title="Genre">${state.gender === 'female' ? '♀' : '♂'}</button>
      <button class="ds-tts-toolbar-btn" id="ds-tts-speed-global" title="Vitesse">${state.speed}x</button>
    </div>
  `;
}

export function bindTTSToolbar(): void {
  document.getElementById('ds-tts-lang')?.addEventListener('click', () => {
    state.language = state.language === 'fr' ? 'en' : 'fr';
    saveSettings();
    const el = document.getElementById('ds-tts-lang');
    if (el) el.textContent = state.language === 'fr' ? '🇫🇷' : '🇬🇧';
  });

  document.getElementById('ds-tts-gender')?.addEventListener('click', () => {
    state.gender = state.gender === 'female' ? 'male' : 'female';
    saveSettings();
    const el = document.getElementById('ds-tts-gender');
    if (el) el.textContent = state.gender === 'female' ? '♀' : '♂';
  });

  document.getElementById('ds-tts-speed-global')?.addEventListener('click', () => {
    ttsCycleSpeed();
    const el = document.getElementById('ds-tts-speed-global');
    if (el) el.textContent = `${state.speed}x`;
  });
}

export function getState(): TTSState {
  return { ...state };
}
