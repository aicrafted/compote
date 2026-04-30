import React from 'react';
import { HeartPulse } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { SettingsSection } from '../SettingsSection';

interface HealthcheckSectionProps {
  healthcheck?: ServiceConfig['healthcheck'];
  onChange: (healthcheck?: ServiceConfig['healthcheck']) => void;
}

export function HealthcheckSection({ healthcheck, onChange }: HealthcheckSectionProps) {
  const activeHealthcheck = healthcheck || {};
  const hasHealthcheck = Boolean(healthcheck);

  const handlePatch = (patch: Partial<NonNullable<ServiceConfig['healthcheck']>>) => {
    onChange({ ...activeHealthcheck, ...patch });
  };

  return (
    <SettingsSection
      title="Healthcheck"
      icon={<HeartPulse size={14} />}
      action={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Enabled</span>
          <Switch
            size="sm"
            checked={hasHealthcheck && !activeHealthcheck.disable}
            onCheckedChange={(checked) => {
              if (checked) {
                onChange({ ...activeHealthcheck, disable: false });
              } else {
                onChange({ ...activeHealthcheck, disable: true });
              }
            }}
          />
        </div>
      }
    >
      {hasHealthcheck && !activeHealthcheck.disable && (
        <div className="rounded-lg border border-border/40 bg-background/30">
          <div className="grid grid-cols-[minmax(14rem,1.6fr)_7rem_7rem_5rem_7rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <div className="px-2.5 py-2">Command</div>
            <div className="border-l border-border/40 px-2.5 py-2">Interval</div>
            <div className="border-l border-border/40 px-2.5 py-2">Timeout</div>
            <div className="border-l border-border/40 px-2.5 py-2">Retries</div>
            <div className="border-l border-border/40 px-2.5 py-2">Start Period</div>
          </div>
          <div className="grid grid-cols-[minmax(14rem,1.6fr)_7rem_7rem_5rem_7rem] items-center">
            <Input
              value={activeHealthcheck.test || ''}
              onChange={(event) => handlePatch({ test: event.target.value })}
              className="h-8 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
              placeholder="curl -f http://localhost/ || exit 1"
            />
            <Input
              value={activeHealthcheck.interval || ''}
              onChange={(event) => handlePatch({ interval: event.target.value })}
              className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
              placeholder="30s"
            />
            <Input
              value={activeHealthcheck.timeout || ''}
              onChange={(event) => handlePatch({ timeout: event.target.value })}
              className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
              placeholder="10s"
            />
            <Input
              type="number"
              value={activeHealthcheck.retries ?? ''}
              onChange={(event) => handlePatch({ retries: parseInt(event.target.value) || undefined })}
              className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
              placeholder="3"
            />
            <Input
              value={activeHealthcheck.startPeriod || ''}
              onChange={(event) => handlePatch({ startPeriod: event.target.value })}
              className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
              placeholder="10s"
            />
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
