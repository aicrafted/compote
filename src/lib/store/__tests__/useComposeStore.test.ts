// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock storage before importing the store so persist middleware doesn't touch IDB
vi.mock('@/lib/store/storage', () => ({
  idbStorage: {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/storage/ComposeRepository', () => ({
  composeRepository: {
    save: vi.fn().mockResolvedValue(undefined),
    get:  vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/lib/catalog/registry', () => ({
  CatalogRegistry: {
    getService:          vi.fn().mockResolvedValue(undefined),
    getCachedService:    vi.fn().mockReturnValue(undefined),
    getAllCachedServices: vi.fn().mockReturnValue([]),
    cacheService:        vi.fn(),
    cacheBundles:        vi.fn(),
    getAllBundles:        vi.fn().mockReturnValue([]),
    getBundle:           vi.fn().mockReturnValue(undefined),
  },
}));

vi.mock('@/lib/core/importer', () => ({
  parseComposeToStack: vi.fn().mockReturnValue({
    services: {},
    networks: {},
    volumes: {},
    configs: {},
    secrets: {},
  }),
}));

import { useComposeStore } from '../useComposeStore';
import { composeRepository } from '@/lib/storage/ComposeRepository';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { parseComposeToStack } from '@/lib/core/importer';
import type { ServiceSpec } from '@/types';

beforeEach(() => {
  useComposeStore.getState().resetStack();
  vi.clearAllMocks();
  vi.mocked(composeRepository.save).mockResolvedValue(undefined);
  vi.mocked(composeRepository.get).mockResolvedValue(null);
  vi.mocked(CatalogRegistry.getService).mockResolvedValue(undefined);
  vi.mocked(CatalogRegistry.getAllCachedServices).mockReturnValue([]);
});

// ── upsertService ────────────────────────────────────────────────────────────

describe('upsertService', () => {
  it('creates a new service', () => {
    useComposeStore.getState().upsertService('nginx', { serviceId: 'nginx', image: 'nginx:latest' });
    const { config } = useComposeStore.getState();
    expect(config.services['nginx']).toBeDefined();
    expect(config.services['nginx'].serviceId).toBe('nginx');
  });

  it('sets isDirty on create', () => {
    useComposeStore.getState().upsertService('nginx', { serviceId: 'nginx', image: 'nginx:latest' });
    expect(useComposeStore.getState().isDirty).toBe(true);
  });

  it('defaults enabled to true for new services', () => {
    useComposeStore.getState().upsertService('nginx', { serviceId: 'nginx', image: 'nginx:latest' });
    expect(useComposeStore.getState().config.services['nginx'].enabled).toBe(true);
  });

  it('merges partial update without overwriting unspecified fields', () => {
    useComposeStore.getState().upsertService('app', {
      serviceId: 'app',
      image: 'app:1.0',
      env: { FOO: 'bar' },
    });
    useComposeStore.getState().upsertService('app', { image: 'app:2.0' });
    const svc = useComposeStore.getState().config.services['app'];
    expect(svc.image).toBe('app:2.0');
    expect(svc.env).toEqual({ FOO: 'bar' });
  });

  it('does not set isDirty when nothing changed', () => {
    useComposeStore.getState().upsertService('nginx', { serviceId: 'nginx', image: 'nginx:latest' });
    useComposeStore.setState({ isDirty: false });
    useComposeStore.getState().upsertService('nginx', { image: 'nginx:latest' });
    expect(useComposeStore.getState().isDirty).toBe(false);
  });
});

// ── removeService ────────────────────────────────────────────────────────────

describe('removeService', () => {
  beforeEach(() => {
    useComposeStore.getState().upsertService('nginx', { serviceId: 'nginx', image: 'nginx:latest' });
    useComposeStore.getState().upsertService('redis', { serviceId: 'redis', image: 'redis:7' });
    useComposeStore.setState({ isDirty: false });
  });

  it('removes the service', () => {
    useComposeStore.getState().removeService('nginx');
    expect(useComposeStore.getState().config.services['nginx']).toBeUndefined();
  });

  it('keeps other services intact', () => {
    useComposeStore.getState().removeService('nginx');
    expect(useComposeStore.getState().config.services['redis']).toBeDefined();
  });

  it('sets isDirty', () => {
    useComposeStore.getState().removeService('nginx');
    expect(useComposeStore.getState().isDirty).toBe(true);
  });

  it('clears activeInstanceId when removing the active service', () => {
    useComposeStore.setState({ activeInstanceId: 'nginx' });
    useComposeStore.getState().removeService('nginx');
    expect(useComposeStore.getState().activeInstanceId).not.toBe('nginx');
  });

  it('preserves activeInstanceId when removing a different service', () => {
    useComposeStore.setState({ activeInstanceId: 'redis' });
    useComposeStore.getState().removeService('nginx');
    expect(useComposeStore.getState().activeInstanceId).toBe('redis');
  });
});

// ── renameService ────────────────────────────────────────────────────────────

describe('renameService', () => {
  beforeEach(() => {
    useComposeStore.getState().upsertService('app', { serviceId: 'app', image: 'app:1.0' });
    useComposeStore.setState({ isDirty: false });
  });

  it('moves service to new key', () => {
    useComposeStore.getState().renameService('app', 'webapp');
    const { config } = useComposeStore.getState();
    expect(config.services['webapp']).toBeDefined();
    expect(config.services['app']).toBeUndefined();
  });

  it('sets isDirty', () => {
    useComposeStore.getState().renameService('app', 'webapp');
    expect(useComposeStore.getState().isDirty).toBe(true);
  });

  it('updates activeInstanceId when renaming the active service', () => {
    useComposeStore.setState({ activeInstanceId: 'app' });
    useComposeStore.getState().renameService('app', 'webapp');
    expect(useComposeStore.getState().activeInstanceId).toBe('webapp');
  });

  it('updates string dependsOn references in other services', () => {
    useComposeStore.getState().upsertService('worker', {
      serviceId: 'worker',
      dependsOn: ['app'],
    });
    useComposeStore.getState().renameService('app', 'webapp');
    const worker = useComposeStore.getState().config.services['worker'];
    expect(worker.dependsOn).toContain('webapp');
    expect(worker.dependsOn).not.toContain('app');
  });

  it('updates object dependsOn references in other services', () => {
    useComposeStore.getState().upsertService('worker', {
      serviceId: 'worker',
      dependsOn: [{ service: 'app', condition: 'service_healthy' }],
    });
    useComposeStore.getState().renameService('app', 'webapp');
    const worker = useComposeStore.getState().config.services['worker'];
    const dep = worker.dependsOn?.[0];
    expect(typeof dep === 'object' && dep.service).toBe('webapp');
  });

  it('is a no-op when new name already exists', () => {
    useComposeStore.getState().upsertService('webapp', { serviceId: 'webapp', image: 'webapp:latest' });
    useComposeStore.setState({ isDirty: false });
    useComposeStore.getState().renameService('app', 'webapp');
    // Both keys should still exist unchanged
    expect(useComposeStore.getState().config.services['app']).toBeDefined();
    expect(useComposeStore.getState().isDirty).toBe(false);
  });

  it('is a no-op when old name does not exist', () => {
    useComposeStore.getState().renameService('ghost', 'phantom');
    expect(useComposeStore.getState().isDirty).toBe(false);
  });
});

// ── applyBundle ──────────────────────────────────────────────────────────────

describe('applyBundle', () => {
  const bundle = {
    id: 'bundle-db',
    name: 'Database',
    description: '',
    mainServices: ['postgres', 'redis'],
    difficulty: 'easy' as const,
    resourceClass: 'medium' as const,
  };

  const pgSpec: Partial<ServiceSpec> = {
    id: 'postgres',
    name: 'PostgreSQL',
    image: 'postgres:15',
    containerPorts: [5432],
    defaultHostPort: 5432,
    requiredEnv: [{ name: 'POSTGRES_PASSWORD', label: 'Password', required: true }],
    volumes: [],
    publicExposure: 'never',
  };

  it('adds all mainServices to config', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(pgSpec as ServiceSpec);
    await useComposeStore.getState().applyBundle(bundle);
    const { config } = useComposeStore.getState();
    expect(config.services['postgres']).toBeDefined();
    expect(config.services['redis']).toBeDefined();
  });

  it('sets isDirty', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(pgSpec as ServiceSpec);
    await useComposeStore.getState().applyBundle(bundle);
    expect(useComposeStore.getState().isDirty).toBe(true);
  });

  it('uses defaultHostPort from spec', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(pgSpec as ServiceSpec);
    await useComposeStore.getState().applyBundle(bundle);
    const pg = useComposeStore.getState().config.services['postgres'];
    expect(pg.ports[0]?.host).toBe(5432);
  });

  it('applies port override from resolutions', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(pgSpec as ServiceSpec);
    await useComposeStore.getState().applyBundle(bundle, {
      services: {},
      ports: { 5432: 5433 },
      volumes: {},
      networks: {},
    });
    const pg = useComposeStore.getState().config.services['postgres'];
    expect(pg.ports[0]?.host).toBe(5433);
  });

  it('skips services with resolution=skip', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(pgSpec as ServiceSpec);
    await useComposeStore.getState().applyBundle(bundle, {
      services: { postgres: 'skip' },
      ports: {},
      volumes: {},
      networks: {},
    });
    expect(useComposeStore.getState().config.services['postgres']).toBeUndefined();
  });

  it('skips unknown services (no spec returned)', async () => {
    vi.mocked(CatalogRegistry.getService).mockResolvedValue(undefined);
    await useComposeStore.getState().applyBundle(bundle);
    expect(Object.keys(useComposeStore.getState().config.services)).toHaveLength(0);
  });
});

