import React from 'react';
import { HardDrive, Plus, Trash2 } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SuggestInput } from '@/components/ui/suggest-input';
import { CustomSelect } from '@/components/ui/custom-select';
import { SettingsSection } from '../SettingsSection';

interface StorageSectionProps {
  volumes: ServiceConfig['volumes'];
  volumeSuggestions?: string[];
  onChange: (volumes: ServiceConfig['volumes']) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function StorageSection({ volumes, volumeSuggestions = [], onChange, collapsible, defaultOpen }: StorageSectionProps) {
  const handleAdd = () => {
    onChange([...(volumes || []), { host: '', container: '', mode: 'rw', type: 'bind' }]);
  };

  const handleUpdate = (idx: number, patch: Partial<ServiceConfig['volumes'][0]>) => {
    const next = [...volumes];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const handleRemove = (idx: number) => {
    onChange(volumes.filter((_, i) => i !== idx));
  };

  return (
    <SettingsSection
      title="Storage"
      icon={<HardDrive size={14} />}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> Add volume
        </Button>
      }
    >
      <div className="rounded-lg border border-border/40 bg-background/30">
        <div className="grid grid-cols-[7rem_minmax(10rem,1fr)_minmax(10rem,1fr)_4.5rem_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
          <div className="px-2.5 py-2">Type</div>
          <div className="border-l border-border/40 px-2.5 py-2">Source</div>
          <div className="border-l border-border/40 px-2.5 py-2">Container Path</div>
          <div className="border-l border-border/40 px-2.5 py-2">Mode</div>
          <div />
        </div>

        {volumes?.length ? (
          <div className="divide-y divide-border/20">
            {volumes.map((vol, idx) => (
              <div
                key={idx}
                className="group/item grid grid-cols-[7rem_minmax(10rem,1fr)_minmax(10rem,1fr)_4.5rem_2rem] items-center"
              >
                <div className="px-1.5">
                  <CustomSelect
                    variant="compact"
                    value={vol.type || 'bind'}
                    onChange={(value) => handleUpdate(idx, { type: value as 'bind' | 'volume' })}
                    className="[&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-1.5 [&_[data-slot=select-trigger]]:shadow-none"
                    options={[
                      { value: 'bind', label: 'bind' },
                      { value: 'volume', label: 'volume' },
                    ]}
                  />
                </div>
                <SuggestInput
                  value={vol.host}
                  onChange={(e) => handleUpdate(idx, { host: e.target.value })}
                  onValueChange={(value) => handleUpdate(idx, { host: value })}
                  suggestions={vol.type === 'volume' ? volumeSuggestions : []}
                  className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder={vol.type === 'volume' ? 'my_named_volume' : './data'}
                />
                <Input
                  value={vol.container}
                  onChange={(e) => handleUpdate(idx, { container: e.target.value })}
                  className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder="/app/data"
                />
                <div className="border-l border-border/40 px-1.5">
                  <CustomSelect
                    variant="compact"
                    value={vol.mode || 'rw'}
                    onChange={(value) => handleUpdate(idx, { mode: value as ServiceConfig['volumes'][0]['mode'] })}
                    className="[&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-1.5 [&_[data-slot=select-trigger]]:shadow-none"
                    options={[
                      { value: 'rw', label: 'rw' },
                      { value: 'ro', label: 'ro' },
                    ]}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemove(idx)}
                  className="mx-auto opacity-0 group-hover/item:opacity-100"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">No storage mounts defined.</div>
        )}
      </div>
    </SettingsSection>
  );
}
