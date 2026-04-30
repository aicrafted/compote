import React from 'react';
import { Database, Network, Plus, Trash2 } from 'lucide-react';
import {
  ServiceResourceRef,
  TopLevelConfigDef,
  TopLevelNetworkDef,
  TopLevelSecretDef,
  TopLevelVolumeDef,
} from '@/types';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Input } from '@/components/ui/input';
import { SuggestInput } from '@/components/ui/suggest-input';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from './SettingsSection';

type TopLevelResourceDef = TopLevelConfigDef | TopLevelSecretDef;

interface TopLevelResourceSectionProps<T extends TopLevelResourceDef> {
  title: string;
  icon: React.ReactNode;
  addLabel: string;
  resources: Record<string, T>;
  defaultFile: (name: string) => string;
  onAdd: (name: string, def: Partial<T>) => void;
  onUpdate: (name: string, def: Partial<T>, oldName?: string) => void;
  onRemove: (name: string) => void;
}

interface ServiceResourceSectionProps {
  title: string;
  icon: React.ReactNode;
  addLabel: string;
  emptyLabel?: string;
  resources: ServiceResourceRef[];
  availableSources: string[];
  defaultTarget: (source: string) => string;
  onChange: (resources: ServiceResourceRef[]) => void;
}

interface TopLevelNetworkSectionProps {
  networks: Record<string, TopLevelNetworkDef>;
  suggestions: string[];
  onAdd: (name: string, def: Partial<TopLevelNetworkDef>) => void;
  onUpdate: (name: string, def: Partial<TopLevelNetworkDef>, oldName?: string) => void;
  onRemove: (name: string) => void;
}

interface TopLevelVolumeSectionProps {
  volumes: Record<string, TopLevelVolumeDef>;
  suggestions: string[];
  onAdd: (name: string, def: Partial<TopLevelVolumeDef>) => void;
  onUpdate: (name: string, def: Partial<TopLevelVolumeDef>, oldName?: string) => void;
  onRemove: (name: string) => void;
}

