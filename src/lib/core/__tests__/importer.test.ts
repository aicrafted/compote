import { vi, describe, it, expect } from 'vitest';
import { parseComposeToStack } from '@/lib/core/importer';
import type { ServiceSpec } from '@/types';

const NO_CATALOG: ServiceSpec[] = [];

// ── error cases ──────────────────────────────────────────────────────────────

describe('parseComposeToStack — error cases', () => {
  it('throws when services key is absent', () => {
    expect(() => parseComposeToStack('name: myproject\n', NO_CATALOG)).toThrow(
      'Invalid Docker Compose file'
    );
  });

  it('throws on empty string', () => {
    expect(() => parseComposeToStack('', NO_CATALOG)).toThrow();
  });
});

// ── minimal service ──────────────────────────────────────────────────────────

describe('parseComposeToStack — minimal service', () => {
  const yaml = `
services:
  app:
    image: nginx:latest
`;

  it('returns the service under its yaml key', () => {
    const result = parseComposeToStack(yaml, NO_CATALOG);
    expect(result.services['app']).toBeDefined();
  });

  it('sets serviceId to the yaml key when no catalog match', () => {
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].serviceId).toBe('app');
  });

  it('sets enabled to true', () => {
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].enabled).toBe(true);
  });

  it('parses imageTag from image field', () => {
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].imageTag).toBe('latest');
  });

  it('defaults ports to empty array', () => {
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].ports).toEqual([]);
  });

  it('defaults env to empty object', () => {
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].env).toEqual({});
  });
});

// ── project name ─────────────────────────────────────────────────────────────

describe('parseComposeToStack — project name', () => {
  it('reads top-level name field', () => {
    const yaml = `name: myproject\nservices:\n  app:\n    image: app:latest\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).projectName).toBe('myproject');
  });

  it('returns undefined projectName when absent', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).projectName).toBeUndefined();
  });
});

// ── port formats ─────────────────────────────────────────────────────────────

describe('parseComposeToStack — ports', () => {
  function parse(portsYaml: string) {
    const yaml = `services:\n  app:\n    image: app:latest\n    ports:\n${portsYaml}`;
    return parseComposeToStack(yaml, NO_CATALOG).services['app'].ports;
  }

  it('parses host:container format', () => {
    const ports = parse('      - "8080:80"\n');
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatchObject({ host: 8080, container: 80 });
  });

  it('parses udp protocol', () => {
    const ports = parse('      - "5353:53/udp"\n');
    expect(ports[0]).toMatchObject({ host: 5353, container: 53, protocol: 'udp' });
  });

  it('produces no protocol field for tcp-only port', () => {
    const ports = parse('      - "80:80"\n');
    expect(ports[0].protocol).toBeUndefined();
  });

  it('skips single-port shorthand (no colon)', () => {
    // "80" has no colon → parts.length !== 2 → not parsed
    const ports = parse('      - "80"\n');
    expect(ports).toHaveLength(0);
  });

  it('publiclyExposed is true when ports are present', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    ports:\n      - "80:80"\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].publiclyExposed).toBe(true);
  });

  it('publiclyExposed is false when no ports', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].publiclyExposed).toBe(false);
  });
});

// ── environment formats ───────────────────────────────────────────────────────

describe('parseComposeToStack — environment', () => {
  it('parses array form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    environment:\n      - KEY=value\n      - OTHER=hello\n`;
    const { env } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(env).toEqual({ KEY: 'value', OTHER: 'hello' });
  });

  it('preserves = signs inside value', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    environment:\n      - URL=http://host?a=1&b=2\n`;
    const { env } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(env['URL']).toBe('http://host?a=1&b=2');
  });

  it('parses object form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    environment:\n      KEY: value\n      NUM: 42\n`;
    const { env } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(env).toMatchObject({ KEY: 'value', NUM: '42' });
  });
});

// ── volume formats ────────────────────────────────────────────────────────────

