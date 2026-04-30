import yaml from 'js-yaml';
import {
  ComposeData,
  ServiceConfig,
  ServiceSpec,
  TopLevelConfigDef,
  TopLevelNetworkDef,
  TopLevelSecretDef,
  TopLevelVolumeDef,
  ServiceResourceRef,
} from '@/types';

export interface ImportResult extends Partial<ComposeData> {
  services: Record<string, ServiceConfig>;
}

export function parseComposeToStack(yamlContent: string, allCatalogServices: ServiceSpec[]): ImportResult {
  const doc = yaml.load(yamlContent) as any;
  if (!doc || !doc.services) {
    throw new Error('Invalid Docker Compose file: No services found.');
  }

  const resultServices: Record<string, ServiceConfig> = {};
  const projectName = doc.name;
  const networks: Record<string, TopLevelNetworkDef> = {};
  if (doc.networks) {
    Object.entries(doc.networks).forEach(([name, def]) => {
      networks[name] = (def as any) || {};
    });
  }

  const volumes: Record<string, TopLevelVolumeDef> = {};
  if (doc.volumes) {
    Object.entries(doc.volumes).forEach(([name, def]) => {
      volumes[name] = (def as any) || {};
    });
  }

  const configs: Record<string, TopLevelConfigDef> = {};
  if (doc.configs) {
    Object.entries(doc.configs).forEach(([name, def]) => {
      configs[name] = (def as any) || {};
    });
  }

  const secrets: Record<string, TopLevelSecretDef> = {};
  if (doc.secrets) {
    Object.entries(doc.secrets).forEach(([name, def]) => {
      secrets[name] = (def as any) || {};
    });
  }

  Object.entries(doc.services).forEach(([id, def]: [string, any]) => {
    // 1. Try to find match in catalog by image or name
    const image = String(def.image || '');
    const { baseImage, tag } = splitImageRef(image);

    const matchedSpec = allCatalogServices.find(s => 
      s.id === id || 
      s.image.startsWith(baseImage) || 
      s.name.toLowerCase() === id.toLowerCase()
    );

    const serviceId = matchedSpec?.id || id;
    const matchedBaseImage = matchedSpec ? splitImageRef(matchedSpec.image).baseImage : '';

    // 2. Extract ports
    const ports: { host: number; container: number; protocol?: 'tcp' | 'udp' }[] = [];
    if (def.ports && Array.isArray(def.ports)) {
      def.ports.forEach((p: any) => {
        const pStr = p.toString();
        const parts = pStr.split(':');
        if (parts.length === 2) {
          const host = parseInt(parts[0]);
          const cPart = parts[1];
          const container = parseInt(cPart.split('/')[0]);
          const protocol = cPart.includes('/') ? (cPart.split('/')[1] as 'tcp' | 'udp') : undefined;
          ports.push({ host, container, protocol });
        }
      });
    }

    // 3. Extract environment
    const env: Record<string, string> = {};
    if (def.environment) {
      if (Array.isArray(def.environment)) {
        def.environment.forEach((kv: string) => {
          const parts = kv.split('=');
          const k = parts[0];
          const v = parts.slice(1).join('=');
          if (k) env[k] = v || '';
        });
      } else {
        Object.entries(def.environment).forEach(([k, v]) => {
          env[k] = (v as any)?.toString() || '';
        });
      }
    }

    // 3.5 Extract labels
    const labels: Record<string, string> = {};
    if (def.labels) {
      if (Array.isArray(def.labels)) {
        def.labels.forEach((l: string) => {
          const parts = l.split('=');
          const k = parts[0];
          const v = parts.slice(1).join('=');
          if (k) labels[k] = v || '';
        });
      } else {
        Object.entries(def.labels).forEach(([k, v]) => {
          labels[k] = (v as any)?.toString() || '';
        });
      }
    }

    // 4. Extract volumes
    const volumes: { host: string; container: string; mode?: string; type?: 'bind' | 'volume' }[] = [];
    if (def.volumes && Array.isArray(def.volumes)) {
      def.volumes.forEach((v: any) => {
        const vStr = v.toString();
        const parts = vStr.split(':');
        if (parts.length >= 2) {
          const host = parts[0];
          const containerPart = parts[1];
          // Support multiple flags: rw, ro, z, Z, cached etc.
          const mode = parts.slice(2).join(':') || 'rw';
          
          const type = (host.startsWith('.') || host.startsWith('/') || host.includes('\\') || host.includes('/')) ? 'bind' : 'volume';
          
          volumes.push({ 
            host, 
            container: containerPart, 
            mode: mode as any,
            type 
          });
        }
      });
    }

    // 4.5 Extract networks
    const networks: string[] = [];
    if (def.networks) {
      if (Array.isArray(def.networks)) {
        networks.push(...def.networks);
      } else {
        networks.push(...Object.keys(def.networks));
      }
    }

    // 5. Build ServiceConfig
    const serviceConfigs = parseServiceResources(def.configs);
    const serviceSecrets = parseServiceResources(def.secrets);
    const devices = parseDevices(def.devices);
    const healthcheck = parseHealthcheck(def.healthcheck);

    const handledKeys = ['serviceId', 'enabled', 'image', 'restart', 'environment', 'ports', 'volumes', 'devices', 'deploy', 'depends_on', 'labels', 'networks', 'configs', 'secrets', 'healthcheck', 'container_name', 'command', 'entrypoint', 'working_dir', 'user', 'profiles', 'platform', 'pull_policy', 'build'];
    const raw: any = {};
    Object.keys(def).forEach(key => {
      if (!handledKeys.includes(key)) {
        raw[key] = def[key];
      }
    });

    resultServices[id] = {
      serviceId,
      enabled: true,
      ports,
      env,
      labels,
      volumes,
      devices,
      networks,
      configs: serviceConfigs,
      secrets: serviceSecrets,
      publiclyExposed: ports.length > 0,
      image: baseImage && baseImage !== matchedBaseImage ? baseImage : undefined,
      imageTag: tag,
      restart: def.restart,
      containerName: def.container_name,
      limits: def.deploy?.resources?.limits,
      healthcheck,
      dependsOn: parseDependsOn(def.depends_on),
      command: def.command ? String(def.command) : undefined,
      entrypoint: def.entrypoint
        ? (Array.isArray(def.entrypoint) ? def.entrypoint.join(' ') : String(def.entrypoint))
        : undefined,
      workingDir: def.working_dir ? String(def.working_dir) : undefined,
      user: def.user ? String(def.user) : undefined,
      profiles: Array.isArray(def.profiles)
        ? def.profiles.map(String)
        : def.profiles
          ? [String(def.profiles)]
          : undefined,
      platform: def.platform ? String(def.platform) : undefined,
      pullPolicy: def.pull_policy ? String(def.pull_policy) : undefined,
      build: def.build && typeof def.build === 'object' && !Array.isArray(def.build) ? {
        context: def.build.context ? String(def.build.context) : undefined,
        dockerfile: def.build.dockerfile ? String(def.build.dockerfile) : undefined,
        target: def.build.target ? String(def.build.target) : undefined,
        args: def.build.args && typeof def.build.args === 'object' ? def.build.args : undefined,
      } : undefined,
      raw
    };

    // 6. If not in catalog, create a Virtual Spec
  });

  return { 
    projectName,
    services: resultServices, 
    networks,
    volumes,
    configs,
    secrets
  };
}

