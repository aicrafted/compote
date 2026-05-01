import { describe, it, expect } from 'vitest';
import { parse } from 'yaml';
import { renderCompose } from '@/lib/core/renderers/compose';
import { minimalConfig, minimalService, defaultSettings } from '../fixtures/configs';

// Helper: render then parse back to JS for structural assertions
function rendered(config = minimalConfig(), settings = defaultSettings) {
  return parse(renderCompose(config, settings)) as Record<string, any>;
}

// ── enabled / disabled ───────────────────────────────────────────────────────

describe('service visibility', () => {
  it('excludes disabled services', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({ serviceId: 'nginx', image: 'nginx:latest', enabled: false }),
      },
    });
    const doc = rendered(config);
    expect(doc.services?.nginx).toBeUndefined();
  });

  it('includes enabled services', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({ serviceId: 'nginx', image: 'nginx:latest' }),
      },
    });
    const doc = rendered(config);
    expect(doc.services?.nginx).toBeDefined();
  });
});

// ── image ────────────────────────────────────────────────────────────────────

describe('image rendering', () => {
  it('uses service image field', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ serviceId: 'app', image: 'myimage:1.0' }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.image).toBe('myimage:1.0');
  });

  it('uses imageTag override', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ serviceId: 'app', image: 'nginx:latest', imageTag: '1.25' }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.image).toBe('nginx:1.25');
  });
});

// ── ports ────────────────────────────────────────────────────────────────────

describe('port rendering', () => {
  it('renders host:container mapping', () => {
    const config = minimalConfig({
      services: {
        nginx: minimalService({
          serviceId: 'nginx', image: 'nginx:latest',
          ports: [{ host: 8080, container: 80 }],
        }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.nginx.ports).toContain('8080:80');
  });

  it('appends /udp for udp protocol', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({
          serviceId: 'app', image: 'app:latest',
          ports: [{ host: 5353, container: 53, protocol: 'udp' }],
        }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.ports).toContain('5353:53/udp');
  });

  it('omits ports key when ports array is empty', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest', ports: [] }) },
    });
    const doc = rendered(config);
    expect(doc.services.app.ports).toBeUndefined();
  });
});

// ── environment ──────────────────────────────────────────────────────────────

describe('environment rendering', () => {
  it('renders env vars', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({
          serviceId: 'app', image: 'app:latest',
          env: { DB_HOST: 'localhost', DB_PORT: '5432' },
        }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.environment).toMatchObject({ DB_HOST: 'localhost', DB_PORT: '5432' });
  });

  it('omits environment key when env is empty', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest', env: {} }) },
    });
    const doc = rendered(config);
    expect(doc.services.app.environment).toBeUndefined();
  });
});

// ── volumes ──────────────────────────────────────────────────────────────────

describe('volume rendering', () => {
  it('renders bind mount', () => {
    const config = minimalConfig({
      services: {
        db: minimalService({
          serviceId: 'db', image: 'db:latest',
          volumes: [{ host: './data', container: '/data' }],
        }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.db.volumes).toContain('./data:/data');
  });

  it('appends :ro for read-only mode', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({
          serviceId: 'app', image: 'app:latest',
          volumes: [{ host: './config', container: '/etc/app', mode: 'ro' }],
        }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.volumes).toContain('./config:/etc/app:ro');
  });

  it('omits volumes key when volumes array is empty', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest', volumes: [] }) },
    });
    const doc = rendered(config);
    expect(doc.services.app.volumes).toBeUndefined();
  });
});

// ── restart ──────────────────────────────────────────────────────────────────

describe('restart policy', () => {
  it('uses service restart when set', () => {
    const config = minimalConfig({
      services: {
        app: minimalService({ serviceId: 'app', image: 'app:latest', restart: 'always' }),
      },
    });
    const doc = rendered(config);
    expect(doc.services.app.restart).toBe('always');
  });

  it('falls back to settings.serviceRestartMode', () => {
    const config = minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const settings = { ...defaultSettings, serviceRestartMode: 'on-failure' as const };
    const doc = parse(renderCompose(config, settings));
    expect(doc.services.app.restart).toBe('on-failure');
  });
});

// ── top-level resources ──────────────────────────────────────────────────────

describe('top-level networks', () => {
  it('renders external network declaration', () => {
    const config = minimalConfig({
      networks: { proxy: { external: true } },
      services: {
        app: minimalService({ serviceId: 'app', image: 'app:latest', networks: ['proxy'] }),
      },
    });
    const doc = rendered(config);
    expect(doc.networks?.proxy?.external).toBe(true);
  });

  it('renders declared network even when no service references it', () => {
    const config = minimalConfig({
      networks: { unused: { driver: 'bridge' } },
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const yaml = renderCompose(config, defaultSettings);
    // Declared networks always appear in output (as empty declarations or with config)
    expect(yaml).toContain('unused');
  });
});

// ── project name ─────────────────────────────────────────────────────────────

describe('project name', () => {
  it('renders name field when projectName is set', () => {
    const config = minimalConfig({
      projectName: 'myproject',
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    });
    const doc = rendered(config);
    expect(doc.name).toBe('myproject');
  });

  it('omits name field when projectName is not set', () => {
    const doc = rendered(minimalConfig({
      services: { app: minimalService({ serviceId: 'app', image: 'app:latest' }) },
    }));
    expect(doc.name).toBeUndefined();
  });
});

// ── round-trip ───────────────────────────────────────────────────────────────

describe('round-trip', () => {
  it('multi-service config survives render → parse', () => {
    const config = minimalConfig({
      services: {
        web: minimalService({
          serviceId: 'nginx', image: 'nginx:latest',
          ports: [{ host: 80, container: 80 }],
          networks: ['frontend'],
        }),
        db: minimalService({
          serviceId: 'postgres', image: 'postgres:15',
          env: { POSTGRES_DB: 'app' },
          volumes: [{ host: 'pgdata', container: '/var/lib/postgresql/data', type: 'volume' }],
          networks: ['backend'],
        }),
      },
    });

    const yaml = renderCompose(config, defaultSettings);
    const doc = parse(yaml);

    expect(doc.services.web.image).toBe('nginx:latest');
    expect(doc.services.web.ports).toContain('80:80');
    expect(doc.services.db.image).toBe('postgres:15');
    expect(doc.services.db.environment.POSTGRES_DB).toBe('app');
  });
});
