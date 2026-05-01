import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/lib/catalog/registry', () => ({
  CatalogRegistry: {
    getCachedService: vi.fn().mockReturnValue(undefined),
  },
}));

vi.mock('@/lib/catalog/spec-utils', () => ({
  getCachedServiceSpec: vi.fn().mockReturnValue(undefined),
  getServiceSpecOrFallback: vi.fn().mockImplementation((id: string, svc: any) => ({
    id,
    name: id,
    category: 'OTHER',
    description: '',
    image: `${id}:latest`,
    tags: [],
    containerPorts: svc.ports.map((p: any) => p.container),
    requires: [],
    requiredEnv: [],
  })),
}));

import { generateExportManifest } from '@/lib/core/exporter';
import { getCachedServiceSpec } from '@/lib/catalog/spec-utils';
import { minimalConfig, minimalService, defaultSettings } from './fixtures/configs';

beforeEach(() => {
  vi.mocked(getCachedServiceSpec).mockReturnValue(undefined);
});

describe('generateExportManifest', () => {
  it('always includes compose.yml', () => {
    const manifest = generateExportManifest(minimalConfig(), defaultSettings);
    expect(manifest.files.some(f => f.path === 'compose.yml')).toBe(true);
  });

  it('always includes .env', () => {
    const manifest = generateExportManifest(minimalConfig(), defaultSettings);
    expect(manifest.files.some(f => f.path === '.env')).toBe(true);
  });

  it('compose.yml content is non-empty', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const manifest = generateExportManifest(config, defaultSettings);
    const composeFile = manifest.files.find(f => f.path === 'compose.yml')!;
    expect(composeFile.content.length).toBeGreaterThan(0);
    expect(composeFile.content).toContain('services');
  });

  it('.env contains COMPOSE_PROJECT_NAME', () => {
    const manifest = generateExportManifest(minimalConfig(), defaultSettings);
    const envFile = manifest.files.find(f => f.path === '.env')!;
    expect(envFile.content).toContain('COMPOSE_PROJECT_NAME');
  });

  it('includes configFiles from cached service spec', () => {
    vi.mocked(getCachedServiceSpec).mockReturnValue({
      id: 'app',
      name: 'App',
      category: 'OTHER',
      description: '',
      image: 'app:latest',
      tags: [],
      containerPorts: [],
      requires: [],
      requiredEnv: [],
      configFiles: [
        { path: 'app/config.yml', content: 'key: value' },
      ],
    });

    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const manifest = generateExportManifest(config, defaultSettings);
    expect(manifest.files.some(f => f.path === 'app/config.yml')).toBe(true);
    expect(manifest.files.find(f => f.path === 'app/config.yml')?.content).toBe('key: value');
  });

  it('skips configFiles for disabled services', () => {
    vi.mocked(getCachedServiceSpec).mockReturnValue({
      id: 'app',
      name: 'App',
      category: 'OTHER',
      description: '',
      image: 'app:latest',
      tags: [],
      containerPorts: [],
      requires: [],
      requiredEnv: [],
      configFiles: [{ path: 'app/config.yml', content: 'data' }],
    });

    const config = minimalConfig({
      services: {
        app: minimalService({ serviceId: 'app', image: 'app:latest', enabled: false }),
      },
    });
    const manifest = generateExportManifest(config, defaultSettings);
    expect(manifest.files.some(f => f.path === 'app/config.yml')).toBe(false);
  });

  it('returns exactly 2 files when no configFiles', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const manifest = generateExportManifest(config, defaultSettings);
    expect(manifest.files).toHaveLength(2);
  });
});
