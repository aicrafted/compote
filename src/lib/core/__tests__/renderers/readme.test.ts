import { vi, describe, it, expect } from 'vitest';
import { renderReadme } from '@/lib/core/renderers/readme';
import { minimalConfig, minimalService } from '../fixtures/configs';

vi.mock('@/lib/catalog/registry', () => ({
  CatalogRegistry: {
    getCachedService: vi.fn().mockReturnValue(undefined),
  },
}));

describe('renderReadme', () => {
  it('does not throw with empty config', () => {
    expect(() => renderReadme(minimalConfig(), undefined, undefined)).not.toThrow();
  });

  it('uses stackName as heading', () => {
    const output = renderReadme(minimalConfig(), 'My Project');
    expect(output).toContain('# My Project');
  });

  it('falls back to "My Stack" when stackName is omitted', () => {
    const output = renderReadme(minimalConfig());
    expect(output).toContain('# My Stack');
  });

  it('includes stackDescription when provided', () => {
    const output = renderReadme(minimalConfig(), 'Stack', 'A great stack for homelab.');
    expect(output).toContain('A great stack for homelab.');
  });

  it('omits description section when not provided', () => {
    const output = renderReadme(minimalConfig(), 'Stack');
    expect(output).not.toContain('undefined');
  });

  it('includes Quick Start section', () => {
    const output = renderReadme(minimalConfig());
    expect(output).toContain('## Quick Start');
    expect(output).toContain('docker compose up -d');
  });

  it('shows "No services" message when config is empty', () => {
    const output = renderReadme(minimalConfig());
    expect(output).toContain('No services configured yet');
  });

  it('renders services table when services exist', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({ serviceId: 'nginx', image: 'nginx:latest' }),
      },
    });
    const output = renderReadme(config);
    expect(output).toContain('## Services');
    expect(output).toContain('| Instance |');
    expect(output).toContain('nginx');
  });

  it('renders host port in services table', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({
          serviceId: 'nginx',
          image: 'nginx:latest',
          ports: [{ host: 8080, container: 80 }],
        }),
      },
    });
    const output = renderReadme(config);
    expect(output).toContain('8080');
  });

  it('shows — when service has no ports', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ serviceId: 'app', image: 'app:latest', ports: [] }),
      },
    });
    const output = renderReadme(config);
    expect(output).toContain('—');
  });

  it('excludes disabled services from table', () => {
    const config = minimalConfig({
      services: {
        enabled: minimalService({ serviceId: 'enabled', image: 'e:latest' }),
        disabled: minimalService({ serviceId: 'disabled', image: 'd:latest', enabled: false }),
      },
    });
    const output = renderReadme(config);
    expect(output).toContain('`enabled`');
    expect(output).not.toContain('`disabled`');
  });

  it('renders Prerequisites section for external networks', () => {
    const config = minimalConfig({
      networks: { proxy: { external: true } },
      services: {},
    });
    const output = renderReadme(config);
    expect(output).toContain('## Prerequisites');
    expect(output).toContain('docker network create proxy');
  });

  it('uses network name override in Prerequisites', () => {
    const config = minimalConfig({
      networks: { proxy: { external: true, name: 'traefik_net' } },
      services: {},
    });
    const output = renderReadme(config);
    expect(output).toContain('docker network create traefik_net');
  });

  it('renders Prerequisites section for external volumes', () => {
    const config = minimalConfig({
      volumes: { pgdata: { external: true } },
      services: {},
    });
    const output = renderReadme(config);
    expect(output).toContain('## Prerequisites');
    expect(output).toContain('pgdata');
  });

  it('omits Prerequisites when no external resources', () => {
    const config = minimalConfig({
      networks: { internal: { driver: 'bridge' } },
      services: {},
    });
    const output = renderReadme(config);
    expect(output).not.toContain('## Prerequisites');
  });

  it('always ends with compote attribution', () => {
    const output = renderReadme(minimalConfig());
    expect(output).toContain('compote');
  });
});
