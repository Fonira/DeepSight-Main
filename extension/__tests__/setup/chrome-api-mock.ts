/**
 * Chrome Extension API Mock — Complète pour Jest/jsdom
 *
 * Mock les APIs Chrome essentielles utilisées par l'extension DeepSight :
 * - chrome.storage.local (get/set/remove)
 * - chrome.storage.sync (get/set)
 * - chrome.storage.onChanged
 * - chrome.runtime (sendMessage, getURL, onMessage, onInstalled)
 * - chrome.tabs (query, sendMessage, create)
 * - chrome.identity (getRedirectURL, launchWebAuthFlow)
 * - chrome.action (setBadgeText, setBadgeBackgroundColor)
 * - chrome.alarms (create, onAlarm)
 */

type StorageData = Record<string, unknown>;
type StorageCallback = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, areaName: string) => void;

// ── In-memory storage ──
const localStore: StorageData = {};
const syncStore: StorageData = {};
const storageListeners: StorageCallback[] = [];

function createStorageArea(store: StorageData, areaName: string) {
  return {
    get: jest.fn((keys: string | string[]) => {
      const keyArray = typeof keys === 'string' ? [keys] : keys;
      const result: StorageData = {};
      for (const key of keyArray) {
        if (key in store) {
          result[key] = store[key];
        }
      }
      return Promise.resolve(result);
    }),

    set: jest.fn((items: StorageData) => {
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const [key, value] of Object.entries(items)) {
        changes[key] = { oldValue: store[key], newValue: value };
        store[key] = value;
      }
      // Notify listeners
      for (const listener of storageListeners) {
        listener(changes, areaName);
      }
      return Promise.resolve();
    }),

    remove: jest.fn((keys: string | string[]) => {
      const keyArray = typeof keys === 'string' ? [keys] : keys;
      const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
      for (const key of keyArray) {
        if (key in store) {
          changes[key] = { oldValue: store[key] };
          delete store[key];
        }
      }
      for (const listener of storageListeners) {
        listener(changes, areaName);
      }
      return Promise.resolve();
    }),

    clear: jest.fn(() => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
      return Promise.resolve();
    }),
  };
}

// ── chrome.runtime ──
const messageListeners: Array<(message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void> = [];

const chromeRuntime = {
  sendMessage: jest.fn((_message: unknown) => Promise.resolve({})),
  getURL: jest.fn((path: string) => `chrome-extension://mock-id/${path}`),
  onMessage: {
    addListener: jest.fn((callback: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void) => {
      messageListeners.push(callback);
    }),
    removeListener: jest.fn(),
    hasListener: jest.fn(() => false),
  },
  onInstalled: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
  },
  id: 'mock-extension-id',
  getManifest: jest.fn(() => ({
    name: 'DeepSight',
    version: '2.0.0',
    manifest_version: 3,
  })),
};

// ── chrome.tabs ──
const chromeTabs = {
  query: jest.fn((_queryInfo: unknown, callback?: (tabs: Array<{ id?: number; url?: string; title?: string }>) => void) => {
    const result = [{ id: 1, url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Test Video' }];
    if (callback) {
      callback(result);
      return undefined;
    }
    return Promise.resolve(result);
  }),
  sendMessage: jest.fn(() => Promise.resolve()),
  create: jest.fn(() => Promise.resolve({ id: 2 })),
};

// ── chrome.identity ──
const chromeIdentity = {
  getRedirectURL: jest.fn(() => 'https://mock-extension-id.chromiumapp.org/'),
  launchWebAuthFlow: jest.fn(() => Promise.resolve('https://redirect#access_token=mock-token')),
};

// ── chrome.action ──
const chromeAction = {
  setBadgeText: jest.fn(),
  setBadgeBackgroundColor: jest.fn(),
};

// ── chrome.alarms ──
const alarmListeners: Array<(alarm: { name: string }) => void> = [];

const chromeAlarms = {
  create: jest.fn(),
  onAlarm: {
    addListener: jest.fn((callback: (alarm: { name: string }) => void) => {
      alarmListeners.push(callback);
    }),
    removeListener: jest.fn(),
  },
};

// ── Assemble global chrome object ──
const chromeMock = {
  storage: {
    local: createStorageArea(localStore, 'local'),
    sync: createStorageArea(syncStore, 'sync'),
    onChanged: {
      addListener: jest.fn((callback: StorageCallback) => {
        storageListeners.push(callback);
      }),
      removeListener: jest.fn((callback: StorageCallback) => {
        const index = storageListeners.indexOf(callback);
        if (index >= 0) storageListeners.splice(index, 1);
      }),
    },
  },
  runtime: chromeRuntime,
  tabs: chromeTabs,
  identity: chromeIdentity,
  action: chromeAction,
  alarms: chromeAlarms,
};

// Assign to global
(global as unknown as Record<string, unknown>).chrome = chromeMock;

// ── Helpers for tests ──

/**
 * Reset all chrome mock storage and call history.
 * Call in beforeEach() to start fresh.
 */
export function resetChromeMocks(): void {
  // Clear stores
  for (const key of Object.keys(localStore)) delete localStore[key];
  for (const key of Object.keys(syncStore)) delete syncStore[key];
  storageListeners.length = 0;
  messageListeners.length = 0;
  alarmListeners.length = 0;

  // Reset all jest mocks
  jest.clearAllMocks();
}

/**
 * Seed local storage with data for test setup.
 */
export function seedLocalStorage(data: StorageData): void {
  Object.assign(localStore, data);
}

/**
 * Seed sync storage with data for test setup.
 */
export function seedSyncStorage(data: StorageData): void {
  Object.assign(syncStore, data);
}

export { chromeMock, localStore, syncStore, messageListeners, alarmListeners };
