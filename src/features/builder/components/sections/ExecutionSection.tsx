import React from 'react';
import { Play } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SettingsSection } from '../SettingsSection';

interface ExecutionSectionProps {
  command?: string;
  entrypoint?: string;
  workingDir?: string;
  user?: string;
  profiles?: string[];
  onChange: (patch: Partial<ServiceConfig>) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function ExecutionSection({ command, entrypoint, workingDir, user, profiles, onChange, collapsible, defaultOpen }: ExecutionSectionProps) {
  return (
    <SettingsSection title="Execution" icon={<Play size={14} />} collapsible={collapsible} defaultOpen={defaultOpen}>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Command</Label>
          <Input
            defaultValue={command}
            onBlur={(e) => onChange({ command: e.target.value.trim() || undefined })}
            className="font-mono text-xs"
            placeholder="node server.js"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Entrypoint</Label>
          <Input
            defaultValue={entrypoint}
            onBlur={(e) => onChange({ entrypoint: e.target.value.trim() || undefined })}
            className="font-mono text-xs"
            placeholder="/bin/sh"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Working Directory</Label>
          <Input
            defaultValue={workingDir}
            onBlur={(e) => onChange({ workingDir: e.target.value.trim() || undefined })}
            className="font-mono text-xs"
            placeholder="/app"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">User</Label>
          <Input
            defaultValue={user}
            onBlur={(e) => onChange({ user: e.target.value.trim() || undefined })}
            className="font-mono text-xs"
            placeholder="1000:1000"
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Profiles (comma-separated)</Label>
          <Input
            defaultValue={profiles?.join(', ')}
            onBlur={(e) => {
              const val = e.target.value.trim();
              onChange({ profiles: val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined });
            }}
            className="font-mono text-xs"
            placeholder="dev, staging"
          />
        </div>
      </div>
    </SettingsSection>
  );
}