function splitImageRef(image: string): { baseImage: string; tag: string } {
  const slashIndex = image.lastIndexOf('/');
  const colonIndex = image.lastIndexOf(':');
  if (colonIndex > slashIndex) {
    return {
      baseImage: image.slice(0, colonIndex),
      tag: image.slice(colonIndex + 1) || 'latest',
    };
  }
  return { baseImage: image, tag: 'latest' };
}

function parseDependsOn(value: unknown): ServiceConfig['dependsOn'] {
  if (!value) return undefined;

  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([service, dependency]) => {
      if (!dependency || typeof dependency !== 'object') return service;
      const condition = String((dependency as Record<string, unknown>).condition || 'service_healthy');
      if (
        condition === 'service_started' ||
        condition === 'service_healthy' ||
        condition === 'service_completed_successfully'
      ) {
        return { service, condition };
      }
      return service;
    });
  }

  return undefined;
}

function parseDevices(value: unknown): ServiceConfig['devices'] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== 'string') return [];
    const [host, container, permissions] = entry.split(':');
    if (!host || !container) return [];
    return [{ host, container, permissions }];
  });
}

function parseHealthcheck(value: unknown): ServiceConfig['healthcheck'] {
  if (!value || typeof value !== 'object') return undefined;

  const healthcheck = value as Record<string, unknown>;
  if (healthcheck.disable === true) return { disable: true };

  const rawTest = healthcheck.test;
  const test = Array.isArray(rawTest)
    ? rawTest.filter((part) => part !== 'CMD' && part !== 'CMD-SHELL').join(' ')
    : typeof rawTest === 'string'
      ? rawTest
      : undefined;

  return {
    test,
    interval: healthcheck.interval ? String(healthcheck.interval) : undefined,
    timeout: healthcheck.timeout ? String(healthcheck.timeout) : undefined,
    retries: typeof healthcheck.retries === 'number' ? healthcheck.retries : undefined,
    startPeriod: healthcheck.start_period ? String(healthcheck.start_period) : undefined,
  };
}

function parseServiceResources(value: unknown): ServiceResourceRef[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry === 'string') {
      return entry ? [{ source: entry }] : [];
    }

    if (entry && typeof entry === 'object') {
      const ref = entry as Record<string, unknown>;
      const source = String(ref.source || '').trim();
      if (!source) return [];

      return [{
        source,
        target: ref.target ? String(ref.target) : undefined,
        mode: ref.mode ? String(ref.mode) : undefined,
      }];
    }

    return [];
  });
}
