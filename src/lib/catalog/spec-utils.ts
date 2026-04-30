import { ServiceConfig, ServiceSpec } from '@/types';
import { CatalogRegistry } from './registry';

export function getCachedServiceSpec(serviceId: string): ServiceSpec | undefined {
  return CatalogRegistry.getCachedService(serviceId);
}

export function getServiceSpecOrFallback(serviceId: string, svc: ServiceConfig): ServiceSpec {
  const cached = CatalogRegistry.getCachedService(serviceId);
  if (cached) return cached;

  const imageBase = svc.imageTag ? `${serviceId}:${svc.imageTag}` : `${serviceId}:latest`;
  return {
    id: serviceId,
    name: serviceId,
    category: 'OTHER',
    categories: ['OTHER'],
    description: '',
    image: imageBase,
    tags: [],
    containerPorts: svc.ports.map((port) => port.container),
    requires: [],
    requiredEnv: [],
    resourceLimits: undefined,
    volumes: [],
  };
}
