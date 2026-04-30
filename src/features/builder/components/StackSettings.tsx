import React from 'react';
import { Box, FileCog, KeyRound, Layers, Plus, Trash2, Upload } from 'lucide-react';
import { CatalogEntry } from '@/types';
import { useCatalog } from '@/lib/catalog';
import { getServiceSpecOrFallback } from '@/lib/catalog/spec-utils';
import { formatExposedPorts, formatMappedPorts, getExposedPorts } from '@/lib/core/ports';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStore } from '@/lib/store/useHostStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from './SettingsSection';
import { TopLevelNetworkSection, TopLevelResourceSection, TopLevelVolumeSection } from './ResourceSections';

interface StackSettingsProps {
  onAddService: () => void;
  onAddBundle: () => void;
  onImport: () => void;
}

export function StackSettings({ onAddService, onAddBundle, onImport }: StackSettingsProps) {
  const {
    config,
    updateStackConfig,
    upsertNetwork,
    removeNetwork,
    upsertVolume,
    removeVolume,
    upsertConfig,
    removeConfig,
    upsertSecret,
    removeSecret,
    upsertService,
    removeService,
    setActiveInstance,
  } = useComposeStore();
  const { settings } = useHostStore();
  const { allServices } = useCatalog();

  const catalogById = React.useMemo(() => {
    return allServices.reduce<Record<string, CatalogEntry>>((acc, service) => {
      acc[service.id] = service;
      return acc;
    }, {});
  }, [allServices]);

  const discoveredNetworkSuggestions = React.useMemo(() => {
    return Array.from(new Set([
      ...(settings.externalNetworks || []),
      ...Object.entries(config.networks || {}).map(([networkName, def]) => def.name || networkName),
      ...Object.values(config.services).flatMap((service) => service.networks || []),
    ].filter(Boolean)));
  }, [config.networks, config.services, settings.externalNetworks]);

  const discoveredVolumeSuggestions = React.useMemo(() => {
    return Array.from(new Set([
      ...(settings.externalVolumes || []),
      ...Object.entries(config.volumes || {}).map(([volumeName, def]) => def.name || volumeName),
      ...Object.values(config.services).flatMap((service) =>
        (service.volumes || [])
          .filter((volume) => volume.type === 'volume')
          .map((volume) => volume.host)
      ),
    ].filter(Boolean)));
  }, [config.volumes, config.services, settings.externalVolumes]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="max-w-xl space-y-2">
        <Label className="text-xs text-muted-foreground">Compose project name</Label>
        <Input
          value={config.projectName || ''}
          onChange={(e) => updateStackConfig({ projectName: e.target.value })}
          placeholder="My Awesome Project"
        />
      </div>

      <SettingsSection
        title="Services"
        icon={<Box size={14} />}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="quiet-outline" size="sm" onClick={onAddService}>
              <Plus size={14} /> Add service
            </Button>
            <Button variant="quiet-outline" size="sm" onClick={onAddBundle}>
              <Layers size={14} /> Add bundle
            </Button>
            <Button variant="ghost" size="sm" onClick={onImport}>
              <Upload size={14} /> Import
            </Button>
          </div>
        }
      >
        <div className="rounded-lg border border-border/40 bg-background/30">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/30 bg-muted/20 text-[10px] font-medium tracking-wide text-muted-foreground/60">
              <tr>
                <th className="px-3 py-2 font-medium">Instance</th>
                <th className="px-3 py-2 font-medium">Service</th>
                <th className="px-3 py-2 text-right font-medium">Ports</th>
                <th className="px-3 py-2 font-medium">Enabled</th>
                <th className="w-20 px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {Object.entries(config.services).map(([instanceId, service]) => {
                const catalogEntry = catalogById[service.serviceId];
                const spec = getServiceSpecOrFallback(service.serviceId, service);
                const mappedPorts = formatMappedPorts(service.ports).join(', ');
                const exposedPorts = formatExposedPorts(getExposedPorts(spec)).join(', ');

                return (
                  <tr key={instanceId} className="group hover:bg-muted/10">
                    <td className="px-3 py-2 font-mono">{instanceId}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{catalogEntry?.name || service.serviceId}</span>
                        <span className="text-[10px] text-muted-foreground">{service.serviceId}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>{mappedPorts || '-'}</span>
                        {exposedPorts && (
                          <span className="text-[10px] text-muted-foreground/50">exposed {exposedPorts}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Switch
                        checked={service.enabled}
                        onCheckedChange={(enabled) => upsertService(instanceId, { enabled })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setActiveInstance(instanceId)}>
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeService(instanceId)}
                          className="opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {Object.keys(config.services).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No services in this compose.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      <TopLevelNetworkSection
        networks={config.networks || {}}
        suggestions={discoveredNetworkSuggestions}
        onAdd={upsertNetwork}
        onUpdate={upsertNetwork}
        onRemove={removeNetwork}
      />

      <TopLevelVolumeSection
        volumes={config.volumes || {}}
        suggestions={discoveredVolumeSuggestions}
        onAdd={upsertVolume}
        onUpdate={upsertVolume}
        onRemove={removeVolume}
      />

      <TopLevelResourceSection
        title="Configs"
        icon={<FileCog size={14} />}
        addLabel="Add config"
        resources={config.configs || {}}
        defaultFile={(name) => `./config/${name}`}
        onAdd={upsertConfig}
        onUpdate={upsertConfig}
        onRemove={removeConfig}
      />

      <TopLevelResourceSection
        title="Secrets"
        icon={<KeyRound size={14} />}
        addLabel="Add secret"
        resources={config.secrets || {}}
        defaultFile={(name) => `./secrets/${name}`}
        onAdd={upsertSecret}
        onUpdate={upsertSecret}
        onRemove={removeSecret}
      />
    </div>
  );
}
