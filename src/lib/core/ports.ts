import { ServiceConfig, ServiceSpec } from '@/types';

export function getDefaultPortMappings(spec: ServiceSpec): ServiceConfig['ports'] {
  const containerPorts = getExposedPorts(spec);
  if (!spec.defaultHostPort || containerPorts.length === 0) return [];

  return [{
    host: spec.defaultHostPort,
    container: containerPorts[0],
    protocol: 'tcp',
  }];
}

export function getExposedPorts(spec: Pick<ServiceSpec, 'containerPorts'>): number[] {
  return Array.from(new Set((spec.containerPorts || []).filter((port) => Number.isFinite(port) && port > 0)));
}

export function formatMappedPorts(ports: ServiceConfig['ports']): string[] {
  return ports
    .filter((port) => Number.isFinite(port.host) && Number.isFinite(port.container))
    .map((port) => {
      const mapping = port.host === port.container ? String(port.host) : `${port.host}->${port.container}`;
      return port.protocol && port.protocol !== 'tcp' ? `${mapping}/${port.protocol}` : mapping;
    });
}

export function formatExposedPorts(ports: number[]): string[] {
  return ports.map((port) => String(port));
}

