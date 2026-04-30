import { BundleSpec, CatalogEntry, ServiceSpec } from '@/types';
import { catalogRepository } from '@/lib/storage/CatalogRepository';

const cachedServices: Record<string, ServiceSpec> = {};
const cachedEntries: Record<string, CatalogEntry> = {};

export const bundles: BundleSpec[] = [
  {
    id: 'bundle-passwords',
    name: 'Passwords Vault',
    description: 'Secure password management with Vaultwarden.',
    mainServices: ['vaultwarden'],
    difficulty: 'easy',
    resourceClass: 'light',
  },
  {
    id: 'bundle-personal-cloud',
    name: 'Personal Cloud',
    description: 'Full productivity suite with Nextcloud, Postgres, and Redis.',
    mainServices: ['nextcloud', 'postgres', 'redis'],
    difficulty: 'moderate',
    resourceClass: 'medium',
    notes: ['Includes high-performance caching with Redis.'],
  },
  {
    id: 'bundle-media',
    name: 'Media Stack',
    description: 'The ultimate entertainment stack: Streaming, acquisition, and automation.',
    mainServices: ['jellyfin', 'qbittorrent', 'prowlarr', 'sonarr', 'radarr'],
    difficulty: 'moderate',
    resourceClass: 'heavy',
    notes: ['Requires significant storage for media library.'],
  },
  {
    id: 'bundle-monitoring',
    name: 'Monitoring & Logs',
    description: 'Complete observability for your homelab with Grafana, Prometheus, and Loki.',
    mainServices: ['grafana', 'prometheus', 'loki'],
    difficulty: 'moderate',
    resourceClass: 'medium',
  },
  {
    id: 'bundle-collab',
    name: 'Team Collaboration',
    description: 'Self-hosted internal communication with Mattermost.',
    mainServices: ['mattermost', 'postgres'],
    difficulty: 'moderate',
    resourceClass: 'medium',
  },
];

export class CatalogRegistry {
  static async getService(id: string, source: 'builtin' | 'user' = 'builtin'): Promise<ServiceSpec | undefined> {
    const cached = cachedServices[id];
    if (cached) return cached;
    const spec = await catalogRepository.getSpec(id, source);
    if (spec) {
      cachedServices[id] = spec;
    }
    return spec;
  }

  static getCachedService(id: string): ServiceSpec | undefined {
    return cachedServices[id];
  }

  static getAllCachedServices(): ServiceSpec[] {
    return Object.values(cachedServices);
  }

  static cacheService(spec: ServiceSpec): void {
    cachedServices[spec.id] = spec;
  }

  static removeCachedService(id: string): void {
    delete cachedServices[id];
  }

  static cacheEntry(entry: CatalogEntry): void {
    cachedEntries[entry.id] = entry;
  }

  static getCachedEntry(id: string): CatalogEntry | undefined {
    return cachedEntries[id];
  }

  static getBundle(id: string): BundleSpec | undefined {
    return bundles.find((bundle) => bundle.id === id);
  }

  static getAllBundles(): BundleSpec[] {
    return bundles;
  }
}
