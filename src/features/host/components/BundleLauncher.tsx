import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Layers,
  Shield,
  Cloud,
  Monitor,
  Mail,
  Sparkles,
  ChevronRight,
  ArrowRight,
  AlertCircle,
  Server,
  Plus,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCatalog } from '@/lib/catalog';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStore } from '@/lib/store/useHostStore';
import { composeRepository } from '@/lib/storage/ComposeRepository';
import { BundleSpec, BundleImportConflict, BundleResolutionMap, ComposeData } from '@/types';
import { findBundleConflicts, findStackConflicts, getAllUsedPorts, getNextFreePort, uniqueComposeName } from '@/lib/core/bundle-utils';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isServerMode } from '@/lib/storage/driver';

interface BundleLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'new-compose' | 'import';
  hostId?: string;
}

type SourceMode = 'bundles' | 'stacks';
type Step = 'picker' | 'conflicts';

export function BundleLauncher({ open, onOpenChange, mode, hostId }: BundleLauncherProps) {
  const navigate = useNavigate();
  const { hostId: routeHostId } = useParams<{ hostId: string }>();
  const { allBundles, uploadServerBundle, removeServerBundle } = useCatalog();
  const { config, applyBundle, resetStack, saveCompose, updateStackConfig } = useComposeStore();
  const { settings, createCompose, hosts } = useHostStore();

  const [sourceMode, setSourceMode] = useState<SourceMode>('bundles');
  const [step, setStep] = useState<Step>('picker');

  // Bundle state
  const [selectedBundle, setSelectedBundle] = useState<BundleSpec | null>(null);

  // Stack state
  const [, setSelectedStackRef] = useState<{ hostId: string; composeId: string; name: string } | null>(null);
  const [stackData, setStackData] = useState<ComposeData | null>(null);
  const [allStacksData, setAllStacksData] = useState<Record<string, Record<string, ComposeData>>>({});
  const [stacksLoading, setStacksLoading] = useState(false);

  // Conflict state (shared)
  const [conflicts, setConflicts] = useState<BundleImportConflict[]>([]);
  const [resolutions, setResolutions] = useState<BundleResolutionMap>({ services: {}, ports: {}, volumes: {}, networks: {} });
  const [bundleUploadOpen, setBundleUploadOpen] = useState(false);

  // Load all stacks data when switching to stacks tab
  useEffect(() => {
    if (!open || sourceMode !== 'stacks') return;
    setStacksLoading(true);

    async function load() {
      const result: Record<string, Record<string, ComposeData>> = {};
      await Promise.all(
        hosts.map(async (host) => {
          const ids = host.stacks.map((s) => s.id);
          result[host.id] = await composeRepository.getAllForHost(host.id, ids);
        })
      );
      setAllStacksData(result);
      setStacksLoading(false);
    }

    load();
  }, [open, sourceMode, hosts]);

  const resolvedComposeName = (targetHostId: string, baseName: string): string => {
    const host = hosts.find((h) => h.id === targetHostId);
    return uniqueComposeName(host?.stacks.map((s) => s.name) ?? [], baseName);
  };

  const buildInitialResolutions = (detected: BundleImportConflict[]): BundleResolutionMap => {
    const initial: BundleResolutionMap = { services: {}, ports: {}, volumes: {}, networks: {} };
    const usedPorts = getAllUsedPorts(config, settings);
    detected.forEach((c) => {
      if (c.type === 'service') {
        initial.services[c.key] = 'rename';
      } else if (c.type === 'port') {
        const port = c.incomingValue as number;
        initial.ports[port] = getNextFreePort(port + 1, usedPorts);
        usedPorts.add(initial.ports[port]);
      }
    });
    return initial;
  };

  // ── Bundle handlers ──────────────────────────────────────────────────────

  const handleSelectBundle = async (bundle: BundleSpec) => {
    setSelectedBundle(bundle);
    if (mode === 'import') {
      const detected = await findBundleConflicts(config, bundle, settings);
      if (detected.length > 0) {
        setConflicts(detected);
        setResolutions(buildInitialResolutions(detected));
        setStep('conflicts');
      } else {
        await applyBundle(bundle);
        onOpenChange(false);
      }
    } else {
      const targetHostId = hostId || routeHostId;
      if (!targetHostId) return;
      const composeId = await createCompose(targetHostId, resolvedComposeName(targetHostId, bundle.name));
      resetStack();
      await applyBundle(bundle);
      await saveCompose(targetHostId, composeId);
      navigate(`/hosts/${targetHostId}/${composeId}`);
      onOpenChange(false);
    }
  };

  const handleApplyBundleImport = async () => {
    if (!selectedBundle) return;
    await applyBundle(selectedBundle, resolutions);
    onOpenChange(false);
  };

  // ── Stack handlers ───────────────────────────────────────────────────────

  const handleSelectStack = async (srcHostId: string, composeId: string, stackName: string) => {
    const data = await composeRepository.get(srcHostId, composeId);
    if (!data) return;

    setSelectedStackRef({ hostId: srcHostId, composeId, name: stackName });
    setStackData(data);

    if (mode === 'import') {
      const detected = await findStackConflicts(config, data, settings);
      if (detected.length > 0) {
        setConflicts(detected);
        setResolutions(buildInitialResolutions(detected));
        setStep('conflicts');
      } else {
        mergeStack(data, { services: {}, ports: {}, volumes: {}, networks: {} });
        onOpenChange(false);
      }
    } else {
      const targetHostId = hostId || routeHostId;
      if (!targetHostId) return;
      const name = stackName;
      const newComposeId = await createCompose(targetHostId, resolvedComposeName(targetHostId, name));
      await composeRepository.save(targetHostId, newComposeId, data);
      navigate(`/hosts/${targetHostId}/${newComposeId}`);
      onOpenChange(false);
    }
  };

  const mergeStack = (data: ComposeData, res: BundleResolutionMap) => {
    const merged = { ...config.services };
    Object.entries(data.services)
      .filter(([, svc]) => svc.enabled)
      .forEach(([id, svc]) => {
        const svcResolution = res.services[id];
        if (svcResolution === 'skip') return;
        let targetId = id;
        if (svcResolution === 'rename') {
          let i = 2;
          while (merged[`${id}-${i}`]) i++;
          targetId = `${id}-${i}`;
        }
        const ports = svc.ports.map((p) => ({ ...p, host: res.ports[p.host] ?? p.host }));
        merged[targetId] = { ...svc, ports };
      });
    updateStackConfig({ services: merged });
  };

  const handleApplyStackImport = () => {
    if (!stackData) return;
    mergeStack(stackData, resolutions);
    onOpenChange(false);
  };

  const handleApplyConflicts = () => {
    if (stackData) {
      handleApplyStackImport();
    } else {
      handleApplyBundleImport();
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────

  const resetInternalState = () => {
    setSelectedBundle(null);
    setSelectedStackRef(null);
    setStackData(null);
    setStep('picker');
    setConflicts([]);
    setResolutions({ services: {}, ports: {}, volumes: {}, networks: {} });
    setBundleUploadOpen(false);
  };

  // ── Dialog title ─────────────────────────────────────────────────────────

  const dialogTitle = step === 'conflicts'
    ? 'Resolve Collisions'
    : mode === 'import' ? 'Add to Compose' : 'New Compose';

  const dialogDescription = step === 'conflicts'
    ? `Found ${conflicts.length} overlapping items between source and workspace.`
    : mode === 'import' ? 'Choose a bundle or existing stack to merge into the current compose.' : 'Choose a bundle or existing stack to create a new compose from.';

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetInternalState(); }}>
      <DialogContent className="!max-w-[84rem] min-w-[800px] max-h-[90vh] flex flex-col p-0 overflow-hidden border-border/40 bg-background/95 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6 pb-1">
          <DialogTitle className="text-2xl font-black tracking-tight">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground/60 mt-1">
            {dialogDescription}
          </DialogDescription>
          {step === 'picker' && (
            <div className="flex items-center gap-3 mt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSourceMode('bundles')}
                className={cn(
                  "h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest",
                  sourceMode === 'bundles' ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                <Sparkles size={11} /> Bundles
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSourceMode('stacks')}
                className={cn(
                  "h-8 gap-1.5 px-3 text-[10px] font-bold uppercase tracking-widest",
                  sourceMode === 'stacks' ? "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                <Server size={11} /> Stacks
              </Button>
              {isServerMode && sourceMode === 'bundles' && (
                <Button size="sm" className="h-8 gap-1.5 text-[10px] font-bold uppercase tracking-widest" onClick={() => setBundleUploadOpen(true)}>
                  <Plus size={11} /> Add custom bundle
                </Button>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="h-[500px] overflow-hidden">
          {step === 'picker' && sourceMode === 'bundles' && (
            <ScrollArea className="h-full">
              <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allBundles.map((bundle) => (
                  <BundlePickerCard
                    key={bundle.id}
                    bundle={bundle}
                    onSelect={() => handleSelectBundle(bundle)}
                    onDelete={isServerMode && bundle.source === 'user' ? () => removeServerBundle(bundle.id) : undefined}
                  />
                ))}
              </div>
            </ScrollArea>
          )}

          {step === 'picker' && sourceMode === 'stacks' && (
            <ScrollArea className="h-full">
              <div className="px-6 pb-6 space-y-8">
                {stacksLoading && (
                  <p className="text-xs text-muted-foreground/40 text-center py-12">Loading stacks…</p>
                )}
                {!stacksLoading && hosts.every((h) => h.stacks.length === 0) && (
                  <p className="text-xs text-muted-foreground/40 text-center py-12">No stacks found.</p>
                )}
                {!stacksLoading && hosts.map((host) => {
                  if (host.stacks.length === 0) return null;
                  return (
                    <div key={host.id}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3 flex items-center gap-2">
                        <Server size={10} /> {host.name}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {host.stacks.map((stack) => {
                          const data = allStacksData[host.id]?.[stack.id];
                          const serviceIds = data ? Object.keys(data.services).filter((id) => data.services[id].enabled) : [];
                          return (
                            <StackPickerCard
                              key={stack.id}
                              stackName={stack.name}
                              stackDescription={stack.description}
                              serviceIds={serviceIds}
                              onSelect={() => handleSelectStack(host.id, stack.id, stack.name)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {step === 'conflicts' && (
            <ScrollArea className="h-full">
              <div className="p-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
                {conflicts.map((conflict, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3 h-fit">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          conflict.type === 'service' ? "bg-primary/10 text-primary" : "bg-orange-500/10 text-orange-500"
                        )}>
                          {conflict.type === 'service' ? <Layers size={14} /> : <AlertCircle size={14} />}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{conflict.type} Conflict</p>
                          <p className="text-xs font-bold">{conflict.key}</p>
                        </div>
                      </div>
                    </div>

                    {conflict.type === 'service' && (
                      <div className="flex gap-2">
                        {(['skip', 'replace', 'rename'] as const).map((opt) => (
                          <Button
                            key={opt}
                            variant={resolutions.services[conflict.key] === opt ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1 h-8 text-[10px] font-bold uppercase"
                            onClick={() => setResolutions((prev) => ({ ...prev, services: { ...prev.services, [conflict.key]: opt } }))}
                          >
                            {opt}
                          </Button>
                        ))}
                      </div>
                    )}

                    {conflict.type === 'port' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                          <span>Requested: {String(conflict.incomingValue)}</span>
                          <ArrowRight size={12} />
                          <span className="text-primary">Assign to:</span>
                        </div>
                        <Input
                          type="number"
                          className="h-9 bg-background/50 font-mono text-xs"
                          value={resolutions.ports[conflict.incomingValue as number] || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val)) {
                              setResolutions((prev) => ({ ...prev, ports: { ...prev.ports, [conflict.incomingValue as number]: val } }));
                            }
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {step === 'conflicts' && (
          <DialogFooter className="p-6 border-t border-border/50 bg-muted/5">
            <Button className="px-8 font-black text-xs uppercase tracking-widest" onClick={handleApplyConflicts}>
              Resolve & Apply
            </Button>
          </DialogFooter>
        )}
        {isServerMode && (
          <BundleUploadDialog
            open={bundleUploadOpen}
            onOpenChange={setBundleUploadOpen}
            onUpload={uploadServerBundle}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function BundlePickerCard({ bundle, onSelect, onDelete }: { bundle: BundleSpec; onSelect: () => void; onDelete?: () => Promise<void> | void }) {
  const [deleting, setDeleting] = useState(false);
  const getIcon = (id: string) => {
    if (id.includes('password')) return <Shield size={18} />;
    if (id.includes('cloud')) return <Cloud size={18} />;
    if (id.includes('media')) return <Monitor size={18} />;
    if (id.includes('chat')) return <Mail size={18} />;
    return <Sparkles size={18} />;
  };

  const handleDelete = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      onClick={onSelect}
      className="group p-5 rounded-2xl border border-border/60 bg-card/40 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/10">
          {getIcon(bundle.id)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className="font-extrabold tracking-tight group-hover:text-primary transition-colors leading-tight">{bundle.name}</h3>
            <div className="flex shrink-0 items-center gap-1">
              <span className={cn(
                "text-[8px] uppercase tracking-widest px-1.5 rounded",
                bundle.difficulty === 'easy' ? "text-green-500/80 bg-green-500/10" :
                  bundle.difficulty === 'moderate' ? "text-amber-500/80 bg-amber-500/10" :
                    "text-destructive/80 bg-destructive/10"
              )}>
                {bundle.difficulty}
              </span>
              {onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground/40 hover:text-destructive"
                  disabled={deleting}
                  onClick={handleDelete}
                >
                  <Trash2 size={12} />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{bundle.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {bundle.mainServices.map((s) => (
          <span key={s} className="px-2 py-0.5 rounded-md bg-muted/60 text-[9px] uppercase tracking-wide text-muted-foreground/60">{s}</span>
        ))}
      </div>
      <div className="absolute bottom-4 right-5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
        <ChevronRight className="text-primary" size={20} />
      </div>
    </div>
  );
}

function BundleUploadDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (id: string, bundle: File) => Promise<void>;
}) {
  const [bundleId, setBundleId] = useState('');
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setBundleId('');
    setBundleFile(null);
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(bundleId)) {
      setError('Use kebab-case for the bundle ID.');
      return;
    }
    if (!bundleFile) {
      setError('bundle.json is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onUpload(bundleId, bundleFile);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) reset(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Bundle</DialogTitle>
          <DialogDescription>Upload a bundle file into the self-host catalog.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="custom-bundle-id">Bundle ID</Label>
            <Input id="custom-bundle-id" value={bundleId} onChange={(event) => setBundleId(event.target.value)} placeholder="my-bundle" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-bundle-file">bundle.json</Label>
            <Input id="custom-bundle-file" type="file" accept="application/json,.json" onChange={(event) => setBundleFile(event.target.files?.[0] ?? null)} />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Uploading...' : 'Upload'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StackPickerCard({
  stackName,
  stackDescription,
  serviceIds,
  onSelect,
}: {
  stackName: string;
  stackDescription?: string;
  serviceIds: string[];
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className="group p-5 rounded-2xl border border-border/60 bg-card/40 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer relative overflow-hidden"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/10">
          <Layers size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <h3 className="font-extrabold tracking-tight group-hover:text-primary transition-colors leading-tight">{stackName}</h3>
            <span className="text-[8px] uppercase tracking-widest px-1.5 rounded text-muted-foreground/50 bg-muted/40 shrink-0">
              {serviceIds.length} services
            </span>
          </div>
          {stackDescription && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">{stackDescription}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {serviceIds.map((id) => (
          <span key={id} className="px-2 py-0.5 rounded-md bg-muted/60 text-[9px] uppercase tracking-wide text-muted-foreground/60">{id}</span>
        ))}
      </div>
      <div className="absolute bottom-4 right-5 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
        <ChevronRight className="text-primary" size={20} />
      </div>
    </div>
  );
}
