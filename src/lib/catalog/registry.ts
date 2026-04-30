import { BundleSpec, CatalogEntry, ServiceSpec } from '@/types';
import { catalogRepository } from '@/lib/storage/CatalogRepository';

const cachedServices: Record<string, ServiceSpec> = {};
const cachedEntries: Record<string, CatalogEntry> = {};
const cachedBundles: BundleSpec[] = [];

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

  static cacheBundles(bundles: BundleSpec[]): void {
    cachedBundles.length = 0;
    cachedBundles.push(...bundles);
  }

  static getBundle(id: string): BundleSpec | undefined {
    return cachedBundles.find((bundle) => bundle.id === id);
  }

  static getAllBundles(): BundleSpec[] {
    return cachedBundles;
  }
}