export function TopLevelNetworkSection({
  networks,
  suggestions,
  onAdd,
  onUpdate,
  onRemove,
}: TopLevelNetworkSectionProps) {
  const handleAdd = () => {
    const id = `net_${Math.random().toString(36).slice(2, 7)}`;
    onAdd(id, { driver: 'bridge' });
  };
  const entries = Object.entries(networks);

  return (
    <SettingsSection
      title="Networks"
      icon={<Network size={14} />}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> Add network
        </Button>
      }
    >
      {entries.length > 0 && (
      <div className="rounded-lg border border-border/40 bg-background/30">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/30 bg-muted/20 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Driver</th>
              <th className="px-3 py-2 font-medium">External</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {entries.map(([name, def]) => (
              <tr key={name} className="group hover:bg-muted/10">
                <td className="px-3 py-2">
                  <Input
                    value={name}
                    onChange={(e) => onUpdate(e.target.value, def, name)}
                    className="border-transparent bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
                  />
                </td>
                <td className="px-3 py-2">
                  {def.external ? (
                    <span className="text-xs text-muted-foreground">Managed externally</span>
                  ) : (
                    <div className="w-36">
                      <CustomSelect
                        value={def.driver || 'bridge'}
                        onChange={(value) => onUpdate(name, { driver: value as TopLevelNetworkDef['driver'] })}
                        options={[
                          { value: 'bridge', label: 'bridge' },
                          { value: 'host', label: 'host' },
                          { value: 'overlay', label: 'overlay' },
                          { value: 'macvlan', label: 'macvlan' },
                          { value: 'none', label: 'none' },
                        ]}
                        variant="compact"
                      />
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`ext-${name}`}
                      checked={def.external || false}
                      onCheckedChange={(value) => onUpdate(name, { external: value })}
                    />
                    {def.external && (
                      <SuggestInput
                        value={def.name || ''}
                        onChange={(e) => onUpdate(name, { name: e.target.value })}
                        onValueChange={(value) => onUpdate(name, { name: value })}
                        placeholder="Real network name"
                        suggestions={suggestions}
                        className="max-w-[180px] text-xs"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(name)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </SettingsSection>
  );
}

export function TopLevelVolumeSection({
  volumes,
  suggestions,
  onAdd,
  onUpdate,
  onRemove,
}: TopLevelVolumeSectionProps) {
  const handleAdd = () => {
    const id = `vol_${Math.random().toString(36).slice(2, 7)}`;
    onAdd(id, { driver: 'local' });
  };
  const entries = Object.entries(volumes);

  return (
    <SettingsSection
      title="Volumes"
      icon={<Database size={14} />}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> Add volume
        </Button>
      }
    >
      {entries.length > 0 && (
      <div className="rounded-lg border border-border/40 bg-background/30">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/30 bg-muted/20 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Driver</th>
              <th className="px-3 py-2 font-medium">External</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {entries.map(([name, def]) => (
              <tr key={name} className="group hover:bg-muted/10">
                <td className="px-3 py-2">
                  <Input
                    value={name}
                    onChange={(e) => onUpdate(e.target.value, def, name)}
                    className="border-transparent bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={def.driver || 'local'}
                    onChange={(e) => onUpdate(name, { driver: e.target.value })}
                    disabled={def.external}
                    className="max-w-[140px] text-xs"
                  />
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      id={`vol-ext-${name}`}
                      checked={def.external || false}
                      onCheckedChange={(value) => onUpdate(name, { external: value })}
                    />
                    {def.external && (
                      <SuggestInput
                        value={def.name || ''}
                        onChange={(e) => onUpdate(name, { name: e.target.value })}
                        onValueChange={(value) => onUpdate(name, { name: value })}
                        placeholder="Real volume name"
                        suggestions={suggestions}
                        className="max-w-[180px] text-xs"
                      />
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(name)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </SettingsSection>
  );
}

export function TopLevelResourceSection<T extends TopLevelResourceDef>({
  title,
  icon,
  addLabel,
  resources,
  defaultFile,
  onAdd,
  onUpdate,
  onRemove,
}: TopLevelResourceSectionProps<T>) {
  const handleAdd = () => {
    const name = `${title.toLowerCase().slice(0, -1)}_${Math.random().toString(36).slice(2, 7)}`;
    onAdd(name, { file: defaultFile(name) } as Partial<T>);
  };
  const entries = Object.entries(resources);

  return (
    <SettingsSection
      title={title}
      icon={icon}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> {addLabel}
        </Button>
      }
    >
      {entries.length > 0 && (
      <div className="overflow-hidden rounded-lg border border-border/40 bg-background/30">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/30 bg-muted/20 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">File</th>
              <th className="px-3 py-2 font-medium">External</th>
              <th className="px-3 py-2 font-medium">External Name</th>
              <th className="w-10 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/20">
            {entries.map(([name, def]) => (
              <tr key={name} className="group hover:bg-muted/10">
                <td className="px-3 py-2">
                  <Input
                    value={name}
                    onChange={(event) => onUpdate(event.target.value, def as Partial<T>, name)}
                    className="border-transparent bg-transparent px-0 font-mono text-xs focus-visible:ring-0"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={def.file || ''}
                    disabled={def.external}
                    onChange={(event) => onUpdate(name, { file: event.target.value } as Partial<T>)}
                    className="max-w-[260px] font-mono text-xs"
                    placeholder={defaultFile(name)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Switch
                    checked={def.external || false}
                    onCheckedChange={(value) => onUpdate(name, { external: value } as Partial<T>)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={def.name || ''}
                    onChange={(event) => onUpdate(name, { name: event.target.value } as Partial<T>)}
                    className="max-w-[180px] font-mono text-xs"
                    placeholder={name}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemove(name)}
                    className="opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </SettingsSection>
  );
}

export function ServiceResourceSection({
  title,
  icon,
  addLabel,
  emptyLabel,
  resources,
  availableSources,
  defaultTarget,
  onChange,
}: ServiceResourceSectionProps) {
  const handleAdd = () => {
    const source = availableSources[0] || '';
    onChange([...resources, { source, target: source ? defaultTarget(source) : '', mode: '0444' }]);
  };

  const handleUpdate = (index: number, patch: Partial<ServiceResourceRef>) => {
    const next = [...resources];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(resources.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <SettingsSection
      title={title}
      icon={icon}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> {addLabel}
        </Button>
      }
    >
      <div className="space-y-2">
        {resources.map((resource, index) => (
          <div key={index} className="group/resource grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/40 bg-background/30 p-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {availableSources.length > 0 ? (
                <CustomSelect
                  label="Source"
                  value={resource.source}
                  onChange={(value) => handleUpdate(index, { source: value, target: resource.target || defaultTarget(value) })}
                  options={availableSources.map((source) => ({ value: source, label: source }))}
                />
              ) : (
                <Input
                  value={resource.source}
                  onChange={(event) => handleUpdate(index, { source: event.target.value })}
                  className="font-mono text-xs"
                  placeholder="source_name"
                />
              )}
              <Input
                value={resource.target || ''}
                onChange={(event) => handleUpdate(index, { target: event.target.value })}
                className="font-mono text-xs"
                placeholder={resource.source ? defaultTarget(resource.source) : '/path/in/container'}
              />
              <Input
                value={resource.mode || ''}
                onChange={(event) => handleUpdate(index, { mode: event.target.value })}
                className="font-mono text-xs"
                placeholder="0444"
              />
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleRemove(index)}
                className="opacity-0 group-hover/resource:opacity-100"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}

        {resources.length === 0 && emptyLabel && (
          <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-8 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
