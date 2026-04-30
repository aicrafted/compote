import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  ComposeConfig,
  ServiceConfig,
  BundleSpec,
  ComposeData,
  TopLevelNetworkDef,
  TopLevelVolumeDef,
  TopLevelConfigDef,
  TopLevelSecretDef,
} from '@/types';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { idbStorage } from './storage';
import { parseComposeToStack } from '@/lib/core/importer';
import { composeRepository } from '@/lib/storage/ComposeRepository';
import { getDefaultPortMappings } from '@/lib/core/ports';

interface StackState {
  config: ComposeData;
  activeInstanceId: string | null;
  isDirty: boolean;
  
  // Actions
  setStack: (config: ComposeConfig) => void;
  setActiveInstance: (id: string | null) => void;
  upsertService: (instanceId: string, config: Partial<ServiceConfig>) => void;
  removeService: (instanceId: string) => void;
  renameService: (oldId: string, newId: string) => void;
  applyBundle: (bundle: BundleSpec, resolutions?: import('@/types').BundleResolutionMap) => Promise<void>;
  importYaml: (content: string) => void;
  resetStack: () => void;
  saveCompose: (hostId: string, composeId: string) => Promise<void>;
  loadCompose: (hostId: string, composeId: string) => Promise<void>;

  // Top-level config actions
  updateStackConfig: (updates: Partial<ComposeData>) => void;
  upsertNetwork: (name: string, def: Partial<TopLevelNetworkDef>, oldName?: string) => void;
  removeNetwork: (name: string) => void;
  upsertVolume: (name: string, def: Partial<TopLevelVolumeDef>, oldName?: string) => void;
  removeVolume: (name: string) => void;
  upsertConfig: (name: string, def: Partial<TopLevelConfigDef>, oldName?: string) => void;
  removeConfig: (name: string) => void;
  upsertSecret: (name: string, def: Partial<TopLevelSecretDef>, oldName?: string) => void;
  removeSecret: (name: string) => void;
}

const INITIAL_STATE: ComposeData = {
  services: {},
  networks: {},
  volumes: {},
  configs: {},
  secrets: {},
};

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== typeof right) return false;
  if (left === null || right === null) return false;
  if (typeof left !== 'object') return false;

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    return left.every((item, index) => valuesEqual(item, right[index]));
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).filter((key) => leftRecord[key] !== undefined);
  const rightKeys = Object.keys(rightRecord).filter((key) => rightRecord[key] !== undefined);
  if (leftKeys.length !== rightKeys.length) return false;

  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && valuesEqual(leftRecord[key], rightRecord[key]));
}

