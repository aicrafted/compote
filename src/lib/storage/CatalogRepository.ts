import { del, get, set } from 'idb-keyval';
import { CatalogEntry, ServiceSpec } from '@/types';
import { CatalogRegistry } from '@/lib/catalog/registry';

type CatalogSource = 'builtin' | 'user';

interface CatalogMetadata {
  id?: string;
  name?: string;
  category?: string;
  categories?: string[];
  description?: string;
  image?: string;
  defaultImageTag?: string;
  tagsApi?: string;
  version?: string;
  repository?: string;
  tags?: string[];
  defaultHostPort?: number;
  preferredPortRange?: [number, number];
  containerPorts?: number[];
  requires?: string[];
  optionalRequires?: string[];
  conflicts?: string[];
  requiredEnv?: ServiceSpec['requiredEnv'];
  optionalEnv?: ServiceSpec['optionalEnv'];
  volumes?: ServiceSpec['volumes'];
  publicExposure?: ServiceSpec['publicExposure'];
  persistenceRequired?: boolean;
  healthcheckRecommended?: boolean;
  difficulty?: ServiceSpec['difficulty'];
  resourceClass?: ServiceSpec['resourceClass'];
  resourceLimits?: ServiceSpec['resourceLimits'];
  platforms?: string[];
  configFiles?: { path: string; template?: string; description?: string }[];
}

class CatalogRepository {
  private cache: Map<string, ServiceSpec> = new Map();
  private indexPromise: Promise<CatalogEntry[]> | null = null;

  private userServiceKey(id: string) {
    return `user-service-${id}`;
  }

  private cacheKey(id: string, source: CatalogSource) {
    return `${source}:${id}`;
  }

  async loadIndex(): Promise<CatalogEntry[]> {
    if (!this.indexPromise) {
      this.indexPromise = fetch('/catalog/catalog.json')
        .then((r) => (r.ok ? r.json() : []))
        .then((index: CatalogEntry[]) => index.map((item) => ({ ...item, source: 'builtin' as const })))
        .catch(() => []);
    }
    return this.indexPromise;
  }

  async getSpec(id: string, source: CatalogSource): Promise<ServiceSpec | undefined> {
    const key = this.cacheKey(id, source);
    const cached = this.cache.get(key);
    if (cached) return cached;

    let spec: ServiceSpec | undefined;
    if (source === 'builtin') {
      spec = await this.loadBuiltinSpec(id);
    } else {
      spec = await get<ServiceSpec>(this.userServiceKey(id));
    }

    if (!spec) return undefined;
    this.cache.set(key, spec);
    return spec;
  }

  async getUserServices(): Promise<ServiceSpec[]> {
    const ids = (await get<string[]>('user-services-index')) || [];
    const values = await Promise.all(ids.map((id) => get<ServiceSpec>(this.userServiceKey(id))));
    return values.filter((value): value is ServiceSpec => Boolean(value));
  }

  async saveUserService(spec: ServiceSpec): Promise<void> {
    await set(this.userServiceKey(spec.id), spec);
    const ids = (await get<string[]>('user-services-index')) || [];
    if (!ids.includes(spec.id)) {
      await set('user-services-index', [...ids, spec.id]);
    }
    this.cache.set(this.cacheKey(spec.id, 'user'), spec);
  }

  async deleteUserService(id: string): Promise<void> {
    await del(this.userServiceKey(id));
    const ids = (await get<string[]>('user-services-index')) || [];
    await set('user-services-index', ids.filter((existingId) => existingId !== id));
    this.cache.delete(this.cacheKey(id, 'user'));
  }

  private async loadBuiltinSpec(id: string): Promise<ServiceSpec | undefined> {
    try {
      const response = await fetch(`/catalog/${id}/metadata.json`);
      if (!response.ok) return undefined;

      const metadata = (await response.json()) as CatalogMetadata;

      let composeTemplate = '';
      try {
        const composeResponse = await fetch(`/catalog/${id}/compose-part.yml`);
        if (composeResponse.ok) {
          composeTemplate = await composeResponse.text();
        }
      } catch {
        composeTemplate = '';
      }

      const configFiles = await Promise.all(
        (metadata.configFiles || []).map(async (file) => {
          if (!file.template) {
            return {
              path: file.path,
              content: '',
              description: file.description,
            };
          }
          try {
            const configResponse = await fetch(`/catalog/${id}/${file.template}`);
            return {
              path: file.path,
              content: configResponse.ok ? await configResponse.text() : '',
              description: file.description,
            };
          } catch {
            return {
              path: file.path,
              content: '',
              description: file.description,
            };
          }
        })
      );

      const categories = normalizeCategories(metadata.category, metadata.categories);

      return {
        id,
        name: metadata.name || id,
        category: categories[0],
        categories,
        description: metadata.description || '',
        image: metadata.image || `${id}:latest`,
        defaultImageTag: metadata.defaultImageTag,
        tagsApi: metadata.tagsApi,
        version: metadata.version,
        repository: metadata.repository,
        tags: metadata.tags || [],
        defaultHostPort: metadata.defaultHostPort,
        preferredPortRange: metadata.preferredPortRange,
        containerPorts: metadata.containerPorts || [],
        requires: metadata.requires || [],
        optionalRequires: metadata.optionalRequires || [],
        conflicts: metadata.conflicts || [],
        requiredEnv: metadata.requiredEnv || [],
        optionalEnv: metadata.optionalEnv || [],
        volumes: metadata.volumes || [],
        publicExposure: metadata.publicExposure,
        persistenceRequired: metadata.persistenceRequired,
        healthcheckRecommended: metadata.healthcheckRecommended,
        difficulty: metadata.difficulty,
        resourceClass: metadata.resourceClass,
        resourceLimits: metadata.resourceLimits,
        composeTemplate,
        platforms: metadata.platforms || [],
        configFiles,
        icon: `/catalog/${id}/icon.${CatalogRegistry.getCachedEntry(id)?.iconSVG ? 'svg' : 'png'}`,
      };
    } catch {
      return undefined;
    }
  }
}

export const catalogRepository = new CatalogRepository();

function normalizeCategories(category?: string, categories?: string[]): string[] {
  const values = categories?.length ? categories : [category || 'OTHER'];
  return Array.from(new Set(values.map((value) => String(value || '').toUpperCase()).filter(Boolean)));
}
