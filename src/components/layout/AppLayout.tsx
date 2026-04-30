import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Globe, Pencil, Trash2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { CatalogEntry, ServiceConfig } from '@/types';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStore } from '@/lib/store/useHostStore';
import { useCatalog } from '@/lib/catalog';
import { validateStack } from '@/lib/core/rules';
import { ComposeList } from '@/components/layout/ComposeList';
import { ServiceList } from '@/features/builder/components/ServiceList';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AppLayoutProps {
  children: ReactNode;
}

function parseRoute(pathname: string) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'hosts') {
    return { activeView: 'hosts' as const, hostId: null as string | null, composeId: null as string | null };
  }
  if (!parts[1]) {
    return { activeView: 'hosts' as const, hostId: null as string | null, composeId: null as string | null };
  }
  if (!parts[2]) {
    return { activeView: 'host' as const, hostId: parts[1], composeId: null as string | null };
  }
  return { activeView: 'builder' as const, hostId: parts[1], composeId: parts[2] };
}

const ISSUES_URL = 'https://github.com/aicrafted/compote/issues';

export function AppLayout({ children }: AppLayoutProps) {
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [composeSwitcherOpen, setComposeSwitcherOpen] = useState(false);
  const [renamingComposeId, setRenamingComposeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [composeToDelete, setComposeToDelete] = useState<{ id: string; name: string } | null>(null);
  const [serviceToRemove, setServiceToRemove] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeView, hostId, composeId } = useMemo(() => parseRoute(location.pathname), [location.pathname]);

  const {
    config,
    activeInstanceId,
    setActiveInstance,
    removeService,
    isDirty,
  } = useComposeStore();
  const { syncPreview, hosts, settings, updateComposeName, deleteCompose } = useHostStore();
  const { entries } = useCatalog();

  const entryById = useMemo(() => {
    const map: Record<string, CatalogEntry> = {};
    entries.forEach((e) => { map[e.id] = e; });
    return map;
  }, [entries]);

  const activeHost = hosts.find((i) => i.id === hostId);
  const activeCompose = activeHost?.stacks.find((s) => s.id === composeId);
  const otherComposes = activeHost?.stacks.filter((compose) => compose.id !== composeId) || [];
  const renamingCompose = activeHost?.stacks.find((compose) => compose.id === renamingComposeId) || null;
  const activeService = activeInstanceId ? config.services[activeInstanceId] : null;
  const activeServiceName = activeService
    ? entryById[activeService.serviceId]?.name || activeInstanceId
    : null;
  const activeServices = Object.entries(config.services) as [string, ServiceConfig][];
  const validation = useMemo(() => validateStack(config, settings), [config, settings]);

  const navigateTo = (view: 'hosts' | 'host') => {
    if (view === 'hosts') {
      navigate('/hosts');
      return;
    }
    if (activeHost) {
      navigate(`/hosts/${activeHost.id}`);
      return;
    }
    navigate('/hosts');
  };

  const handleSidebarComposeSwitch = (nextComposeId: string) => {
    if (!activeHost) return;
    setActiveInstance(null);
    navigate(`/hosts/${activeHost.id}/${nextComposeId}`);
  };

  const handleSidebarServiceSwitch = (nextComposeId: string, instanceId: string) => {
    if (!activeHost) return;
    setActiveInstance(instanceId);
    navigate(`/hosts/${activeHost.id}/${nextComposeId}`);
  };

  const submitSwitcherRename = () => {
    if (!activeHost || !renamingCompose) return;
    const nextName = renameValue.trim();
    if (nextName && nextName !== renamingCompose.name) {
      updateComposeName(activeHost.id, renamingCompose.id, nextName);
    }
    setRenamingComposeId(null);
    setRenameValue('');
  };

  const confirmSwitcherDelete = async () => {
    if (!activeHost || !composeToDelete) return;
    const isCurrentCompose = composeToDelete.id === composeId;
    await deleteCompose(activeHost.id, composeToDelete.id);
    setComposeToDelete(null);
    setComposeSwitcherOpen(false);
    if (isCurrentCompose) {
      const remaining = activeHost.stacks.filter((s) => s.id !== composeToDelete.id);
      if (remaining.length > 0) {
        navigate(`/hosts/${activeHost.id}/${remaining[0].id}`);
      } else {
        navigate(`/hosts/${activeHost.id}`);
      }
    }
  };

  const confirmServiceRemove = () => {
    if (!serviceToRemove) return;
    removeService(serviceToRemove);
    if (activeInstanceId === serviceToRemove) setActiveInstance(null);
    setServiceToRemove(null);
  };

  useEffect(() => {
    if (activeHost?.id) {
      syncPreview(activeHost.id, Object.keys(config.services));
    }
  }, [config.services, activeHost?.id, syncPreview]);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden selection:bg-primary/30 font-sans">
      <header className="h-14 border-b border-border/60 bg-card/50 flex items-center justify-between px-0 z-50 shrink-0">
        <div className="flex items-center h-full">
          <div className="w-80 flex items-center px-6 h-full">
            <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigateTo('hosts')}>
              <div className="w-8 h-8 flex items-center justify-center transition-transform group-hover:scale-110">
                <img src="/logo.png" className="w-full h-full object-contain" alt="CompoTe - Docker Compose Templater" />
              </div>
              <span className="tracking-tighter font-black text-muted-foreground text-xl">CompoTe</span>
            </div>
          </div>

          <div className="hidden md:flex items-center h-full px-6">
            <nav className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 select-none">
              <span
                className={cn('hover:text-primary transition-colors cursor-pointer', activeView === 'hosts' && 'text-primary/100')}
                onClick={() => navigateTo('hosts')}
              >
                Hosts
              </span>

              {activeHost && activeView !== 'hosts' && (
                <>
                  <span className="opacity-30">/</span>
                  <span
                    className={cn('hover:text-primary transition-colors cursor-pointer', activeView === 'host' && 'text-primary/80')}
                    onClick={() => navigateTo('host')}
                  >
                    {activeHost.name}
                  </span>
                </>
              )}

              {activeView === 'builder' && activeCompose && (
                <>
                  <span className="opacity-30">/</span>
                  <span
                    className={cn(
                      'uppercase tracking-[0.2em]',
                      activeService
                        ? 'cursor-pointer text-muted-foreground/60 transition-colors hover:text-primary'
                        : 'text-muted-foreground/80'
                    )}
                    onClick={() => {
                      if (activeService) setActiveInstance(null);
                    }}
                  >
                    {activeCompose.name}
                  </span>
                  {activeServiceName && (
                    <>
                      <span className="opacity-30">/</span>
                      <span className="text-foreground uppercase tracking-[0.2em]">{activeServiceName}</span>
                    </>
                  )}
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside
          className={cn(
            'w-80 border-r border-border/50 bg-card/10 flex flex-col shrink-0 z-40 transition-all duration-300 overflow-hidden',
            activeView === 'hosts' && 'w-0 border-r-0 opacity-0 pointer-events-none'
          )}
        >
          {/* Fixed top: nav + compose list */}
          <div className="shrink-0 p-4 space-y-2">
            {activeHost && activeView === 'builder' && (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-w-0 flex-1 justify-start gap-2 h-9 text-sm font-bold uppercase tracking-wide text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all"
                    onClick={() => navigateTo('host')}
                  >
                    <span className="truncate">{activeHost.name}</span>
                  </Button>
                  {otherComposes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-primary hover:bg-primary/5"
                      onClick={() => setComposeSwitcherOpen((open) => !open)}
                    >
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', !composeSwitcherOpen && '-rotate-90')}
                      />
                    </Button>
                  )}
                </div>

                {composeSwitcherOpen && otherComposes.length > 0 && (
                  <div className="space-y-1 border-b border-border/40 pb-1 pl-2 pr-1">
                    {otherComposes.map((compose) => (
                      <div
                        key={compose.id}
                        className="group/compose-switch flex h-8 cursor-pointer items-center justify-between rounded-md px-3 text-sm font-normal text-secondary/70 transition-colors hover:bg-secondary/5 hover:text-secondary"
                        onClick={() => handleSidebarComposeSwitch(compose.id)}
                      >
                        <span className="truncate">{compose.name}</span>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/compose-switch:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/40 hover:bg-primary/10 hover:text-primary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setRenamingComposeId(compose.id);
                              setRenameValue(compose.name);
                            }}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              setComposeToDelete({ id: compose.id, name: compose.name });
                            }}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeHost && (
              <ComposeList
                host={activeHost}
                activeComposeId={composeId}
                activeView={activeView}
                onSwitch={handleSidebarComposeSwitch}
                onSelectService={handleSidebarServiceSwitch}
              />
            )}

            {!activeHost && (
              <div className="py-12 text-center px-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary/40 mx-auto mb-4">
                  <Globe size={24} />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Select Host</p>
              </div>
            )}
          </div>

          {/* Scrollable service instances */}
          {activeHost && activeView === 'builder' && (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="px-4 pb-4">
                  <ServiceList
                    services={activeServices}
                    entryById={entryById}
                    validationResults={validation.results}
                    activeInstanceId={activeInstanceId}
                    onSelect={setActiveInstance}
                    onRemove={setServiceToRemove}
                  />
                </div>
              </ScrollArea>
            </div>
          )}
        </aside>

        <main className="flex-1 min-w-0 bg-background overflow-hidden flex flex-col">{children}</main>
      </div>

      <footer className="h-8 border-t border-border/60 bg-card/80 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <CheckCircle2 size={12} className={isDirty ? 'text-secondary/80' : 'text-primary/70'} />
          <span>{isDirty ? 'Unsaved Changes' : 'All Saved'}</span>
        </div>

        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50">
          <img src="/aicrafted.png" className="h-3 w-3 object-contain opacity-60" alt="" />
          <span className="font-medium">2026 AICrafted</span>
          <span className="opacity-30">·</span>
          <a
            href={ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            Bugreport / feature request
          </a>
          <span className="opacity-30">·</span>
          <Button
            variant="ghost"
            onClick={() => setPrivacyOpen(true)}
            className="h-auto p-0 text-[10px] text-muted-foreground/50 font-normal hover:text-muted-foreground hover:bg-transparent"
          >
            Privacy policy
          </Button>
        </div>
      </footer>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Privacy Policy</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Compote is a fully <strong className="text-foreground">serverless, client-side application</strong>.
              It runs entirely in your browser — no backend, no cloud, no accounts.
            </p>
            <p>
              All data — hosts, compose configurations, service settings — is stored
              exclusively in your browser's local storage (IndexedDB).
              Nothing is ever transmitted to any external server.
            </p>
            <p>
              We use <strong className="text-foreground">Google Analytics</strong> to measure
              aggregate visit traffic (page views, session counts). No personally identifiable
              information is collected or shared.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!renamingComposeId} onOpenChange={(open) => !open && setRenamingComposeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename compose</AlertDialogTitle>
            <AlertDialogDescription>Set a new name for this compose project.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitSwitcherRename}>Save</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!serviceToRemove} onOpenChange={(open) => !open && setServiceToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove service?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-bold text-foreground">{serviceToRemove}</span> will be removed from this compose project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmServiceRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!composeToDelete} onOpenChange={(open) => !open && setComposeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete compose?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-bold text-foreground">{composeToDelete?.name}</span> and all its services will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmSwitcherDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
