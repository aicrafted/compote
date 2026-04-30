import { ComposeData } from '@/types';

export function renameResourceReferences(
  config: ComposeData,
  kind: 'network' | 'volume',
  oldName: string,
  newName: string
): ComposeData {
  if (kind === 'network') {
    const networks = { ...(config.networks || {}) };
    Object.entries(config.networks || {}).forEach(([key, def]) => {
      if (def.external && def.name === oldName) {
        networks[key] = { ...def, name: newName };
      }
      if (def.external && key === oldName && !def.name) {
        delete networks[key];
        networks[newName] = def;
      }
    });

    const services = Object.fromEntries(
      Object.entries(config.services).map(([id, service]) => [
        id,
        {
          ...service,
          networks: (service.networks || []).map((network) => (network === oldName ? newName : network)),
        },
      ])
    );

    return { ...config, networks, services };
  }

  const volumes = { ...(config.volumes || {}) };
  Object.entries(config.volumes || {}).forEach(([key, def]) => {
    if (def.external && def.name === oldName) {
      volumes[key] = { ...def, name: newName };
    }
    if (def.external && key === oldName && !def.name) {
      delete volumes[key];
      volumes[newName] = def;
    }
  });

  const services = Object.fromEntries(
    Object.entries(config.services).map(([id, service]) => [
      id,
      {
        ...service,
        volumes: (service.volumes || []).map((volume) =>
          volume.type === 'volume' && volume.host === oldName ? { ...volume, host: newName } : volume
        ),
      },
    ])
  );

  return { ...config, volumes, services };
}