// ── importYaml ───────────────────────────────────────────────────────────────

describe('importYaml', () => {
  it('merges imported services into existing config', () => {
    useComposeStore.getState().upsertService('existing', { serviceId: 'existing', image: 'existing:1.0' });
    vi.mocked(parseComposeToStack).mockReturnValue({
      services: { imported: { serviceId: 'imported', enabled: true, ports: [], env: {},
                               labels: {}, volumes: [], networks: [], publiclyExposed: false } },
      networks: {},
      volumes: {},
      configs: {},
      secrets: {},
    } as any);

    useComposeStore.getState().importYaml('services:\n  imported:\n    image: app:latest');
    const { config } = useComposeStore.getState();
    expect(config.services['existing']).toBeDefined();
    expect(config.services['imported']).toBeDefined();
  });

  it('sets isDirty', () => {
    useComposeStore.getState().importYaml('');
    expect(useComposeStore.getState().isDirty).toBe(true);
  });

  it('merges top-level networks from import', () => {
    vi.mocked(parseComposeToStack).mockReturnValue({
      services: {},
      networks: { proxy: { external: true } },
      volumes: {},
      configs: {},
      secrets: {},
    } as any);
    useComposeStore.getState().importYaml('');
    expect(useComposeStore.getState().config.networks?.['proxy']).toBeDefined();
  });
});

