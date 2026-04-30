import { ComposeData } from '@/types';

export function getAggregatePorts(stacks: ComposeData[]): number[] {
  return Array.from(
    new Set(
      stacks.flatMap((data) =>
        Object.values(data.services)
          .filter((svc) => svc.enabled)
          .flatMap((svc) =>
            (svc.ports || [])
              .map((port) => port?.host)
              .filter((port): port is number => typeof port === 'number' && Number.isFinite(port) && port > 0)
          )
      )
    )
  ).sort((a, b) => a - b);
}

export function getAggregateVolumes(stacks: ComposeData[]): string[] {
  return Array.from(
    new Set(
      stacks.flatMap((data) =>
        Object.values(data.services)
          .filter((svc) => svc.enabled)
          .flatMap((svc) =>
            (svc.volumes || [])
              .map((volume) => volume?.host?.trim())
              .filter((host): host is string => Boolean(host))
              .filter((host) => host.startsWith('/') || host.startsWith('./') || host.includes(':'))
          )
      )
    )
  );
}

export function getAggregateNetworks(stacks: ComposeData[]): string[] {
  return Array.from(
    new Set(
      stacks.flatMap((data) => [
        ...Object.values(data.services)
          .filter((svc) => svc.enabled)
          .flatMap((svc) => svc.networks || []),
        ...Object.keys(data.networks || {}),
      ])
    )
  );
}

export function getDiscoveredExternalNetworks(stacks: ComposeData[]): string[] {
  return Array.from(
    new Set(
      stacks.flatMap((data) => [
        ...Object.entries(data.networks || {})
          .filter(([, def]) => def.external)
          .map(([name, def]) => def.name || name),
        ...Object.values(data.services)
          .filter((svc) => svc.enabled)
          .flatMap((svc) => svc.networks || []),
      ]).filter(Boolean)
    )
  );
}

export function getDiscoveredExternalVolumes(stacks: ComposeData[]): string[] {
  return Array.from(
    new Set(
      stacks.flatMap((data) => [
        ...Object.entries(data.volumes || {})
          .filter(([, def]) => def.external)
          .map(([name, def]) => def.name || name),
        ...Object.values(data.services)
          .filter((svc) => svc.enabled)
          .flatMap((svc) =>
            (svc.volumes || [])
              .filter((volume) => volume.type === 'volume')
              .map((volume) => volume.host?.trim())
              .filter((host): host is string => Boolean(host) && isNamedVolumeRef(host))
          ),
      ]).filter(Boolean)
    )
  );
}

function isNamedVolumeRef(value: string): boolean {
  return !(
    value.startsWith('.') ||
    value.startsWith('/') ||
    value.startsWith('~') ||
    value.includes('\\') ||
    /^[A-Za-z]:/.test(value)
  );
}
