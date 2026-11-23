import AsyncStorage from "@react-native-async-storage/async-storage";
import type { StateStorage } from "zustand/middleware";

const memoryFallback = new Map<string, string>();

function getWebLocalStorage(): Storage | null {
  try {
    if (
      typeof globalThis !== "undefined" &&
      "localStorage" in globalThis &&
      globalThis.localStorage
    ) {
      return globalThis.localStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

export const safeStateStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(name);
      if (value !== null) {
        memoryFallback.set(name, value);
      }
      return value;
    } catch {
      const webStore = getWebLocalStorage();
      if (webStore) {
        try {
          return webStore.getItem(name);
        } catch {
          // ignore
        }
      }
      return memoryFallback.get(name) ?? null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    memoryFallback.set(name, value);
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      const webStore = getWebLocalStorage();
      if (webStore) {
        try {
          webStore.setItem(name, value);
        } catch {
          // ignore
        }
      }
    }
  },

  removeItem: async (name: string): Promise<void> => {
    memoryFallback.delete(name);
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      const webStore = getWebLocalStorage();
      if (webStore) {
        try {
          webStore.removeItem(name);
        } catch {
          // ignore
        }
      }
    }
  },
};