describe('parseComposeToStack — volumes', () => {
  function parse(volYaml: string) {
    const yaml = `services:\n  app:\n    image: app:latest\n    volumes:\n${volYaml}`;
    return parseComposeToStack(yaml, NO_CATALOG).services['app'].volumes;
  }

  it('parses bind mount', () => {
    const vols = parse('      - "./data:/app/data"\n');
    expect(vols[0]).toMatchObject({ host: './data', container: '/app/data', type: 'bind' });
  });

  it('parses read-only mode', () => {
    const vols = parse('      - "./config:/etc/app:ro"\n');
    expect(vols[0]).toMatchObject({ mode: 'ro', type: 'bind' });
  });

  it('detects named volume (no dot or slash prefix)', () => {
    const vols = parse('      - "myvolume:/app/data"\n');
    expect(vols[0]).toMatchObject({ host: 'myvolume', type: 'volume' });
  });

  it('detects absolute path as bind mount', () => {
    const vols = parse('      - "/etc/localtime:/etc/localtime:ro"\n');
    expect(vols[0].type).toBe('bind');
  });

  it('defaults mode to rw when not specified', () => {
    const vols = parse('      - "./data:/app/data"\n');
    expect(vols[0].mode).toBe('rw');
  });
});

// ── depends_on formats ────────────────────────────────────────────────────────

describe('parseComposeToStack — depends_on', () => {
  it('parses array form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    depends_on:\n      - postgres\n      - redis\n`;
    const { dependsOn } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(dependsOn).toEqual(['postgres', 'redis']);
  });

  it('parses object form with condition', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    depends_on:\n      postgres:\n        condition: service_healthy\n`;
    const { dependsOn } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(dependsOn).toEqual([{ service: 'postgres', condition: 'service_healthy' }]);
  });

  it('returns string for object entry with service_started', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    depends_on:\n      redis:\n        condition: service_started\n`;
    const { dependsOn } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(dependsOn).toEqual([{ service: 'redis', condition: 'service_started' }]);
  });

  it('is undefined when depends_on is absent', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].dependsOn).toBeUndefined();
  });
});

// ── networks formats ──────────────────────────────────────────────────────────

describe('parseComposeToStack — service networks', () => {
  it('parses array form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    networks:\n      - frontend\n      - backend\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].networks).toEqual(['frontend', 'backend']);
  });

  it('parses object form (extracts keys)', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    networks:\n      frontend:\n      backend:\n        aliases:\n          - db\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].networks).toEqual(['frontend', 'backend']);
  });
});

// ── healthcheck ───────────────────────────────────────────────────────────────

