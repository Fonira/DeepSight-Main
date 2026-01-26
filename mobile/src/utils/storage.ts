import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { STORAGE_KEYS } from '../constants/config';

// Check if we're running on web - must be a function for runtime evaluation
const isWeb = (): boolean => {
  // Check multiple indicators for web platform
  if (Platform.OS === 'web') return true;
  if (typeof document !== 'undefined') return true;
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') return true;
  return false;
};

// Web storage fallback using localStorage
const webStorage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('localStorage setItem error:', error);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      console.error('localStorage getItem error:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('localStorage removeItem error:', error);
    }
  },
};

// Secure storage for sensitive data (tokens)
// Uses localStorage on web, SecureStore on native
export const secureStorage = {
  async setItem(key: string, value: string): Promise<void> {
    // Always check isWeb() at runtime
    if (isWeb()) {
      await webStorage.setItem(key, value);
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
      // Fallback to AsyncStorage if SecureStore fails (e.g., on simulator)
      await AsyncStorage.setItem(key, value);
    }
  },

  async getItem(key: string): Promise<string | null> {
    // Always check isWeb() at runtime
    if (isWeb()) {
      return await webStorage.getItem(key);
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      // Fallback to AsyncStorage
      return await AsyncStorage.getItem(key);
    }
  },

  async removeItem(key: string): Promise<void> {
    // Always check isWeb() at runtime
    if (isWeb()) {
      await webStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
      await AsyncStorage.removeItem(key);
    }
  },
};

// Regular storage for non-sensitive data
export const storage = {
  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error('AsyncStorage setItem error:', error);
    }
  },

  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.error('AsyncStorage getItem error:', error);
      return null;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('AsyncStorage removeItem error:', error);
    }
  },

  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
    } catch (error) {
      console.error('AsyncStorage setObject error:', error);
    }
  },

  async getObject<T>(key: string): Promise<T | null> {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('AsyncStorage getObject error:', error);
      return null;
    }
  },

  async clear(): Promise<void> {
    try {
      await AsyncStorage.clear();
    } catch (error) {
      console.error('AsyncStorage clear error:', error);
    }
  },

  async getAllKeys(): Promise<readonly string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('AsyncStorage getAllKeys error:', error);
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
