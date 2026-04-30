import React from 'react';
import { Cpu, Plus, Trash2 } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { Input } from '@/components/ui/input';
import { SettingsSection } from '../SettingsSection';

interface DevicesSectionProps {
  devices: ServiceConfig['devices'];
  onChange: (devices: ServiceConfig['devices']) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function DevicesSection({ devices = [], onChange, collapsible, defaultOpen }: DevicesSectionProps) {
  const handleAdd = () => {
    onChange([...devices, { host: '', container: '', permissions: 'rwm' }]);
  };

  const handleUpdate = (index: number, patch: Partial<NonNullable<ServiceConfig['devices']>[number]>) => {
    const next = [...devices];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(devices.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <SettingsSection
      title="Devices"
      icon={<Cpu size={14} />}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
      action={
        <Button variant="quiet-outline" size="sm" onClick={handleAdd}>
          <Plus size={14} /> Add Device
        </Button>
      }
    >
      {devices.length > 0 && (
        <div className="rounded-lg border border-border/40 bg-background/30">
          <div className="grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_6rem_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <div className="px-2.5 py-2">Host Device</div>
            <div className="border-l border-border/40 px-2.5 py-2">Container Device</div>
            <div className="border-l border-border/40 px-2.5 py-2">Access</div>
            <div />
          </div>
          <div className="divide-y divide-border/20">
            {devices.map((device, index) => (
              <div
                key={index}
                className="group/device grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,1fr)_6rem_2rem] items-center"
              >
                <Input
                  value={device.host}
                  onChange={(event) => handleUpdate(index, { host: event.target.value })}
                  className="h-8 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder="/dev/dri"
                />
                <Input
                  value={device.container}
                  onChange={(event) => handleUpdate(index, { container: event.target.value })}
                  className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                  placeholder="/dev/dri"
                />
                <div className="border-l border-border/40 px-1.5">
                  <CustomSelect
                    variant="compact"
                    value={device.permissions || 'rwm'}
                    onChange={(value) => handleUpdate(index, { permissions: value })}
                    className="[&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-1.5 [&_[data-slot=select-trigger]]:shadow-none"
                    options={[
                      { value: 'rwm', label: 'rwm' },
                      { value: 'rw', label: 'rw' },
                      { value: 'r', label: 'r' },
                    ]}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemove(index)}
                  className="mx-auto opacity-0 group-hover/device:opacity-100"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
