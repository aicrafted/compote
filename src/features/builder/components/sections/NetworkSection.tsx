import React from 'react';
import { AlertTriangle, Network, Plus, Trash2, ShieldCheck, X } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SuggestInput } from '@/components/ui/suggest-input';
import { CustomSelect } from '@/components/ui/custom-select';
import { SettingsSection } from '../SettingsSection';

interface NetworkSectionProps {
  serviceId: string;
  networks: string[];
  ports: ServiceConfig['ports'];
  exposedPorts?: number[];
  networkSuggestions?: string[];
  portConflicts?: Record<number, string[]>;
  onChange: (patch: Partial<ServiceConfig>) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

export function NetworkSection({ serviceId, networks, ports, exposedPorts = [], networkSuggestions = [], portConflicts = {}, onChange, collapsible, defaultOpen }: NetworkSectionProps) {
  const [draftNetworks, setDraftNetworks] = React.useState(networks || []);
  const [open, setOpen] = React.useState(defaultOpen ?? Boolean(networks?.length || ports?.length));
  const hostPortInputsRef = React.useRef<Record<number, HTMLInputElement | null>>({});

  React.useEffect(() => {
    setDraftNetworks(networks || []);
  }, [networks]);

  React.useEffect(() => {
    const handleFocusPort = (event: Event) => {
      const detail = (event as CustomEvent<{ serviceId: string; hostPort: number }>).detail;
      if (detail?.serviceId !== serviceId || !detail.hostPort) return;
      setOpen(true);
      window.setTimeout(() => {
        const input = hostPortInputsRef.current[detail.hostPort];
        input?.focus();
        input?.select();
      }, 0);
    };

    window.addEventListener('compote:focus-host-port', handleFocusPort);
    return () => window.removeEventListener('compote:focus-host-port', handleFocusPort);
  }, [serviceId]);

  const commitNetworks = (nextNetworks = draftNetworks) => {
    onChange({ networks: nextNetworks.map((network) => network.trim()).filter(Boolean) });
  };

  const handleAddNetwork = () => {
    setDraftNetworks([...(draftNetworks || []), '']);
  };

  const handleUpdateNetwork = (idx: number, value: string) => {
    const next = [...draftNetworks];
    next[idx] = value;
    setDraftNetworks(next);
  };

  const handleRemoveNetwork = (idx: number) => {
    const next = draftNetworks.filter((_, i) => i !== idx);
    setDraftNetworks(next);
    commitNetworks(next);
  };

  const handleAddPort = () => {
    const container = exposedPorts.find((port) => !ports.some((mapped) => mapped.container === port)) || 80;
    onChange({ ports: [...ports, { host: container, container, protocol: 'tcp' }] });
  };

  const handleMapExposedPort = (container: number) => {
    if (ports.some((port) => port.container === container)) return;
    onChange({ ports: [...ports, { host: container, container, protocol: 'tcp' }] });
  };

  const handleUpdatePort = (idx: number, patch: Partial<ServiceConfig['ports'][0]>) => {
    const next = [...ports];
    next[idx] = { ...next[idx], ...patch };
    onChange({ ports: next });
  };

  const handleRemovePort = (idx: number) => {
    onChange({ ports: ports.filter((_, i) => i !== idx) });
  };

  return (
    <SettingsSection
      title="Network"
      icon={<Network size={14} />}
      className="space-y-4"
      collapsible={collapsible}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <SettingsSection.Subtitle
            title="Port Mappings"
            action={
              <Button variant="quiet-outline" size="sm" onClick={handleAddPort}>
                <Plus size={14} /> Add Port
              </Button>
            }
          />

          <div className="overflow-hidden rounded-lg border border-border/40 bg-background/30">
            <div className="grid grid-cols-[minmax(5rem,1fr)_minmax(5rem,1fr)_5rem_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
              <div className="px-2.5 py-2">Host</div>
              <div className="border-l border-border/40 px-2.5 py-2">Container</div>
              <div className="border-l border-border/40 px-2.5 py-2">Protocol</div>
              <div />
            </div>

            {ports.length === 0 ? (
              <div className="space-y-3 px-3 py-6 text-sm text-muted-foreground">
                <div>No mapped ports defined.</div>
                {exposedPorts.length > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
                      Exposed by image: {exposedPorts.join(', ')}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleMapExposedPort(exposedPorts[0])}
                      className="h-6 px-2 text-[10px] font-bold uppercase tracking-wide"
                    >
                      Map
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {exposedPorts.length > 0 && (
                  <div className="flex items-center justify-between gap-3 border-b border-border/20 px-2.5 py-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/50">
                      Exposed by image: {exposedPorts.join(', ')}
                    </span>
                    {exposedPorts.some((port) => !ports.some((mapped) => mapped.container === port)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const unmapped = exposedPorts.find((port) => !ports.some((mapped) => mapped.container === port));
                          if (unmapped) handleMapExposedPort(unmapped);
                        }}
                        className="h-6 px-2 text-[10px] font-bold uppercase tracking-wide"
                      >
                        Map
                      </Button>
                    )}
                  </div>
                )}
                <div className="divide-y divide-border/20">
                  {ports.map((port, idx) => {
                    const conflicts = portConflicts[port.host] || [];
                    const hasConflict = conflicts.length > 0;

                    return (
                      <div
                        key={idx}
                        className={cn(
                          'group/port grid grid-cols-[minmax(5rem,1fr)_minmax(5rem,1fr)_5rem_2rem] items-center',
                          hasConflict && 'bg-destructive/5'
                        )}
                      >
                        <div className="relative">
                          <Input
                            type="number"
                            value={port.host}
                            ref={(input) => { hostPortInputsRef.current[port.host] = input; }}
                            onChange={(e) => handleUpdatePort(idx, { host: parseInt(e.target.value) || 0 })}
                            aria-invalid={hasConflict}
                            className={cn(
                              'h-8 rounded-none border-0 bg-transparent pr-7 font-mono text-xs focus-visible:ring-0',
                              hasConflict && 'text-destructive'
                            )}
                          />
                          {hasConflict && (
                            <span
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-destructive"
                              title={conflicts.join('\n')}
                              aria-label={conflicts.join(' ')}
                            >
                              <AlertTriangle size={12} />
                            </span>
                          )}
                        </div>
                        <Input
                          type="number"
                          value={port.container}
                          onChange={(e) => handleUpdatePort(idx, { container: parseInt(e.target.value) || 0 })}
                          className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                        />
                        <div className="border-l border-border/40 px-1.5">
                          <CustomSelect
                            variant="compact"
                            value={port.protocol || 'tcp'}
                            onChange={(value) => handleUpdatePort(idx, { protocol: value as 'tcp' | 'udp' })}
                            className="[&_[data-slot=select-trigger]]:border-transparent [&_[data-slot=select-trigger]]:bg-transparent [&_[data-slot=select-trigger]]:px-1.5 [&_[data-slot=select-trigger]]:shadow-none"
                            options={[
                              { value: 'tcp', label: 'tcp' },
                              { value: 'udp', label: 'udp' },
                            ]}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => handleRemovePort(idx)}
                          className="mx-auto opacity-0 group-hover/port:opacity-100"
                        >
                          <X size={12} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <SettingsSection.Subtitle
            title="Attached Networks"
            action={
              <Button variant="quiet-outline" size="sm" onClick={handleAddNetwork}>
                <Plus size={14} /> Attach Network
              </Button>
            }
          />

          <div className="flex flex-wrap gap-2">
            {draftNetworks?.map((net, idx) => (
              <div key={idx} className="group/net flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1.5">
                <SuggestInput
                  value={net}
                  onChange={(e) => handleUpdateNetwork(idx, e.target.value)}
                  onBlur={() => commitNetworks()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      commitNetworks();
                    }
                    if (event.key === 'Escape') {
                      setDraftNetworks(networks || []);
                    }
                  }}
                  onValueChange={(value) => {
                    const next = [...draftNetworks];
                    next[idx] = value;
                    setDraftNetworks(next);
                    commitNetworks(next);
                  }}
                  suggestions={networkSuggestions}
                  className="h-7 w-32 border-transparent bg-transparent px-1 font-mono text-xs focus-visible:ring-0"
                  placeholder="net_name"
                />
                <Button variant="ghost" size="icon-xs" onClick={() => handleRemoveNetwork(idx)}>
                  <Trash2 size={12} />
                </Button>
              </div>
            ))}
            {(!draftNetworks || draftNetworks.length === 0) && (
              <div className="flex items-center gap-2 px-1 py-1.5 text-xs text-muted-foreground">
                <ShieldCheck size={12} className="text-primary" /> Default Bridge Network
              </div>
            )}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
