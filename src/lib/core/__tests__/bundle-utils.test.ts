import { vi, describe, it, expect, beforeEach } from 'vitest';
import { minimalConfig, minimalService, defaultSettings } from './fixtures/configs';

vi.mock('@/lib/catalog', () => ({
  CatalogRegistry: {
    getService: vi.fn().mockResolvedValue(undefined),
    getCachedService: vi.fn().mockReturnValue(undefined),
  },
}));

import {
  getNextFreePort,
  uniqueComposeName,
  getAllUsedPorts,
  findBundleConflicts,
  findStackConflicts,
} from '@/lib/core/bundle-utils';
import { CatalogRegistry } from '@/lib/catalog';

beforeEach(() => {
  vi.mocked(CatalogRegistry.getService).mockResolvedValue(undefined);
  vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(undefined);
});

// ── getNextFreePort ──────────────────────────────────────────────────────────

describe('getNextFreePort', () => {
  it('returns start when not occupied', () => {
    expect(getNextFreePort(3000, new Set())).toBe(3000);
  });

  it('skips a single occupied port', () => {
    expect(getNextFreePort(3000, new Set([3000]))).toBe(3001);
  });

  it('skips consecutive occupied ports', () => {
    expect(getNextFreePort(3000, new Set([3000, 3001, 3002]))).toBe(3003);
  });

  it('works when occupied set is empty', () => {
    expect(getNextFreePort(8080, new Set())).toBe(8080);
  });
});

// ── uniqueComposeName ────────────────────────────────────────────────────────

describe('uniqueComposeName', () => {
  it('returns base name when existing list is empty', () => {
    expect(uniqueComposeName([], 'stack')).toBe('stack');
  });

  it('returns base name when not in existing list', () => {
    expect(uniqueComposeName(['media', 'monitoring'], 'stack')).toBe('stack');
  });

  it('appends suffix when base name exists', () => {
    expect(uniqueComposeName(['stack'], 'stack')).toBe('stack 2');
  });

  it('increments suffix until unique', () => {
    expect(uniqueComposeName(['stack', 'stack 2'], 'stack')).toBe('stack 3');
  });

  it('handles large existing suffix range', () => {
    const existing = ['stack', 'stack 2', 'stack 3', 'stack 4'];
    expect(uniqueComposeName(existing, 'stack')).toBe('stack 5');
  });
});

// ── getAllUsedPorts ──────────────────────────────────────────────────────────

describe('getAllUsedPorts', () => {
  it('returns empty set when no services and no occupied ports', () => {
    const result = getAllUsedPorts(minimalConfig(), defaultSettings);
    expect(result.size).toBe(0);
  });

  it('collects host ports from enabled services', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({ ports: [{ host: 8080, container: 80 }] }),
      },
    });
    const result = getAllUsedPorts(config, defaultSettings);
    expect(result.has(8080)).toBe(true);
  });

  it('also includes ports from disabled services', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({ enabled: false, ports: [{ host: 9090, container: 80 }] }),
      },
    });
    const result = getAllUsedPorts(config, defaultSettings);
    expect(result.has(9090)).toBe(true);
  });

  it('merges with settings.occupiedPorts', () => {
    const settings = { ...defaultSettings, occupiedPorts: [22, 80] };
    const result = getAllUsedPorts(minimalConfig(), settings);
    expect(result.has(22)).toBe(true);
    expect(result.has(80)).toBe(true);
  });

  it('deduplicates ports that appear in both', () => {
    const settings = { ...defaultSettings, occupiedPorts: [8080] };
    const config = minimalConfig({
      services: {
        nginx: minimalService({ ports: [{ host: 8080, container: 80 }] }),
      },
    });
    const result = getAllUsedPorts(config, settings);
    expect(result.size).toBe(1);
    expect(result.has(8080)).toBe(true);
  });
});

// ── findBundleConflicts ──────────────────────────────────────────────────────

describe('findBundleConflicts', () => {
  const bundle = {
    id: 'bundle-test',
    name: 'Test',
    description: '',
    mainServices: ['postgres', 'redis'],
    difficulty: 'easy' as const,
    resourceClass: 'light' as const,
  };

  it('returns empty when no conflicts', async () => {
    const conflicts = await findBundleConflicts(minimalConfig(), bundle, defaultSettings);
    expect(conflicts).toHaveLength(0);
  });

  it('detects service name collision', async () => {
    const config = minimalConfig({
      services: { postgres: minimalService({ serviceId: 'postgres' }) },
    });
    const conflicts = await findBundleConflicts(config, bundle, defaultSettings);
    expect(conflicts.some((c) => c.type === 'service' && c.key === 'postgres')).toBe(true);
  });

  it('detects port collision with existing service', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValueOnce({
      id: 'postgres', name: 'Postgres', defaultHostPort: 5432,
    } as any);

    const config = minimalConfig({
      services: {
        other: minimalService({ ports: [{ host: 5432, container: 5432 }] }),
      },
    });
    const conflicts = await findBundleConflicts(config, bundle, defaultSettings);
    expect(conflicts.some((c) => c.type === 'port')).toBe(true);
  });

  it('detects port collision with settings.occupiedPorts', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValueOnce({
      id: 'postgres', name: 'Postgres', defaultHostPort: 5432,
    } as any);

    const settings = { ...defaultSettings, occupiedPorts: [5432] };
    const conflicts = await findBundleConflicts(minimalConfig(), bundle, settings);
    expect(conflicts.some((c) => c.type === 'port')).toBe(true);
  });

  it('no false positive when ports differ', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue({
      id: 'postgres', name: 'Postgres', defaultHostPort: 5432,
    } as any);

    const config = minimalConfig({
      services: {
        other: minimalService({ ports: [{ host: 8080, container: 80 }] }),
      },
    });
    const conflicts = await findBundleConflicts(config, bundle, defaultSettings);
    expect(conflicts.every((c) => c.type !== 'port')).toBe(true);
  });
});

// ── findStackConflicts ───────────────────────────────────────────────────────

describe('findStackConflicts', () => {
  it('returns empty when no conflicts', async () => {
    const incoming = minimalConfig({
      services: { redis: minimalService({ serviceId: 'redis' }) },
    });
    const conflicts = await findStackConflicts(minimalConfig(), incoming, defaultSettings);
    expect(conflicts).toHaveLength(0);
  });

  it('detects service name collision', async () => {
    const current = minimalConfig({
      services: { redis: minimalService({ serviceId: 'redis' }) },
    });
    const incoming = minimalConfig({
      services: { redis: minimalService({ serviceId: 'redis' }) },
    });
    const conflicts = await findStackConflicts(current, incoming, defaultSettings);
    expect(conflicts.some((c) => c.type === 'service' && c.key === 'redis')).toBe(true);
  });

  it('detects port collision between stacks', async () => {
    const current = minimalConfig({
      services: {
        app: minimalService({ ports: [{ host: 3000, container: 3000 }] }),
      },
    });
    const incoming = minimalConfig({
      services: {
        api: minimalService({ ports: [{ host: 3000, container: 3000 }] }),
      },
    });
    const conflicts = await findStackConflicts(current, incoming, defaultSettings);
    expect(conflicts.some((c) => c.type === 'port')).toBe(true);
  });

  it('skips disabled services in incoming', async () => {
    const current = minimalConfig({
      services: { redis: minimalService({ serviceId: 'redis' }) },
    });
    const incoming = minimalConfig({
      services: { redis: minimalService({ serviceId: 'redis', enabled: false }) },
    });
    const conflicts = await findStackConflicts(current, incoming, defaultSettings);
    expect(conflicts).toHaveLength(0);
  });
});