describe('parseComposeToStack — healthcheck', () => {
  it('parses CMD array (strips CMD prefix)', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    healthcheck:\n      test: ["CMD", "curl", "-f", "http://localhost"]\n      interval: 30s\n      timeout: 10s\n      retries: 3\n`;
    const { healthcheck } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(healthcheck?.test).toBe('curl -f http://localhost');
    expect(healthcheck?.interval).toBe('30s');
    expect(healthcheck?.retries).toBe(3);
  });

  it('parses disabled healthcheck', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    healthcheck:\n      disable: true\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].healthcheck).toEqual({ disable: true });
  });

  it('is undefined when healthcheck is absent', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].healthcheck).toBeUndefined();
  });
});

// ── labels ────────────────────────────────────────────────────────────────────

describe('parseComposeToStack — labels', () => {
  it('parses array form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    labels:\n      - "traefik.enable=true"\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].labels).toMatchObject({ 'traefik.enable': 'true' });
  });

  it('parses object form', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    labels:\n      traefik.enable: "true"\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].labels).toMatchObject({ 'traefik.enable': 'true' });
  });
});

// ── top-level resources ───────────────────────────────────────────────────────

describe('parseComposeToStack — top-level resources', () => {
  it('parses top-level networks', () => {
    const yaml = `services:\n  app:\n    image: app:latest\nnetworks:\n  proxy:\n    external: true\n`;
    const result = parseComposeToStack(yaml, NO_CATALOG);
    expect(result.networks?.['proxy']).toMatchObject({ external: true });
  });

  it('parses top-level volumes', () => {
    const yaml = `services:\n  app:\n    image: app:latest\nvolumes:\n  pgdata:\n`;
    const result = parseComposeToStack(yaml, NO_CATALOG);
    expect(result.volumes?.['pgdata']).toBeDefined();
  });

  it('parses top-level configs', () => {
    const yaml = `services:\n  app:\n    image: app:latest\nconfigs:\n  myconfig:\n    file: ./config.yaml\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).configs?.['myconfig']).toBeDefined();
  });

  it('parses top-level secrets', () => {
    const yaml = `services:\n  app:\n    image: app:latest\nsecrets:\n  mysecret:\n    file: ./secret.txt\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).secrets?.['mysecret']).toBeDefined();
  });
});

// ── raw fields ────────────────────────────────────────────────────────────────

describe('parseComposeToStack — raw fields', () => {
  it('preserves unknown keys in raw', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    x-custom: some-value\n`;
    const { raw } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(raw?.['x-custom']).toBe('some-value');
  });

  it('does not put known keys in raw', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    restart: always\n`;
    const { raw } = parseComposeToStack(yaml, NO_CATALOG).services['app'];
    expect(raw?.['restart']).toBeUndefined();
  });
});

// ── multiple services ─────────────────────────────────────────────────────────

describe('parseComposeToStack — multiple services', () => {
  const yaml = `
services:
  web:
    image: nginx:latest
  db:
    image: postgres:15
`;

  it('returns all services', () => {
    const result = parseComposeToStack(yaml, NO_CATALOG);
    expect(result.services['web']).toBeDefined();
    expect(result.services['db']).toBeDefined();
  });

  it('each service has correct imageTag', () => {
    const result = parseComposeToStack(yaml, NO_CATALOG);
    expect(result.services['web'].imageTag).toBe('latest');
    expect(result.services['db'].imageTag).toBe('15');
  });
});

// ── catalog matching ──────────────────────────────────────────────────────────

describe('parseComposeToStack — catalog matching', () => {
  const pgSpec: ServiceSpec = {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'DATABASE',
    description: '',
    image: 'postgres:15',
    tags: [],
    containerPorts: [5432],
    requires: [],
    requiredEnv: [],
  };

  it('matches service by id', () => {
    const yaml = `services:\n  postgres:\n    image: postgres:16\n`;
    const result = parseComposeToStack(yaml, [pgSpec]);
    expect(result.services['postgres'].serviceId).toBe('postgres');
  });

  it('matches service by image base', () => {
    const yaml = `services:\n  db:\n    image: postgres:16\n`;
    const result = parseComposeToStack(yaml, [pgSpec]);
    expect(result.services['db'].serviceId).toBe('postgres');
  });

  it('sets image to undefined when base matches catalog', () => {
    // base image matches catalog → no override needed
    const yaml = `services:\n  postgres:\n    image: postgres:16\n`;
    const result = parseComposeToStack(yaml, [pgSpec]);
    expect(result.services['postgres'].image).toBeUndefined();
  });
});

// ── misc service fields ───────────────────────────────────────────────────────

describe('parseComposeToStack — misc fields', () => {
  it('parses restart policy', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    restart: always\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].restart).toBe('always');
  });

  it('parses container_name', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    container_name: myapp\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].containerName).toBe('myapp');
  });

  it('parses command', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    command: /bin/sh -c "echo hello"\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].command).toBeTruthy();
  });

  it('parses user', () => {
    const yaml = `services:\n  app:\n    image: app:latest\n    user: "1000:1000"\n`;
    expect(parseComposeToStack(yaml, NO_CATALOG).services['app'].user).toBe('1000:1000');
  });
});
