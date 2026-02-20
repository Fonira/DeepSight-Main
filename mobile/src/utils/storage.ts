import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';

// Debug flag - set to true to see storage operations in console
const DEBUG_STORAGE = __DEV__;

const log = (message: string, ...args: any[]) => {
  if (DEBUG_STORAGE) {
    console.log(`[Storage] ${message}`, ...args);
  }
};

// Check if we're running on web - must be a function for runtime evaluation
const isWeb = (): boolean => {
  // Check multiple indicators for web platform
  if (Platform.OS === 'web') return true;
  if (typeof document !== 'undefined') return true;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') return true;
  return false;
};

// Check if SecureStore is available (may not be on some Android devices)
const isSecureStoreAvailable = async (): Promise<boolean> => {
  if (isWeb()) return false;
  try {
    // Try a simple operation to check availability
    await SecureStore.getItemAsync('__test_availability__');
    return true;
  } catch (error) {
    log('SecureStore not available, using AsyncStorage fallback');
    return false;
  }
};

// Cache the availability check result
let secureStoreAvailable: boolean | null = null;

// Web storage fallback using localStorage
const webStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      if (__DEV__) { console.error('localStorage setItem error:', error); }
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      if (__DEV__) { console.error('localStorage getItem error:', error); }
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      if (__DEV__) { console.error('localStorage removeItem error:', error); }
    }
  },
};

// Secure storage for sensitive data (tokens)
// Uses localStorage on web, SecureStore on native (with AsyncStorage fallback)
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    log(`setItem: ${key}`);
    
    // Always check isWeb() at runtime
    if (isWeb()) {
      await webStorage.setItem(key, value);
      return;
    }
    
    // Check SecureStore availability (cached after first check)
    if (secureStoreAvailable === null) {
      secureStoreAvailable = await isSecureStoreAvailable();
    }
    
    if (!secureStoreAvailable) {
      // Use AsyncStorage directly if SecureStore is not available
      log(`setItem using AsyncStorage fallback: ${key}`);
      await AsyncStorage.setItem(key, value);
      return;
    }
    
    try {
      await SecureStore.setItemAsync(key, value);
      log(`setItem success (SecureStore): ${key}`);
    } catch (error) {
      if (__DEV__) { console.error('SecureStore setItem error:', error); }
      // Fallback to AsyncStorage if SecureStore fails
      log(`setItem fallback to AsyncStorage: ${key}`);
      await AsyncStorage.setItem(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    log(`getItem: ${key}`);
    
    // Always check isWeb() at runtime
    if (isWeb()) {
      return await webStorage.getItem(key);
    }
    
    // Check SecureStore availability (cached after first check)
    if (secureStoreAvailable === null) {
      secureStoreAvailable = await isSecureStoreAvailable();
    }
    
    if (!secureStoreAvailable) {
      // Use AsyncStorage directly if SecureStore is not available
      const value = await AsyncStorage.getItem(key);
      log(`getItem from AsyncStorage fallback: ${key} = ${value ? 'exists' : 'null'}`);
      return value;
    }
    
    try {
      // Try SecureStore first
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue !== null) {
        log(`getItem from SecureStore: ${key} = exists`);
        return secureValue;
      }
      
      // If not in SecureStore, check AsyncStorage (migration case)
      const asyncValue = await AsyncStorage.getItem(key);
      if (asyncValue !== null) {
        log(`getItem from AsyncStorage (migration): ${key} = exists`);
        // Migrate to SecureStore for next time
        try {
          await SecureStore.setItemAsync(key, asyncValue);
          await AsyncStorage.removeItem(key);
        } catch {
          // Ignore migration errors
        }
        return asyncValue;
      }
      
      log(`getItem: ${key} = null (not found)`);
      return null;
    } catch (error) {
      if (__DEV__) { console.error('SecureStore getItem error:', error); }
      // Fallback to AsyncStorage
      const value = await AsyncStorage.getItem(key);
      log(`getItem fallback to AsyncStorage: ${key} = ${value ? 'exists' : 'null'}`);
      return value;
    }
  },

  async removeItem(key: string): Promise<void> {
    log(`removeItem: ${key}`);
    
    // Always check isWeb() at runtime
    if (isWeb()) {
      await webStorage.removeItem(key);
      return;
    }
    
    // Remove from both stores to ensure complete cleanup
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      // Ignore errors - item might not exist
    }
    
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      // Ignore errors - item might not exist
    }
    
    log(`removeItem complete: ${key}`);
  },
};

// Regular storage for non-sensitive data
export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage setItem error:', error); }
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage getItem error:', error); }
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage removeItem error:', error); }
    }
  },

  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage setObject error:', error); }
    }
  },

  async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage getObject error:', error); }
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage clear error:', error); }
    }
  },

  async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      if (__DEV__) { console.error('AsyncStorage getAllKeys error:', error); }
      return [];
    }
  },
};

// Token management
export const tokenStorage = {
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      secureStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
      secureStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken),
    ]);
  },

  async getAccessToken(): Promise<string | null> {
    return await secureStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  },

  async getRefreshToken(): Promise<string | null> {
    return await secureStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  },

  async clearTokens(): Promise<void> {
    await Promise.all([
      secureStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN),
      secureStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN),
    ]);
  },

  async hasTokens(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    return accessToken != null;
  },
};

// User storage
export const userStorage = {
  async setUser(user: object): Promise<void> {
    await storage.setObject(STORAGE_KEYS.USER, user);
  },

  async getUser<T>(): Promise<T | null> {
    return await storage.getObject<T>(STORAGE_KEYS.USER);
  },

  async clearUser(): Promise<void> {
    await storage.removeItem(STORAGE_KEYS.USER);
  },
};

export default {
  secureStorage,
  storage,
  tokenStorage,
  userStorage,
};
