import { driver } from '@/lib/storage/driver';
import type { StateStorage } from 'zustand/middleware';

export const idbStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await driver.get<string>(name)) ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await driver.set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await driver.del(name);
  },
};
