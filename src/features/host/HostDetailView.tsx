import { useHostStore } from '@/lib/store/useHostStore';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Copy,
  Check,
  Plus,
  Layers,
  Download,
  Network,
  Database,
  Server,
  Pencil,
  Trash2,
  CopyPlus,
  ChevronDown,
  ChevronRight,
  Import,
} from 'lucide-react';
import { useState, useEffect, useCallback, Fragment } from 'react';
import { BundleLauncher } from './components/BundleLauncher';
import { HostResourceList } from './components/HostResourceList';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { ComposeData, ServiceSpec } from '@/types';
import { downloadHostZip } from '@/lib/core/exporter';
import { uniqueComposeName } from '@/lib/core/bundle-utils';
import { renameResourceReferences } from '@/lib/core/compose-resources';
import { composeRepository } from '@/lib/storage/ComposeRepository';
import {
  getAggregatePorts,
  getDiscoveredExternalNetworks,
  getDiscoveredExternalVolumes,
} from './host-summary';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CustomSelect } from '@/components/ui/custom-select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const EMPTY_STACK: ComposeData = { services: {}, networks: {}, volumes: {} };

export function HostDetailView() {
  const { settings, updateSettings, hosts, updateHostName, createCompose, deleteCompose, updateComposeName } = useHostStore();
  const navigate = useNavigate();
  const { hostId } = useParams<{ hostId: string }>();
  const [copied, setCopied] = useState(false);
  const [rawText, setRawText] = useState('');
  const [isBundleLauncherOpen, setIsBundleLauncherOpen] = useState(false);
  const [stackData, setStackData] = useState<Record<string, ComposeData>>({});
  const [serviceSpecs, setServiceSpecs] = useState<Record<string, ServiceSpec>>({});
  const [loadingStacks, setLoadingStacks] = useState(false);
  const [collapsedStacks, setCollapsedStacks] = useState<Record<string, boolean>>({});
  const [renamingStack, setRenamingStack] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deletingStack, setDeletingStack] = useState<{ id: string; name: string } | null>(null);
  const [newComposeOpen, setNewComposeOpen] = useState(false);
  const [newComposeName, setNewComposeName] = useState('');
  const [pendingResourceRename, setPendingResourceRename] = useState<{ kind: 'network' | 'volume'; oldName: string; newName: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [portsText, setPortsText] = useState(() => settings.occupiedPorts.join(' '));

  const activeHost = hosts.find((p) => p.id === hostId);

  useEffect(() => {
    setPortsText(settings.occupiedPorts.join(' '));
  }, [settings.occupiedPorts]);

  const savePortsText = () => {
    const ports = Array.from(new Set(
      (portsText.match(/\b\d{2,5}\b/g) ?? []).map(Number).filter((p) => p > 0 && p < 65535)
    )).sort((a, b) => a - b);
    updateSettings({ occupiedPorts: ports });
  };

  const loadHostStacks = useCallback(async () => {
    if (!activeHost) { setStackData({}); return; }
    setLoadingStacks(true);
    const loaded: Record<string, ComposeData> = {};
    try {
      await Promise.all(
        activeHost.stacks.map(async (stack) => {
          const data = await composeRepository.get(activeHost.id, stack.id);
          loaded[stack.id] = data || EMPTY_STACK;
        })
      );
      setStackData(loaded);
      const serviceIds = Array.from(new Set(
        Object.values(loaded).flatMap((s) => Object.values(s.services).map((svc) => svc.serviceId))
      ));
      const loadedSpecs = await Promise.all(
        serviceIds.map(async (id) => [id, await CatalogRegistry.getService(id, 'builtin')] as const)
      );
      setServiceSpecs(loadedSpecs.reduce<Record<string, ServiceSpec>>((acc, [id, spec]) => {
        if (spec) acc[id] = spec;
        return acc;
      }, {}));
    } catch (error) {
      console.error('Failed to load compose projects:', error);
    } finally {
      setLoadingStacks(false);
    }
  }, [activeHost]);

  useEffect(() => { loadHostStacks(); }, [loadHostStacks]);

  const duplicateStack = async (stack: { id: string; name: string; data: ComposeData }) => {
    if (!activeHost) return;
    const name = uniqueComposeName(activeHost.stacks.map((s) => s.name), stack.name);
    const newId = crypto.randomUUID();
    await composeRepository.save(activeHost.id, newId, stack.data);
    await createCompose(activeHost.id, name, newId);
    setStackData((prev) => ({ ...prev, [newId]: stack.data }));
  };

  const confirmRename = () => {
    if (!renamingStack) return;
    const next = renameValue.trim();
    if (next && next !== renamingStack.name) updateComposeName(activeHost!.id, renamingStack.id, next);
    setRenamingStack(null);
  };

  const confirmDelete = async () => {
    if (!deletingStack || !activeHost) return;
    await deleteCompose(activeHost.id, deletingStack.id);
    setDeletingStack(null);
  };

  const stackRecords = (activeHost?.stacks || []).map((stack) => ({
    ...stack,
    data: stackData[stack.id] || EMPTY_STACK,
  }));

  const stackConfigs = stackRecords.map(({ data }) => data);
  const aggregatePorts = getAggregatePorts(stackConfigs);
  const discoveredExternalNetworks = getDiscoveredExternalNetworks(stackConfigs);
  const discoveredExternalVolumes = getDiscoveredExternalVolumes(stackConfigs);

  const handleOpenBuilder = async (hostId: string, composeId: string) => {
    navigate(`/hosts/${hostId}/${composeId}`);
  };

  const handleDownloadHost = async () => {
    if (!activeHost) return;

    await downloadHostZip(
      activeHost.name,
      activeHost.stacks.map((stack) => ({
        name: stack.name,
        data: stackData[stack.id] || EMPTY_STACK,
      })),
      settings
    );
  };

  const scanCommand = settings.os === 'windows'
    ? 'netstat -ano | findstr LISTENING'
    : 'sudo lsof -i -P -n | grep LISTEN';

  const copyCommand = () => {
    navigator.clipboard.writeText(scanCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const applyPorts = () => {
    const windowsPorts = [...rawText.matchAll(/TCP\s+\S+:(\d+)\s+\S+\s+LISTENING/gi)].map((m) => parseInt(m[1]));
    const lsofPorts = [...rawText.matchAll(/:(\d+)\s+\(LISTEN\)/g)].map((m) => parseInt(m[1]));
    const detectedPorts = [...windowsPorts, ...lsofPorts];
    const manualPorts = detectedPorts.length === 0
      ? (rawText.match(/\b\d{2,5}\b/g)?.map((p) => parseInt(p)) || [])
      : [];

    const combined = Array.from(new Set([...settings.occupiedPorts, ...detectedPorts, ...manualPorts]))
      .filter((p) => !isNaN(p) && p > 0 && p < 65535)
      .sort((a, b) => a - b);

    updateSettings({ occupiedPorts: combined });
    setRawText('');
    setImportOpen(false);
  };

  const updateStringList = (key: 'externalNetworks' | 'externalVolumes', values: string[]) => {
    updateSettings({ [key]: values.map((value) => value.trim()).filter(Boolean) });
  };

  const handleRenameDeclaredResource = async (kind: 'network' | 'volume', oldName: string, newName: string) => {
    if (!activeHost || !oldName || !newName || oldName === newName) return;
    setPendingResourceRename({ kind, oldName, newName });
  };

  const confirmRenameDeclaredResource = async () => {
    if (!activeHost || !pendingResourceRename) return;
    const { kind, oldName, newName } = pendingResourceRename;

    const nextStackData: Record<string, ComposeData> = { ...stackData };
    await Promise.all(
      activeHost.stacks.map(async (stack) => {
        const current = nextStackData[stack.id] || (await composeRepository.get(activeHost.id, stack.id)) || EMPTY_STACK;
        const next = renameResourceReferences(current, kind, oldName, newName);
        nextStackData[stack.id] = next;
        await composeRepository.save(activeHost.id, stack.id, next);
      })
    );
    setStackData(nextStackData);
    setPendingResourceRename(null);
  };

  const submitNewCompose = async () => {
    const baseName = newComposeName.trim();
    if (!hostId || !baseName) return;
    const name = uniqueComposeName(activeHost?.stacks.map((s) => s.name) ?? [], baseName);
    const composeId = await createCompose(hostId, name);
    navigate(`/hosts/${hostId}/${composeId}`);
    setNewComposeName('');
    setNewComposeOpen(false);
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto thin-scrollbar bg-background/30">
        <div className="border-b border-border/50 bg-background shrink-0 sticky top-0 z-30">
          <div className="py-4 px-6 flex items-center justify-between animate-in fade-in duration-500">
            <div className="flex items-center gap-6">
              <div className="w-9 h-9 flex items-center justify-center shrink-0">
                <Server size={20} className="text-primary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold tracking-tight text-foreground">{activeHost?.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">Host settings</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setNewComposeOpen(true)}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest border-border/60 hover:bg-muted/50 transition-all font-sans"
              >
                <Plus size={14} className="mr-2" /> New Compose
              </Button>
              <Button
                onClick={() => setIsBundleLauncherOpen(true)}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg shadow-secondary/20 transition-all font-sans"
              >
                <Layers size={14} className="mr-2" /> New from Bundle
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadHost}
                className="h-10 px-4 text-[10px] font-black uppercase tracking-widest border-border/60 hover:bg-muted/50 transition-all font-sans"
              >
                <Download size={14} className="mr-2" /> Download
              </Button>
            </div>
          </div>
        </div>
        <div className="p-8 max-w-5xl space-y-10 animate-in fade-in duration-500">

          {/* Identity */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-medium tracking-wide text-muted-foreground/60 block ml-1">Host Label</label>
                <Input
                  value={activeHost?.name || ''}
                  onChange={(e) => hostId && updateHostName(hostId, e.target.value)}
                />
              </div>
              <CustomSelect
                label="Host OS"
                value={settings.os}
                onChange={(val) => updateSettings({ os: val as any })}
                options={[
                  { value: 'linux', label: 'Linux' },
                  { value: 'windows', label: 'Windows' },
                  { value: 'macos', label: 'macOS' },
                ]}
              />
              <CustomSelect
                label="Architecture"
                value={settings.arch}
                onChange={(val) => updateSettings({ arch: val as any })}
                options={[
                  { value: 'x64', label: 'x64' },
                  { value: 'arm64', label: 'arm64' },
                ]}
              />
              <CustomSelect
                label="Service Restart Mode"
                value={settings.serviceRestartMode}
                onChange={(val) => updateSettings({ serviceRestartMode: val as any })}
                options={[
                  { value: 'no', label: 'no' },
                  { value: 'always', label: 'always' },
                  { value: 'unless-stopped', label: 'unless-stopped' },
                  { value: 'on-failure', label: 'on-failure' },
                ]}
              />
            </div>
          </section>

          {/* Occupied host ports */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span className="flex items-center text-primary"><Network size={14} /></span>
                Occupied host ports
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)} className="h-7 px-2.5 text-xs font-medium hover:bg-muted/50 gap-1.5 transition-all">
                <Import size={14} /> Scan and import
              </Button>
            </div>
            <div>
              <Textarea
                value={portsText}
                onChange={(e) => setPortsText(e.target.value)}
                onBlur={savePortsText}
                className="h-24 font-mono text-[11px] bg-background/30 border-border/50 resize-none thin-scrollbar"
                placeholder="80 443 5432"
              />
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/40">Discovered in compose projects</div>
              <div className="flex min-h-4 flex-wrap gap-2">
                {aggregatePorts.map((port) => (
                  <span key={port} className="rounded border border-border/40 bg-muted/20 px-1.5 py-px font-mono text-[11px] leading-4 text-muted-foreground">
                    {port}
                  </span>
                ))}
                {aggregatePorts.length === 0 && (
                  <span className="px-1 py-1 text-xs text-muted-foreground">No discovered ports.</span>
                )}
              </div>
            </div>
          </section>

          {/* Host Resources */}
          <section className="space-y-4">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <HostResourceList
                title="External Networks"
                icon={<Network size={14} />}
                values={settings.externalNetworks || []}
                placeholder="proxy"
                defaultPrefix="network"
                addLabel="Add network"
                discoveredValues={discoveredExternalNetworks}
                onChange={(values) => updateStringList('externalNetworks', values)}
                onRename={(oldName, newName) => handleRenameDeclaredResource('network', oldName, newName)}
              />
              <HostResourceList
                title="External Volumes"
                icon={<Database size={14} />}
                values={settings.externalVolumes || []}
                placeholder="postgres_data"
                defaultPrefix="volume"
                addLabel="Add volume"
                discoveredValues={discoveredExternalVolumes}
                onChange={(values) => updateStringList('externalVolumes', values)}
                onRename={(oldName, newName) => handleRenameDeclaredResource('volume', oldName, newName)}
              />
            </div>
          </section>

          {/* Compose Projects */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="flex items-center text-secondary"><Layers size={14} /></span>
              Compose projects
            </h3>
            <div className="rounded-lg border border-border/40 bg-background/30">
              <table className="w-full text-left text-xs">
                <tbody>
                  {stackRecords.map((stack, stackIdx) => {
                    const serviceEntries = Object.entries(stack.data.services);
                    const isCollapsed = collapsedStacks[stack.id] ?? false;
                    return (
                      <Fragment key={stack.id}>
                        <tr key={`${stack.id}-header`} className={stackIdx > 0 ? 'border-t border-border/40' : ''}>
                          <td colSpan={6} className="px-3 py-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors"
                              onClick={() => setCollapsedStacks((p) => ({ ...p, [stack.id]: !isCollapsed }))}
                            >
                              {isCollapsed ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
                              <Layers size={10} className="text-secondary/60" />
                              {stack.name}
                            </Button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-primary hover:bg-primary/10" onClick={() => { setRenamingStack({ id: stack.id, name: stack.name }); setRenameValue(stack.name); }} title="Rename"><Pencil size={11} /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-secondary hover:bg-secondary/10" onClick={() => duplicateStack(stack)} title="Duplicate"><CopyPlus size={11} /></Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10" onClick={() => setDeletingStack({ id: stack.id, name: stack.name })} title="Delete"><Trash2 size={11} /></Button>
                              <Button variant="ghost" size="sm" className="h-6 px-2 text-[9px] font-bold uppercase tracking-widest" onClick={() => activeHost && handleOpenBuilder(activeHost.id, stack.id)}>Open</Button>
                            </div>
                          </td>
                        </tr>
                        {!isCollapsed && (
                          <>
                            <tr key={`${stack.id}-subhead`} className="border-t border-border/20 bg-muted/10">
                              <th className="px-3 py-1 pl-8 text-[10px] font-medium text-muted-foreground/40 tracking-wide">Instance</th>
                              <th className="px-3 py-1 text-[10px] font-medium text-muted-foreground/40 tracking-wide">Service</th>
                              <th className="px-3 py-1 text-[10px] font-medium text-muted-foreground/40 tracking-wide">Image</th>
                              <th className="px-3 py-1 text-right text-[10px] font-medium text-muted-foreground/40 tracking-wide">Host port</th>
                              <th className="px-3 py-1 text-right text-[10px] font-medium text-muted-foreground/40 tracking-wide">Container port</th>
                              <th className="px-3 py-1 text-[10px] font-medium text-muted-foreground/40 tracking-wide">Networks</th>
                              <th />
                            </tr>
                            {serviceEntries.length === 0 ? (
                              <tr key={`${stack.id}-empty`} className="border-t border-border/20">
                                <td colSpan={7} className="px-3 py-2 pl-8 text-muted-foreground/30 italic">No services</td>
                              </tr>
                            ) : [...serviceEntries].sort(([a], [b]) => a.localeCompare(b)).map(([instanceId, svc]) => {
                              const spec = serviceSpecs[svc.serviceId];
                              const imageRef = svc.image || spec?.image || svc.serviceId;
                              const imageName = imageRef.split('/').pop()?.split(':')[0] || imageRef;
                              const imageTag = svc.imageTag || (imageRef.includes(':') ? imageRef.split(':').pop() : 'latest');
                              const portMappings = svc.ports || [];
                              const networks = svc.networks ?? [];
                              const isDisabled = svc.enabled === false;
                              return (
                                <tr key={`${stack.id}-${instanceId}`} className={`border-t border-border/20 hover:bg-muted/10 ${isDisabled ? 'opacity-40' : ''}`}>
                                  <td className="px-3 py-2 pl-8 font-mono text-muted-foreground/60">
                                    <span>{instanceId}</span>
                                    {isDisabled && <span className="ml-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 border border-border/40 rounded px-1 py-0.5">off</span>}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">{spec?.name || svc.serviceId}</td>
                                  <td className="px-3 py-2 font-mono text-muted-foreground/50 text-[11px]">{imageName}:{imageTag}</td>
                                  <td className="px-3 py-2 text-right font-mono text-muted-foreground/60">
                                    {portMappings.length > 0 && (
                                      <div className="space-y-0.5">
                                        {portMappings.map((port, index) => (
                                          <div key={`${port.host}-${port.container}-${port.protocol || 'tcp'}-${index}`}>{port.host || ''}</div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right font-mono text-muted-foreground/50">
                                    {portMappings.length > 0 && (
                                      <div className="space-y-0.5">
                                        {portMappings.map((port, index) => (
                                          <div key={`${port.container}-${port.host}-${port.protocol || 'tcp'}-${index}`}>{port.container || ''}</div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground/50">
                                    {networks.length > 0 && networks.join(', ')}
                                  </td>
                                  <td />
                                </tr>
                              );
                            })}
                          </>
                        )}
                      </Fragment>
                    );
                  })}
                  {loadingStacks && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">Loading...</td></tr>
                  )}
                  {!loadingStacks && stackRecords.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">No compose projects.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

        </div>
      </div>
      <BundleLauncher
        open={isBundleLauncherOpen}
        onOpenChange={setIsBundleLauncherOpen}
        mode="new-compose"
        hostId={hostId}
      />

      <AlertDialog open={newComposeOpen} onOpenChange={(open) => { setNewComposeOpen(open); if (!open) setNewComposeName(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create compose</AlertDialogTitle>
            <AlertDialogDescription>Give this compose project a short, recognizable name.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newComposeName}
            onChange={(event) => setNewComposeName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submitNewCompose()}
            placeholder="media-stack"
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!newComposeName.trim()} onClick={submitNewCompose}>Create</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingResourceRename} onOpenChange={(open) => !open && setPendingResourceRename(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update references?</AlertDialogTitle>
            <AlertDialogDescription>
              Rename <span className="font-bold text-foreground">{pendingResourceRename?.oldName}</span> to{' '}
              <span className="font-bold text-foreground">{pendingResourceRename?.newName}</span> in all compose projects on this host.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep references</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRenameDeclaredResource}>Update references</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) setRawText(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import occupied ports</AlertDialogTitle>
            <AlertDialogDescription>Run the scan command on your host, then paste the output below. Ports will be merged with existing.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium tracking-wide text-muted-foreground/60 ml-1">Scan Command</label>
              <Button variant="ghost" size="sm" onClick={copyCommand} className="h-6 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 gap-1 px-1.5 transition-all">
                {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <div className="p-2.5 bg-muted/20 border border-border/60 rounded-md font-mono text-[10px] text-muted-foreground/60 select-all overflow-x-auto whitespace-nowrap">
              {scanCommand}
            </div>
          </div>
          <Textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="h-40 bg-background/50 border-border/60 font-mono text-[11px] p-3 resize-none thin-scrollbar"
            placeholder="Paste terminal output here..."
            autoFocus
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={!rawText.trim()} onClick={applyPorts}>Parse & Apply</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!renamingStack} onOpenChange={(open) => !open && setRenamingStack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename compose</AlertDialogTitle>
            <AlertDialogDescription>Set a new name for this compose project.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && confirmRename()} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRename}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deletingStack} onOpenChange={(open) => !open && setDeletingStack(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete compose?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-bold text-foreground">{deletingStack?.name}</span> and all its services will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
