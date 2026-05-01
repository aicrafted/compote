export interface StorageDriver {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
}

export const isServerMode = import.meta.env.VITE_STORAGE_MODE === 'server';

class IdbDriver implements StorageDriver {
  async get<T>(key: string): Promise<T | undefined> {
    const { get } = await import('idb-keyval');
    return get<T>(key);
  }

  async set<T>(key: string, value: T): Promise<void> {
    const { set } = await import('idb-keyval');
    await set(key, value);
  }

  async del(key: string): Promise<void> {
    const { del } = await import('idb-keyval');
    await del(key);
  }
}

class ApiDriver implements StorageDriver {
  private base = '/api/store';

  async get<T>(key: string): Promise<T | undefined> {
    const response = await fetch(`${this.base}/${encodeURIComponent(key)}`);
    if (response.status === 404) return undefined;
    if (!response.ok) throw new Error(`Store get failed: ${response.status}`);
    return response.json() as Promise<T>;
  }

  async set<T>(key: string, value: T): Promise<void> {
    const response = await fetch(`${this.base}/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    });
    if (!response.ok) throw new Error(`Store set failed: ${response.status}`);
  }

  async del(key: string): Promise<void> {
    const response = await fetch(`${this.base}/${encodeURIComponent(key)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Store del failed: ${response.status}`);
  }
}

export const driver: StorageDriver =
  isServerMode
    ? new ApiDriver()
    : new IdbDriver();
