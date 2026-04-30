import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Layers, Pencil, Trash2 } from 'lucide-react';
import { HostMetadata, RuleResult, ServiceConfig } from '@/types';
import { cn } from '@/lib/utils';
import { useHostStore } from '@/lib/store/useHostStore';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStacksCache } from '@/lib/hooks/useHostStacksCache';
import { validateStack } from '@/lib/core/rules';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ComposeListProps {
  host: HostMetadata;
  activeComposeId: string | null;
  activeView: 'hosts' | 'host' | 'builder';
  onSwitch: (composeId: string) => void;
  onSelectService?: (composeId: string, instanceId: string) => void;
}

export function ComposeList({ host, activeComposeId, activeView, onSwitch, onSelectService }: ComposeListProps) {
  const navigate = useNavigate();
  const { settings, updateComposeName, deleteCompose, updateComposeValidation } = useHostStore();
  const activeServices = useComposeStore((s) => s.config.services);
  const activeInstanceId = useComposeStore((s) => s.activeInstanceId);
  const setActiveInstance = useComposeStore((s) => s.setActiveInstance);

  const hostStacksServices = useHostStacksCache(
    host,
    activeView === 'builder' ? activeComposeId : null,
    activeServices
  );

  const [renamingComposeId, setRenamingComposeId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [composeToDelete, setComposeToDelete] = useState<{ id: string; name: string } | null>(null);

  const renamingCompose = useMemo(
    () => host.stacks.find((s) => s.id === renamingComposeId) || null,
    [host.stacks, renamingComposeId]
  );

  const submitRename = () => {
    if (!renamingCompose) return;
    const nextName = renameValue.trim();
    if (nextName && nextName !== renamingCompose.name) {
      updateComposeName(host.id, renamingCompose.id, nextName);
    }
    setRenamingComposeId(null);
    setRenameValue('');
  };

  const confirmDelete = async () => {
    if (!composeToDelete) return;
    const isCurrentCompose = composeToDelete.id === activeComposeId;
    await deleteCompose(host.id, composeToDelete.id);
    setComposeToDelete(null);
    if (isCurrentCompose) {
      const remaining = host.stacks.filter((s) => s.id !== composeToDelete.id);
      if (remaining.length > 0) {
        onSwitch(remaining[0].id);
      } else {
        navigate(`/hosts/${host.id}`);
      }
    }
  };

  const handleComposeClick = (composeId: string) => {
    if (activeView === 'builder') {
      setActiveInstance(null);
    }
    onSwitch(composeId);
  };

  const visibleComposes = activeView === 'builder'
    ? host.stacks.filter((compose) => compose.id === activeComposeId)
    : host.stacks;
  const validationByComposeId = useMemo(() => {
    const results: Record<string, RuleResult[]> = {};
    host.stacks.forEach((compose) => {
      const services = hostStacksServices[compose.id];
      results[compose.id] = services
        ? validateStack({ services }, settings).results
        : (compose.validationResults ?? []);
    });
    return results;
  }, [host.stacks, hostStacksServices, settings]);

  const savedValidationRef = useRef<Record<string, string>>({});
  useEffect(() => {
    host.stacks.forEach((compose) => {
      const services = hostStacksServices[compose.id];
      if (!services) return;
      const results = validateStack({ services }, settings).results;
      const hash = results.map((r) => `${r.id}:${r.severity}`).join('|');
      if (savedValidationRef.current[compose.id] === hash) return;
      savedValidationRef.current[compose.id] = hash;
      updateComposeValidation(host.id, compose.id, results);
    });
  }, [hostStacksServices]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className={cn(activeView === 'builder' ? 'pt-3 space-y-1' : 'space-y-3')}>
        {activeView !== 'builder' && (
          <div className="flex h-9 items-center px-3">
            <h3 className="truncate text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {host.name}
            </h3>
          </div>
        )}

        <div className="space-y-1">
          {visibleComposes.map((compose) => {
            const isActive = activeComposeId === compose.id;
            const isSettingsActive = activeView === 'builder' ? isActive && activeInstanceId === null : isActive;
            const composeValidation = validationByComposeId[compose.id] || [];
            return (
              <div key={compose.id} className="space-y-0.5 group/compose-row">
                <div
                  onClick={() => handleComposeClick(compose.id)}
                  className={cn(
                    'w-full flex items-center justify-between rounded-xl group transition-all relative overflow-hidden cursor-pointer',
                    activeView === 'builder' ? 'h-9 px-3' : 'h-9 px-4',
                    isSettingsActive
                      ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                      : activeView === 'builder'
                        ? 'text-secondary font-bold hover:text-secondary hover:bg-secondary/5 border border-transparent'
                        : 'text-secondary/80 font-normal hover:text-secondary hover:bg-secondary/5 border border-transparent'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 truncate text-sm">
                    <Layers size={15} className="shrink-0" />
                    <span className="truncate">{compose.name}</span>
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover/compose-row:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenamingComposeId(compose.id);
                        setRenameValue(compose.name);
                      }}
                      className="h-6 w-6 text-muted-foreground/40 hover:text-primary hover:bg-primary/10"
                    >
                      <Pencil size={12} />
                    </Button>
                    {host.stacks.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setComposeToDelete({ id: compose.id, name: compose.name });
                        }}
                        className="h-6 w-6 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={12} />
                      </Button>
                    )}
                  </div>
                </div>

                {activeView === 'host' && (
                  <div className="ml-5 space-y-1.5 border-l border-border/20 py-1.5 pl-3 pr-3">
                    {Object.entries(hostStacksServices[compose.id] || {}).map(([id, svc]: [string, ServiceConfig]) => {
                      const issue = getHighestIssue(id, svc, composeValidation);

                      return (
                        <div
                          key={id}
                          className="flex cursor-pointer items-center justify-between gap-3 rounded-md text-xs leading-tight transition-colors hover:bg-secondary/5"
                          onClick={() => onSelectService?.(compose.id, id)}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {issue ? (
                              <span title={`${issue.title}: ${issue.message}`} className="shrink-0">
                                <AlertTriangle
                                  size={11}
                                  className={issue.severity === 'error' ? 'text-destructive' : 'text-secondary'}
                                />
                              </span>
                            ) : (
                              <span className="w-[11px] shrink-0" />
                            )}
                            <span className="truncate font-mono text-muted-foreground/60">{id}</span>
                          </span>
                          <span className="font-mono text-primary/45 shrink-0">{svc.ports?.[0] ? `:${svc.ports[0].host}` : '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!renamingComposeId} onOpenChange={(open) => !open && setRenamingComposeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rename compose</AlertDialogTitle>
            <AlertDialogDescription>Set a new name for this compose project.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={submitRename}>Save</AlertDialogAction>
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
            <AlertDialogAction variant="destructive" onClick={confirmDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function getHighestIssue(instanceId: string, instance: ServiceConfig, results: RuleResult[]): RuleResult | undefined {
  const issues = results.filter((result) =>
    (result.severity === 'error' || result.severity === 'warning') &&
    (result.affectedServices.includes(instanceId) || result.affectedServices.includes(instance.serviceId))
  );

  return issues.find((issue) => issue.severity === 'error') || issues[0];
}