export const useComposeStore = create<StackState>()(
  persist(
    (set, get) => ({
      config: INITIAL_STATE,
      activeInstanceId: null,
      isDirty: false,

      setStack: (config) => set({ 
        config: { 
          services: config.services, 
          projectName: config.projectName,
          networks: config.networks || {},
          volumes: config.volumes || {},
          configs: config.configs || {},
          secrets: config.secrets || {},
        },
        isDirty: false
      }),

      setActiveInstance: (id) => set({ activeInstanceId: id }),

      upsertService: (instanceId, incoming) =>
        set((state) => {
          const existing = state.config.services[instanceId] || {
            serviceId: instanceId,
            enabled: true,
            env: {},
            volumes: [],
            ports: [],
            labels: {},
            networks: [],
            devices: [],
            configs: [],
            secrets: [],
            publiclyExposed: false,
          };

          const merged = {
             ...existing,
             ...incoming,
             env: incoming.env !== undefined ? incoming.env : existing.env,
             limits: incoming.limits !== undefined ? { ...(existing.limits || {}), ...incoming.limits } : existing.limits,
             volumes: incoming.volumes !== undefined ? incoming.volumes : existing.volumes,
             devices: incoming.devices !== undefined ? incoming.devices : existing.devices,
             networks: incoming.networks !== undefined ? incoming.networks : existing.networks,
             configs: incoming.configs !== undefined ? incoming.configs : existing.configs,
             secrets: incoming.secrets !== undefined ? incoming.secrets : existing.secrets,
             healthcheck: incoming.healthcheck !== undefined ? incoming.healthcheck : existing.healthcheck,
             dependsOn: incoming.dependsOn !== undefined ? incoming.dependsOn : existing.dependsOn
          };

          if (valuesEqual(existing, merged)) return state;

          return {
            isDirty: true,
            config: {
              ...state.config,
              services: {
                ...state.config.services,
                [instanceId]: merged,
              },
            },
          };
        }),

      removeService: (instanceId) =>
        set((state) => {
          const { [instanceId]: _, ...remaining } = state.config.services;
          const nextActive = state.activeInstanceId === instanceId ? Object.keys(remaining)[0] || null : state.activeInstanceId;

          return {
            isDirty: true,
            activeInstanceId: nextActive,
            config: {
              ...state.config,
              services: remaining,
            },
          };
        }),

      renameService: (oldId, newId) =>
        set((state) => {
          if (!newId || newId === oldId || state.config.services[newId]) return state;
          const { [oldId]: svc, ...rest } = state.config.services;
          if (!svc) return state;

          const updateDepends = (dep: string | import('@/types').ServiceDependency) =>
            typeof dep === 'string'
              ? dep === oldId ? newId : dep
              : { ...dep, service: dep.service === oldId ? newId : dep.service };

          const services: typeof state.config.services = { ...rest, [newId]: svc };
          Object.entries(services).forEach(([id, s]) => {
            if (s.dependsOn?.some((d) => (typeof d === 'string' ? d : d.service) === oldId)) {
              services[id] = { ...s, dependsOn: s.dependsOn.map(updateDepends) };
            }
          });

          return {
            isDirty: true,
            activeInstanceId: state.activeInstanceId === oldId ? newId : state.activeInstanceId,
            config: { ...state.config, services },
          };
        }),

      applyBundle: async (bundle, resolutions) => {
        const state = get();
        const newServices = { ...state.config.services };

        for (const rawSvcId of bundle.mainServices) {
          const spec = await CatalogRegistry.getService(rawSvcId, 'builtin');
          if (!spec) continue;

          const resolution = resolutions?.services?.[rawSvcId];
          if (resolution === 'skip') continue;

          let instanceId = rawSvcId;
          if (resolution === 'rename') {
            let i = 2;
            while (newServices[`${rawSvcId}-${i}`] || state.config.services[`${rawSvcId}-${i}`]) {
              i++;
            }
            instanceId = `${rawSvcId}-${i}`;
          }

          const defaultPorts = getDefaultPortMappings(spec);
          const ports = defaultPorts.map((port) => ({
            ...port,
            host: resolutions?.ports?.[port.host] || port.host,
          }));

          newServices[instanceId] = {
            serviceId: rawSvcId,
            enabled: true,
            env: spec.requiredEnv.reduce((acc, env) => ({ ...acc, [env.name]: env.defaultValue || '' }), {}),
            publiclyExposed: spec.publicExposure === 'recommended',
            ports,
            volumes: (spec.volumes || []).map(v => ({
              host: `./data/${instanceId}${v.containerPath}`,
              container: v.containerPath,
              mode: 'rw' as const,
              type: 'bind' as const
            })),
            devices: [],
            networks: [],
            labels: {},
          };
        }

        set({
          isDirty: true,
          config: {
            ...state.config,
            services: newServices,
          },
        });
      },

      importYaml: (content) =>
        set((state) => {
          const allServices = CatalogRegistry.getAllCachedServices();
          const parsed = parseComposeToStack(content, allServices);

          return {
            isDirty: true,
            config: {
              ...state.config,
              projectName: parsed.projectName || state.config.projectName,
              services: { ...state.config.services, ...parsed.services },
            networks: { ...state.config.networks, ...(parsed.networks || {}) },
            volumes: { ...state.config.volumes, ...(parsed.volumes || {}) },
            configs: { ...state.config.configs, ...(parsed.configs || {}) },
            secrets: { ...state.config.secrets, ...(parsed.secrets || {}) },
          }
          };
        }),

      updateStackConfig: (updates) => set((state) => ({
        isDirty: true,
        config: { ...state.config, ...updates }
      })),

      upsertNetwork: (name, def, oldName) => set((state) => {
        const networks = { ...(state.config.networks || {}) };
        if (oldName && oldName !== name) delete networks[oldName];
        networks[name] = { ...(networks[name] || {}), ...def };
        return { isDirty: true, config: { ...state.config, networks } };
      }),

      removeNetwork: (name) => set((state) => {
        const { [name]: _, ...remaining } = state.config.networks || {};
        return { isDirty: true, config: { ...state.config, networks: remaining } };
      }),

      upsertVolume: (name, def, oldName) => set((state) => {
        const volumes = { ...(state.config.volumes || {}) };
        if (oldName && oldName !== name) delete volumes[oldName];
        volumes[name] = { ...(volumes[name] || {}), ...def };
        return { isDirty: true, config: { ...state.config, volumes } };
      }),

      removeVolume: (name) => set((state) => {
        const { [name]: _, ...remaining } = state.config.volumes || {};
        return { isDirty: true, config: { ...state.config, volumes: remaining } };
      }),

      upsertConfig: (name, def, oldName) => set((state) => {
        const configs = { ...(state.config.configs || {}) };
        if (oldName && oldName !== name) delete configs[oldName];
        configs[name] = { ...(configs[name] || {}), ...def };
        return { isDirty: true, config: { ...state.config, configs } };
      }),

      removeConfig: (name) => set((state) => {
        const { [name]: _, ...remaining } = state.config.configs || {};
        return { isDirty: true, config: { ...state.config, configs: remaining } };
      }),

      upsertSecret: (name, def, oldName) => set((state) => {
        const secrets = { ...(state.config.secrets || {}) };
        if (oldName && oldName !== name) delete secrets[oldName];
        secrets[name] = { ...(secrets[name] || {}), ...def };
        return { isDirty: true, config: { ...state.config, secrets } };
      }),

      removeSecret: (name) => set((state) => {
        const { [name]: _, ...remaining } = state.config.secrets || {};
        return { isDirty: true, config: { ...state.config, secrets: remaining } };
      }),

      resetStack: () => set({ config: INITIAL_STATE, activeInstanceId: null, isDirty: false }),

      saveCompose: async (hostId, composeId) => {
        const { config } = get();
        await composeRepository.save(hostId, composeId, config);
        set({ isDirty: false });
      },

      loadCompose: async (hostId, composeId) => {
        const data = await composeRepository.get(hostId, composeId);

        if (data) {
          set({ config: data, isDirty: false });
        } else {
          set({ config: INITIAL_STATE, isDirty: false });
        }
      },

    }),
    {
      name: 'homelab-stack-active',
      storage: createJSONStorage(() => idbStorage),
      partialize: () => ({})
    }
  )
);
