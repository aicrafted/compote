import { describe, it, expect } from 'vitest';
import { renameResourceReferences } from '@/lib/core/compose-resources';
import { minimalConfig, minimalService } from './fixtures/configs';

// ── network renaming ─────────────────────────────────────────────────────────

describe('renameResourceReferences — network', () => {
  it('updates service networks array', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ networks: ['web', 'internal'] }),
      },
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(result.services['app'].networks).toContain('frontend');
    expect(result.services['app'].networks).not.toContain('web');
    expect(result.services['app'].networks).toContain('internal');
  });

  it('does not affect services not using the network', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ networks: ['other'] }),
      },
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(result.services['app'].networks).toEqual(['other']);
  });

  it('renames external network key without explicit name', () => {
    const config = minimalConfig({
      networks: { web: { external: true } },
      services: {},
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(result.networks?.['frontend']).toBeDefined();
    expect(result.networks?.['web']).toBeUndefined();
  });

  it('updates external network name field when key differs', () => {
    const config = minimalConfig({
      networks: { proxy: { external: true, name: 'web' } },
      services: {},
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(result.networks?.['proxy']?.name).toBe('frontend');
  });

  it('does not rename non-external network top-level key', () => {
    const config = minimalConfig({
      networks: { web: { driver: 'bridge' } },
      services: {},
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(result.networks?.['web']).toBeDefined();
    expect(result.networks?.['frontend']).toBeUndefined();
  });

  it('is a no-op when old name does not exist in services', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ networks: ['internal'] }),
      },
    });
    const result = renameResourceReferences(config, 'network', 'missing', 'other');
    expect(result.services['app'].networks).toEqual(['internal']);
  });
});

// ── volume renaming ──────────────────────────────────────────────────────────

describe('renameResourceReferences — volume', () => {
  it('renames named volume references in service volumes', () => {
    const config = minimalConfig({
      services: {
        db: minimalService({
          volumes: [{ host: 'pgdata', container: '/var/lib/postgresql/data', type: 'volume' }],
        }),
      },
    });
    const result = renameResourceReferences(config, 'volume', 'pgdata', 'postgres-data');
    expect(result.services['db'].volumes[0].host).toBe('postgres-data');
  });

  it('does not rename bind-mount volumes (type != volume)', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({
          volumes: [{ host: './data', container: '/data', type: 'bind' }],
        }),
      },
    });
    const result = renameResourceReferences(config, 'volume', './data', './new-data');
    expect(result.services['app'].volumes[0].host).toBe('./data');
  });

  it('renames external volume key without explicit name', () => {
    const config = minimalConfig({
      volumes: { pgdata: { external: true } },
      services: {},
    });
    const result = renameResourceReferences(config, 'volume', 'pgdata', 'postgres-data');
    expect(result.volumes?.['postgres-data']).toBeDefined();
    expect(result.volumes?.['pgdata']).toBeUndefined();
  });

  it('updates external volume name field when key differs', () => {
    const config = minimalConfig({
      volumes: { db: { external: true, name: 'pgdata' } },
      services: {},
    });
    const result = renameResourceReferences(config, 'volume', 'pgdata', 'postgres-data');
    expect(result.volumes?.['db']?.name).toBe('postgres-data');
  });

  it('does not affect services with different named volumes', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({
          volumes: [{ host: 'appdata', container: '/app/data', type: 'volume' }],
        }),
      },
    });
    const result = renameResourceReferences(config, 'volume', 'pgdata', 'postgres-data');
    expect(result.services['app'].volumes[0].host).toBe('appdata');
  });

  it('returns a new object without mutating the original', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ networks: ['web'] }),
      },
    });
    const result = renameResourceReferences(config, 'network', 'web', 'frontend');
    expect(config.services['app'].networks).toContain('web');
    expect(result).not.toBe(config);
  });
});
