import { useState } from 'react';
import { AlertTriangle, Box, Container, GitBranch, HardDrive, Network, Plug, X } from 'lucide-react';
import { CatalogEntry, RuleResult, ServiceConfig } from '@/types';
import { cn } from '@/lib/utils';
import { getServiceSpecOrFallback } from '@/lib/catalog/spec-utils';
import { formatExposedPorts, formatMappedPorts, getExposedPorts } from '@/lib/core/ports';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCatalogIconUrl } from '@/lib/catalog';

interface ServiceListProps {
  services: [string, ServiceConfig][];
  entryById: Record<string, CatalogEntry>;
  validationResults: RuleResult[];
  activeInstanceId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}

export function ServiceList({ services, entryById, validationResults, activeInstanceId, onSelect, onRemove }: ServiceListProps) {
  const sortedServices = [...services].sort(([leftId, left], [rightId, right]) => {
    const leftName = entryById[left.serviceId]?.name || leftId;
    const rightName = entryById[right.serviceId]?.name || rightId;
    return leftName.localeCompare(rightName, undefined, { sensitivity: 'base' }) || leftId.localeCompare(rightId);
  });

  return (
    <div className="space-y-3 pt-0 mt-1">
      <div className="space-y-2">
        {sortedServices.length > 0 ? (
          sortedServices.map(([instanceId, instance]) => {
            const spec = getServiceSpecOrFallback(instance.serviceId, instance);
            const portLabels = formatMappedPorts(instance.ports);
            const visiblePortLabels = portLabels.slice(0, 2);
            const extraPortCount = Math.max(0, portLabels.length - visiblePortLabels.length);
            const exposedPortLabels = formatExposedPorts(getExposedPorts(spec));
            const imageLabel = getImageLabel(instance, spec);
            const networkTitle = instance.networks.length > 0 ? instance.networks.join(', ') : 'No networks';
            const issue = getHighestIssue(instanceId, instance, validationResults);
            const dependencies = getDependencyLabels(instance, spec, entryById);

            return (
              <div
                key={instanceId}
                onClick={() => onSelect(instanceId)}
                className={cn(
                  'group relative flex flex-col gap-2 p-3 rounded-2xl transition-all border cursor-pointer select-none',
                  activeInstanceId === instanceId ? 'bg-card border-primary/40 shadow-sm ring-1 ring-primary/5' : 'border-transparent bg-card/30 hover:bg-muted/10'
                )}
              >
                <div className="flex items-center justify-between min-w-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <ServiceIcon
                      entry={entryById[instance.serviceId]}
                      active={activeInstanceId === instanceId}
                    />
                    <div className="min-w-0">
                      <p className={cn('text-xs font-bold truncate', activeInstanceId === instanceId ? 'text-foreground' : 'text-muted-foreground/70')}>
                        {instanceId}
                      </p>
                      <p className="text-[9px] text-muted-foreground/40 truncate font-mono">{imageLabel}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(instanceId);
                    }}
                  >
                    <X size={12} strokeWidth={3} />
                  </Button>
                </div>

                <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-1 text-[9px] font-bold text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1" title={networkTitle}>
                      <Network size={10} className={instance.networks.length > 0 ? 'text-primary' : ''} />
                      <span>{instance.networks.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <HardDrive size={10} className={instance.volumes.length > 0 ? 'text-secondary' : ''} />
                      <span>{instance.volumes.length}</span>
                    </div>
                    {issue && (
                      <span
                        title={`${issue.title}: ${issue.message}`}
                        className={cn(
                          'flex size-4 items-center justify-center rounded-md',
                          issue.severity === 'error' ? 'text-destructive' : 'text-secondary'
                        )}
                      >
                        <AlertTriangle size={10} />
                      </span>
                    )}
                    {dependencies.length > 0 && (
                      <span
                        title={`Depends on: ${dependencies.join(', ')}`}
                        className="flex size-4 items-center justify-center rounded-md text-primary/80"
                      >
                        <GitBranch size={10} />
                      </span>
                    )}
                    {!instance.enabled && (
                      <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[8px] font-black uppercase">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center justify-end gap-1 overflow-hidden">
                    {exposedPortLabels.length > 0 && (
                      <span
                        title={`Exposed: ${exposedPortLabels.join(', ')}`}
                        className="inline-flex min-w-0 max-w-20 items-center gap-1 rounded-md px-1 py-0.5 font-mono text-[9px] text-muted-foreground/55"
                      >
                        <Container size={9} className="shrink-0 text-muted-foreground/50" />
                        <span className="truncate">{exposedPortLabels[0]}</span>
                      </span>
                    )}
                    {visiblePortLabels.map((label) => (
                      <span
                        key={label}
                        className="inline-flex min-w-0 max-w-20 items-center gap-1 rounded-md border border-border/40 bg-background/30 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground/70"
                      >
                        <Plug size={9} className="shrink-0 text-primary/70" />
                        <span className="truncate">{label}</span>
                      </span>
                    ))}
                    {extraPortCount > 0 && (
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50">+{extraPortCount}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center px-4 bg-muted/5 rounded-3xl border border-dashed border-border/50">
            <p className="text-[10px] text-muted-foreground leading-relaxed italic">No services in this compose.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getImageLabel(instance: ServiceConfig, spec: ReturnType<typeof getServiceSpecOrFallback>): string {
  const image = instance.image || spec.image || instance.serviceId;
  const [base, fallbackTag] = splitImageRef(image);
  return `${base}:${instance.imageTag || fallbackTag || 'latest'}`;
}

function splitImageRef(image: string): [string, string | undefined] {
  const slashIndex = image.lastIndexOf('/');
  const colonIndex = image.lastIndexOf(':');
  if (colonIndex > slashIndex) {
    return [image.slice(0, colonIndex), image.slice(colonIndex + 1)];
  }
  return [image, undefined];
}

function getHighestIssue(instanceId: string, instance: ServiceConfig, results: RuleResult[]): RuleResult | undefined {
  const issues = results.filter((result) =>
    (result.severity === 'error' || result.severity === 'warning') &&
    (result.affectedServices.includes(instanceId) || result.affectedServices.includes(instance.serviceId))
  );

  return issues.find((issue) => issue.severity === 'error') || issues[0];
}

function getDependencyLabels(
  instance: ServiceConfig,
  spec: ReturnType<typeof getServiceSpecOrFallback>,
  entryById: Record<string, CatalogEntry>
): string[] {
  return Array.from(new Set([
    ...(instance.dependsOn || []).map((dependency) => typeof dependency === 'string' ? dependency : dependency.service),
    ...(spec.requires || []),
  ]))
    .map((id) => entryById[id]?.name || id);
}

function ServiceIcon({ entry, active }: { entry?: CatalogEntry; active: boolean }) {
  const [iconFailed, setIconFailed] = useState(false);
  const iconUrl = entry ? getCatalogIconUrl(entry) : null;

  return (
    <div
      className={cn(
        'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-colors',
        active ? 'bg-primary/10 border-primary/20 shadow-sm' : 'bg-muted/30 border-border'
      )}
    >
      {iconUrl && !iconFailed
        ? <img src={iconUrl} className="size-4 object-contain" alt="" onError={() => setIconFailed(true)} />
        : <Box size={16} className="text-muted-foreground" />
      }
    </div>
  );
}