// ── updateStackConfig ────────────────────────────────────────────────────────

describe('updateStackConfig', () => {
  it('applies partial update', () => {
    useComposeStore.getState().upsertService('app', { serviceId: 'app', image: 'app:latest' });
    useComposeStore.getState().updateStackConfig({ projectName: 'myproject' });
    expect(useComposeStore.getState().config.projectName).toBe('myproject');
    expect(useComposeStore.getState().config.services['app']).toBeDefined();
  });

  it('sets isDirty', () => {
    useComposeStore.getState().updateStackConfig({ projectName: 'x' });
    expect(useComposeStore.getState().isDirty).toBe(true);
  });
});

// ── saveCompose / loadCompose ─────────────────────────────────────────────────

describe('saveCompose', () => {
  it('calls repository.save with current config', async () => {
    useComposeStore.getState().upsertService('app', { serviceId: 'app' });
    await useComposeStore.getState().saveCompose('host-1', 'compose-1');
    expect(composeRepository.save).toHaveBeenCalledWith(
      'host-1',
      'compose-1',
      useComposeStore.getState().config
    );
  });

  it('clears isDirty after save', async () => {
    useComposeStore.getState().upsertService('app', { serviceId: 'app' });
    await useComposeStore.getState().saveCompose('host-1', 'compose-1');
    expect(useComposeStore.getState().isDirty).toBe(false);
  });
});

describe('loadCompose', () => {
  it('sets config from repository', async () => {
    const stored = { services: { db: { serviceId: 'db', enabled: true, ports: [], env: {},
                                       labels: {}, volumes: [], networks: [], publiclyExposed: false } },
                     networks: {}, volumes: {}, configs: {}, secrets: {} };
    vi.mocked(composeRepository.get).mockResolvedValue(stored as any);
    await useComposeStore.getState().loadCompose('host-1', 'compose-1');
    expect(useComposeStore.getState().config.services['db']).toBeDefined();
  });

  it('resets to initial state when repository returns null', async () => {
    useComposeStore.getState().upsertService('app', { serviceId: 'app' });
    vi.mocked(composeRepository.get).mockResolvedValue(null);
    await useComposeStore.getState().loadCompose('host-1', 'compose-1');
    expect(Object.keys(useComposeStore.getState().config.services)).toHaveLength(0);
  });

  it('clears isDirty after load', async () => {
    vi.mocked(composeRepository.get).mockResolvedValue(null);
    await useComposeStore.getState().loadCompose('host-1', 'compose-1');
    expect(useComposeStore.getState().isDirty).toBe(false);
  });
});
