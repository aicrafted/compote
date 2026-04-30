import { useCallback, useEffect, useMemo, useState } from 'react';
import { BundleSpec, CatalogEntry, ServiceSpec } from '@/types';
import { catalogRepository } from '@/lib/storage/CatalogRepository';
import { CatalogRegistry } from './registry';

export * from './registry';

function toUserEntry(spec: ServiceSpec): CatalogEntry {
  const categories = getCatalogCategories(spec);
  return {
    id: spec.id,
    name: spec.name,
    category: categories[0],
    categories,
    description: spec.description,
    source: 'user',
    tags: spec.tags,
    resourceClass: spec.resourceClass,
  };
}

export function getCatalogCategories(item: Pick<CatalogEntry | ServiceSpec, 'category' | 'categories'>): string[] {
  const categories = item.categories?.length ? item.categories : [item.category];
  return Array.from(new Set(categories.map((category) => category.toUpperCase()).filter(Boolean)));
}

export function getCatalogIconUrl(entry: CatalogEntry): string | null {
  if (entry.source === 'builtin') {
    const ext = entry.iconSVG ? 'svg' : 'png';
    return `/catalog/${entry.id}/icon.${ext}`;
  }
  const cached = CatalogRegistry.getCachedService(entry.id);
  return cached?.icon || null;
}

export function useCatalog() {
  const [entries, setEntries] = useState<CatalogEntry[]>([]);
  const [bundles, setBundles] = useState<BundleSpec[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [builtinEntries, userServices, loadedBundles] = await Promise.all([
        catalogRepository.loadIndex(),
        catalogRepository.getUserServices(),
        catalogRepository.loadBundles(),
      ]);

      builtinEntries.forEach((entry) => {
        CatalogRegistry.cacheEntry(entry);
      });
      userServices.forEach((service) => {
        CatalogRegistry.cacheService(service);
      });
      CatalogRegistry.cacheBundles(loadedBundles);

      if (!mounted) return;
      setEntries([...builtinEntries, ...userServices.map(toUserEntry)]);
      setBundles(loadedBundles);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const servicesByCategory = useMemo(() => {
    const grouped: Record<string, CatalogEntry[]> = {};
    entries.forEach((entry) => {
      getCatalogCategories(entry).forEach((category) => {
        if (!grouped[category]) grouped[category] = [];
        grouped[category].push(entry);
      });
    });
    return grouped;
  }, [entries]);

  const getSpec = useCallback(
    async (id: string, source?: CatalogEntry['source']) => {
      const registryCached = CatalogRegistry.getCachedService(id);
      if (registryCached) return registryCached;
      const resolvedSource = source || entries.find((entry) => entry.id === id)?.source || 'builtin';
      const spec = await catalogRepository.getSpec(id, resolvedSource);
      if (spec) {
        CatalogRegistry.cacheService(spec);
      }
      return spec;
    },
    [entries]
  );

  const addUserService = useCallback(async (spec: ServiceSpec) => {
    await catalogRepository.saveUserService(spec);
    CatalogRegistry.cacheService(spec);
    setEntries((prev) => [...prev.filter((entry) => entry.id !== spec.id), toUserEntry(spec)]);
  }, []);

  const removeUserService = useCallback(async (id: string) => {
    await catalogRepository.deleteUserService(id);
    CatalogRegistry.removeCachedService(id);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return {
    entries,
    allServices: entries,
    servicesByCategory,
    allBundles: bundles,
    getSpec,
    addUserService,
    removeUserService,
    loading,
  };
}
