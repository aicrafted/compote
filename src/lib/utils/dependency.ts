import { ComposeData, ServiceSpec } from '@/types';

/**
 * Sorts services by dependency order (Topological Sort)
 */
export function sortServicesByDependencies(config: ComposeData, allServices: ServiceSpec[]): string[] {
  const serviceIds = Object.keys(config.services);
  const visited = new Set<string>();
  const result: string[] = [];
  const temp = new Set<string>();

  function visit(id: string) {
    if (temp.has(id)) return;
    if (visited.has(id)) return;

    temp.add(id);

    const svc = config.services[id];
    const spec = allServices.find(s => s.id === svc.serviceId);

    // Catalog requirements + User overrides
    const depends = Array.from(new Set([
      ...(spec?.requires || []),
      ...(svc.dependsOn || []).map((dependency) => typeof dependency === 'string' ? dependency : dependency.service)
    ])).filter(d => config.services[d] !== undefined && d !== id);

    depends.forEach(depId => visit(depId));

    temp.delete(id);
    visited.add(id);
    result.push(id);
  }

  serviceIds.forEach(id => {
    if (!visited.has(id)) visit(id);
  });

  return result.reverse();
}
