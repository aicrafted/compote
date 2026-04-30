import { useEffect, useState } from 'react';
import { HostMetadata, ServiceConfig } from '@/types';
import { composeRepository } from '@/lib/storage/ComposeRepository';

export function useHostStacksCache(
  host: HostMetadata | undefined,
  activeComposeId: string | null,
  activeServices: Record<string, ServiceConfig>
): Record<string, Record<string, ServiceConfig>> {
  const [cache, setCache] = useState<Record<string, Record<string, ServiceConfig>>>({});

  useEffect(() => {
    async function loadCache() {
      if (!host) {
        setCache({});
        return;
      }

      const composeIds = host.stacks.map((s) => s.id);
      const allComposes = await composeRepository.getAllForHost(host.id, composeIds);

      const nextCache: Record<string, Record<string, ServiceConfig>> = {};
      host.stacks.forEach((stack) => {
        if (stack.id === activeComposeId) {
          nextCache[stack.id] = activeServices;
          return;
        }
        const compose = allComposes[stack.id];
        if (compose?.services) {
          nextCache[stack.id] = compose.services;
        }
      });
      setCache(nextCache);
    }

    loadCache();
  }, [host, activeComposeId, activeServices]);

  return cache;
}
