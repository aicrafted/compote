import { BundleSpec, CatalogEntry, ServiceSpec } from '@/types';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { driver, isServerMode } from './driver';

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
  private bundlesPromise: Promise<BundleSpec[]> | null = null;

  private userServiceKey(id: string) {
    return `user-service-${id}`;
  }

  private cacheKey(id: string, source: CatalogSource) {
    return `${source}:${id}`;
  }

  async loadBundles(): Promise<BundleSpec[]> {
    if (!this.bundlesPromise) {
      const url = isServerMode ? '/api/bundles/index' : '/bundles/bundles.json';
      this.bundlesPromise = fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    }
    return this.bundlesPromise;
  }

  async loadIndex(): Promise<CatalogEntry[]> {
    if (!this.indexPromise) {
      const url = isServerMode ? '/api/catalog/index' : '/catalog/catalog.json';
      this.indexPromise = fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .then((index: CatalogEntry[]) =>
          isServerMode ? index : index.map((item) => ({ ...item, source: 'builtin' as const }))
        )
        .catch(() => []);
    }
    return this.indexPromise;
  }

  invalidateIndex(): void {
    this.indexPromise = null;
  }

  invalidateBundles(): void {
    this.bundlesPromise = null;
  }

  async getSpec(id: string, source: CatalogSource): Promise<ServiceSpec | undefined> {
    const key = this.cacheKey(id, source);
    const cached = this.cache.get(key);
    if (cached) return cached;

    let spec: ServiceSpec | undefined;
    if (source === 'builtin' || isServerMode) {
      spec = await this.loadBuiltinSpec(id);
    } else {
      spec = await driver.get<ServiceSpec>(this.userServiceKey(id));
    }

    if (!spec) return undefined;
    this.cache.set(key, spec);
    return spec;
  }

  async getUserServices(): Promise<ServiceSpec[]> {
    const ids = (await driver.get<string[]>('user-services-index')) || [];
    const values = await Promise.all(ids.map((id) => driver.get<ServiceSpec>(this.userServiceKey(id))));
    return values.filter((value): value is ServiceSpec => Boolean(value));
  }

  async saveUserService(spec: ServiceSpec): Promise<void> {
    await driver.set(this.userServiceKey(spec.id), spec);
    const ids = (await driver.get<string[]>('user-services-index')) || [];
    if (!ids.includes(spec.id)) {
      await driver.set('user-services-index', [...ids, spec.id]);
    }
    this.cache.set(this.cacheKey(spec.id, 'user'), spec);
  }

  async deleteUserService(id: string): Promise<void> {
    await driver.del(this.userServiceKey(id));
    const ids = (await driver.get<string[]>('user-services-index')) || [];
    await driver.set('user-services-index', ids.filter((existingId) => existingId !== id));
    this.cache.delete(this.cacheKey(id, 'user'));
  }

  async uploadServerService(id: string, files: { metadata: File; compose: File; icon?: File }): Promise<CatalogEntry> {
    const form = new FormData();
    form.append('metadata', await files.metadata.text());
    form.append('compose', await files.compose.text());
    if (files.icon) {
      form.append('icon', files.icon);
    }

    const response = await fetch(`/api/catalog/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(await readApiError(response));
    this.invalidateIndex();
    this.cache.delete(this.cacheKey(id, 'user'));
    return response.json() as Promise<CatalogEntry>;
  }

  async deleteServerService(id: string): Promise<void> {
    const response = await fetch(`/api/catalog/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await readApiError(response));
    this.invalidateIndex();
    this.cache.delete(this.cacheKey(id, 'user'));
  }

  async uploadServerBundle(id: string, bundle: File): Promise<BundleSpec> {
    const form = new FormData();
    form.append('bundle', await bundle.text());
    const response = await fetch(`/api/bundles/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error(await readApiError(response));
    this.invalidateBundles();
    return response.json() as Promise<BundleSpec>;
  }

  async deleteServerBundle(id: string): Promise<void> {
    const response = await fetch(`/api/bundles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(await readApiError(response));
    this.invalidateBundles();
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

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

function normalizeCategories(category?: string, categories?: string[]): string[] {
  const values = categories?.length ? categories : [category || 'OTHER'];
  return Array.from(new Set(values.map((value) => String(value || '').toUpperCase()).filter(Boolean)));
}
