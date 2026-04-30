import React from 'react';
import { Activity, Cpu } from 'lucide-react';
import { ServiceConfig, ServiceSpec } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { SettingsSection } from '../SettingsSection';

interface RuntimeSectionProps {
  restart?: ServiceConfig['restart'];
  limits?: ServiceConfig['limits'];
  containerName?: string;
  spec: ServiceSpec;
  onChange: (patch: Partial<ServiceConfig>) => void;
}

export function RuntimeSection({ restart, limits, containerName, spec, onChange }: RuntimeSectionProps) {
  return (
    <SettingsSection
      title="Runtime"
      icon={<Activity size={14} />}
      action={
        <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide lg:flex lg:w-1/2">
          <Cpu size={14} className="text-primary" /> Resource Quotas
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] text-muted-foreground/60">Container Name</Label>
            <Input
              defaultValue={containerName}
              onBlur={(e) => onChange({ containerName: e.target.value.trim() })}
              className="font-mono text-xs"
              placeholder="Auto-generated"
            />
          </div>

          <CustomSelect
            label="Restart Mode"
            value={restart || 'unless-stopped'}
            options={[
              { value: 'no', label: 'no' },
              { value: 'always', label: 'always' },
              { value: 'unless-stopped', label: 'unless-stopped' },
              { value: 'on-failure', label: 'on-failure' },
            ]}
            onChange={(value) => onChange({ restart: value as ServiceConfig['restart'] })}
          />
        </div>

        <div>
          <div className="lg:hidden">
            <SettingsSection.Subtitle title="Resource Quotas" icon={<Cpu size={14} />} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60">Max CPUs</Label>
              <Input
                defaultValue={limits?.cpus || spec.resourceLimits?.cpus}
                onBlur={(e) => onChange({ limits: { ...limits, cpus: e.target.value } })}
                className="font-mono text-xs"
                placeholder="0.5"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60">Max RAM</Label>
              <Input
                defaultValue={limits?.memory || spec.resourceLimits?.memory}
                onBlur={(e) => onChange({ limits: { ...limits, memory: e.target.value } })}
                className="font-mono text-xs"
                placeholder="512M"
              />
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
