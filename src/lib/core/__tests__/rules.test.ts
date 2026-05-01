import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/catalog/registry', () => ({
  CatalogRegistry: {
    getCachedService: vi.fn().mockReturnValue(undefined),
  },
}));

import { validateStack } from '@/lib/core/rules';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { minimalConfig, minimalService, defaultSettings } from './fixtures/configs';
import type { ServiceSpec } from '@/types';

beforeEach(() => {
  vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(undefined);
});

// ── validateStack summary ────────────────────────────────────────────────────

describe('validateStack — summary', () => {
  it('returns isValid true for clean config', () => {
    const result = validateStack(minimalConfig(), defaultSettings);
    expect(result.isValid).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it('counts errors correctly', () => {
    const config = minimalConfig({
      services: {
        a: minimalService({ ports: [{ host: 80, container: 80 }] }),
        b: minimalService({ ports: [{ host: 80, container: 80 }] }),
      },
    });
    const result = validateStack(config, defaultSettings);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.isValid).toBe(false);
  });

  it('returns empty results for empty config', () => {
    const result = validateStack(minimalConfig(), defaultSettings);
    expect(result.results).toHaveLength(0);
  });
});

// ── checkPortConflicts ───────────────────────────────────────────────────────

describe('checkPortConflicts', () => {
  it('no error when ports are unique', () => {
    const config = minimalConfig({
      services: {
        a: minimalService({ ports: [{ host: 80, container: 80 }] }),
        b: minimalService({ ports: [{ host: 443, container: 443 }] }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('port-conflict'))).toHaveLength(0);
  });

  it('error when two enabled services share a host port', () => {
    const config = minimalConfig({
      services: {
        a: minimalService({ ports: [{ host: 8080, container: 80 }] }),
        b: minimalService({ ports: [{ host: 8080, container: 80 }] }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    const conflict = results.find(r => r.id === 'port-conflict-8080');
    expect(conflict).toBeDefined();
    expect(conflict?.severity).toBe('error');
    expect(conflict?.affectedServices).toContain('a');
    expect(conflict?.affectedServices).toContain('b');
  });

  it('no error when the conflicting service is disabled', () => {
    const config = minimalConfig({
      services: {
        a: minimalService({ ports: [{ host: 8080, container: 80 }] }),
        b: minimalService({ enabled: false, ports: [{ host: 8080, container: 80 }] }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('port-conflict'))).toHaveLength(0);
  });

  it('marks canAutoFix true', () => {
    const config = minimalConfig({
      services: {
        a: minimalService({ ports: [{ host: 80, container: 80 }] }),
        b: minimalService({ ports: [{ host: 80, container: 80 }] }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.find(r => r.id.startsWith('port-conflict'))?.canAutoFix).toBe(true);
  });
});

// ── checkHostPortConflicts ───────────────────────────────────────────────────

describe('checkHostPortConflicts', () => {
  it('no error when service port not in occupiedPorts', () => {
    const config = minimalConfig({
      services: { a: minimalService({ ports: [{ host: 9000, container: 9000 }] }) },
    });
    const settings = { ...defaultSettings, occupiedPorts: [80, 443] };
    const { results } = validateStack(config, settings);
    expect(results.filter(r => r.id.startsWith('host-port-conflict'))).toHaveLength(0);
  });

  it('error when service port matches occupiedPorts', () => {
    const config = minimalConfig({
      services: { a: minimalService({ ports: [{ host: 80, container: 80 }] }) },
    });
    const settings = { ...defaultSettings, occupiedPorts: [80] };
    const { results } = validateStack(config, settings);
    const conflict = results.find(r => r.id.startsWith('host-port-conflict'));
    expect(conflict).toBeDefined();
    expect(conflict?.severity).toBe('error');
    expect(conflict?.affectedServices).toContain('a');
  });

  it('no error for disabled service with occupied port', () => {
    const config = minimalConfig({
      services: { a: minimalService({ enabled: false, ports: [{ host: 80, container: 80 }] }) },
    });
    const settings = { ...defaultSettings, occupiedPorts: [80] };
    const { results } = validateStack(config, settings);
    expect(results.filter(r => r.id.startsWith('host-port-conflict'))).toHaveLength(0);
  });
});

// ── checkMissingDependencies ─────────────────────────────────────────────────

describe('checkMissingDependencies', () => {
  const pgSpec: ServiceSpec = {
    id: 'nextcloud',
    name: 'Nextcloud',
    category: 'CLOUD',
    description: '',
    image: 'nextcloud:latest',
    tags: [],
    containerPorts: [],
    requires: ['postgres'],
    requiredEnv: [],
  };

  it('no error when dependency is present and enabled', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockImplementation((id) =>
      id === 'nextcloud' ? pgSpec : undefined
    );
    const config = minimalConfig({
      services: {
        nextcloud: minimalService({ serviceId: 'nextcloud', image: 'nextcloud:latest' }),
        postgres: minimalService({ serviceId: 'postgres', image: 'postgres:15' }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('missing-dep'))).toHaveLength(0);
  });

  it('error when hard dependency is absent', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockImplementation((id) =>
      id === 'nextcloud' ? pgSpec : undefined
    );
    const config = minimalConfig({
      services: {
        nextcloud: minimalService({ serviceId: 'nextcloud', image: 'nextcloud:latest' }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    const err = results.find(r => r.id === 'missing-dep-nextcloud-postgres');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('error');
    expect(err?.metadata?.missingDependencyId).toBe('postgres');
  });

  it('error when dependency exists but is disabled', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockImplementation((id) =>
      id === 'nextcloud' ? pgSpec : undefined
    );
    const config = minimalConfig({
      services: {
        nextcloud: minimalService({ serviceId: 'nextcloud', image: 'nextcloud:latest' }),
        postgres: minimalService({ serviceId: 'postgres', image: 'postgres:15', enabled: false }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.find(r => r.id === 'missing-dep-nextcloud-postgres')).toBeDefined();
  });

  it('no error for disabled service with missing dependency', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockImplementation((id) =>
      id === 'nextcloud' ? pgSpec : undefined
    );
    const config = minimalConfig({
      services: {
        nextcloud: minimalService({ serviceId: 'nextcloud', image: 'nextcloud:latest', enabled: false }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('missing-dep'))).toHaveLength(0);
  });

  it('no error when service has no requires (fallback spec)', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(undefined);
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('missing-dep'))).toHaveLength(0);
  });
});

// ── checkRequiredEnv ─────────────────────────────────────────────────────────

describe('checkRequiredEnv', () => {
  const specWithEnv: ServiceSpec = {
    id: 'db',
    name: 'Database',
    category: 'DATABASE',
    description: '',
    image: 'postgres:15',
    tags: [],
    containerPorts: [],
    requires: [],
    requiredEnv: [
      { name: 'POSTGRES_PASSWORD', label: 'Admin Password', required: true },
      { name: 'POSTGRES_DB', label: 'Database Name', required: true },
    ],
  };

  it('no error when all required env vars are set', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(specWithEnv);
    const config = minimalConfig({
      services: {
        db: minimalService({
          serviceId: 'db', image: 'postgres:15',
          env: { POSTGRES_PASSWORD: 'secret', POSTGRES_DB: 'mydb' },
        }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('missing-env'))).toHaveLength(0);
  });

  it('error for each missing required env var', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(specWithEnv);
    const config = minimalConfig({
      services: {
        db: minimalService({ serviceId: 'db', image: 'postgres:15', env: {} }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    const envErrors = results.filter(r => r.id.startsWith('missing-env'));
    expect(envErrors).toHaveLength(2);
    expect(envErrors.map(r => r.metadata?.missingEnvKey)).toContain('POSTGRES_PASSWORD');
    expect(envErrors.map(r => r.metadata?.missingEnvKey)).toContain('POSTGRES_DB');
  });

  it('error when env var is set to empty string', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(specWithEnv);
    const config = minimalConfig({
      services: {
        db: minimalService({
          serviceId: 'db', image: 'postgres:15',
          env: { POSTGRES_PASSWORD: '', POSTGRES_DB: 'mydb' },
        }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.find(r => r.metadata?.missingEnvKey === 'POSTGRES_PASSWORD')).toBeDefined();
  });

  it('error when env var is whitespace only', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(specWithEnv);
    const config = minimalConfig({
      services: {
        db: minimalService({
          serviceId: 'db', image: 'postgres:15',
          env: { POSTGRES_PASSWORD: '   ', POSTGRES_DB: 'mydb' },
        }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.find(r => r.metadata?.missingEnvKey === 'POSTGRES_PASSWORD')).toBeDefined();
  });

  it('no error for disabled service with missing env', () => {
    vi.mocked(CatalogRegistry.getCachedService).mockReturnValue(specWithEnv);
    const config = minimalConfig({
      services: {
        db: minimalService({ serviceId: 'db', image: 'postgres:15', enabled: false, env: {} }),
      },
    });
    const { results } = validateStack(config, defaultSettings);
    expect(results.filter(r => r.id.startsWith('missing-env'))).toHaveLength(0);
  });
});
