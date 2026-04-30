import React from 'react';
import { Clock, Plus, X } from 'lucide-react';
import { ServiceDependency, ServiceDependencyCondition, ServiceSpec } from '@/types';
import { SettingsSection } from '../SettingsSection';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';

interface BootOrderSectionProps {
  dependsOn?: (string | ServiceDependency)[];
  spec: ServiceSpec;
  availableServices: string[];
  onChange: (dependsOn: ServiceDependency[]) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const CONDITION_OPTIONS: { value: ServiceDependencyCondition; label: string }[] = [
  { value: 'service_started', label: 'started' },
  { value: 'service_healthy', label: 'healthy' },
  { value: 'service_completed_successfully', label: 'completed' },
];

function normalizeDependsOn(dependsOn: (string | ServiceDependency)[] = []): ServiceDependency[] {
  return dependsOn.map((dependency) => (
    typeof dependency === 'string'
      ? { service: dependency, condition: 'service_healthy' }
      : dependency
  ));
}

export function BootOrderSection({ dependsOn, spec, availableServices, onChange, collapsible, defaultOpen }: BootOrderSectionProps) {
  const userDependencies = normalizeDependsOn(dependsOn);
  const catalogDependencies = (spec.requires || []).filter((id) => availableServices.includes(id));
  const selectedServices = new Set([...catalogDependencies, ...userDependencies.map((dependency) => dependency.service)]);
  const addableServices = availableServices.filter((id) => !selectedServices.has(id));

  const handleUpdate = (service: string, patch: Partial<ServiceDependency>) => {
    onChange(userDependencies.map((dependency) => (
      dependency.service === service ? { ...dependency, ...patch } : dependency
    )));
  };

  const handleRemove = (service: string) => {
    onChange(userDependencies.filter((dependency) => dependency.service !== service));
  };

  return (
    <SettingsSection
      title="Depends on"
      icon={<Clock size={14} />}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      <div className="text-[10px] font-medium tracking-wide text-muted-foreground/60">
        Select services that must start before this service
      </div>

      {(catalogDependencies.length > 0 || userDependencies.length > 0) ? (
        <div className="overflow-hidden rounded-lg border border-border/40 bg-background/30">
          <div className="grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,12rem)_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
            <div className="px-2.5 py-2">Service</div>
            <div className="border-l border-border/40 px-2.5 py-2">Condition</div>
            <div />
          </div>

          <div className="divide-y divide-border/20">
            {catalogDependencies.map((service) => (
              <div key={`catalog:${service}`} className="grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,12rem)_2rem] items-center opacity-60">
                <div className="px-2.5 py-2 font-mono text-xs text-primary">{service}</div>
                <div className="border-l border-border/40 px-2.5 py-2 font-mono text-xs text-muted-foreground">healthy</div>
                <div />
              </div>
            ))}
            {userDependencies.map((dependency) => (
              <div key={dependency.service} className="group/dependency grid grid-cols-[minmax(10rem,1fr)_minmax(10rem,12rem)_2rem] items-center">
                <div className="px-2.5 py-2 font-mono text-xs text-foreground">{dependency.service}</div>
                <div className="border-l border-border/40 px-1.5">
                  <CustomSelect
                    variant="compact"
                    value={dependency.condition}
                    onChange={(value) => handleUpdate(dependency.service, { condition: value as ServiceDependencyCondition })}
                    className="[&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-1.5 [&_[data-slot=select-trigger]]:shadow-none"
                    options={CONDITION_OPTIONS}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemove(dependency.service)}
                  className="mx-auto opacity-0 group-hover/dependency:opacity-100"
                >
                  <X size={12} />
                </Button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border/40 bg-background/30 px-3 py-3 text-xs text-muted-foreground">
          No dependencies configured.
        </div>
      )}

      {addableServices.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {addableServices.map((id) => (
            <Button
              key={id}
              variant="ghost"
              size="sm"
              onClick={() => onChange([...userDependencies, { service: id, condition: 'service_healthy' }])}
              className="h-7 px-2 font-mono text-[10px]"
            >
              <Plus size={12} /> {id}
            </Button>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
