import { ComposeData, BundleSpec, BundleImportConflict, GlobalSettings } from '@/types';
import { CatalogRegistry } from '@/lib/catalog';

export async function findBundleConflicts(
  config: ComposeData,
  bundle: BundleSpec,
  settings: GlobalSettings
): Promise<BundleImportConflict[]> {
  const conflicts: BundleImportConflict[] = [];

  bundle.mainServices.forEach((serviceId) => {
    if (config.services[serviceId]) {
      conflicts.push({
        type: 'service',
        key: serviceId,
        existingValue: config.services[serviceId],
        incomingValue: serviceId,
      });
    }
  });

  const usedPorts = new Set(settings.occupiedPorts);
  Object.values(config.services).forEach((service) => {
    service.ports.forEach((port) => usedPorts.add(port.host));
  });

  for (const serviceId of bundle.mainServices) {
    const spec = (await CatalogRegistry.getService(serviceId, 'builtin')) || CatalogRegistry.getCachedService(serviceId);
    if (spec?.defaultHostPort && usedPorts.has(spec.defaultHostPort)) {
      conflicts.push({
        type: 'port',
        key: spec.defaultHostPort.toString(),
        existingValue: 'Occupied',
        incomingValue: spec.defaultHostPort,
        serviceId,
      });
    }
  }

  return conflicts;
}

export async function findStackConflicts(
  current: ComposeData,
  incoming: ComposeData,
  settings: GlobalSettings
): Promise<BundleImportConflict[]> {
  const conflicts: BundleImportConflict[] = [];
  const usedPorts = getAllUsedPorts(current, settings);

  Object.entries(incoming.services)
    .filter(([, svc]) => svc.enabled)
    .forEach(([id, svc]) => {
      if (current.services[id]) {
        conflicts.push({ type: 'service', key: id, existingValue: current.services[id], incomingValue: svc });
      }
      svc.ports.forEach((p) => {
        if (usedPorts.has(p.host)) {
          conflicts.push({ type: 'port', key: p.host.toString(), existingValue: 'Occupied', incomingValue: p.host, serviceId: id });
        }
      });
    });

  return conflicts;
}

export function getNextFreePort(startPort: number, usedPorts: Set<number>): number {
  let port = startPort;
  while (usedPorts.has(port)) {
    port++;
  }
  return port;
}

export function uniqueComposeName(existingNames: string[], baseName: string): string {
  const set = new Set(existingNames);
  if (!set.has(baseName)) return baseName;
  let i = 2;
  while (set.has(`${baseName} ${i}`)) i++;
  return `${baseName} ${i}`;
}

export function getAllUsedPorts(config: ComposeData, settings: GlobalSettings): Set<number> {
  const used = new Set(settings.occupiedPorts);
  Object.values(config.services).forEach((service) => {
    service.ports.forEach((port) => used.add(port.host));
  });
  return used;
}
