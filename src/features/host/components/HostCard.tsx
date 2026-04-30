import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  Globe,
  Box,
  Layers,
  Activity
} from 'lucide-react';
import { useHostStore } from '@/lib/store/useHostStore';
import { HostMetadata, ComposeData, ServiceSpec } from '@/types';
import { CatalogRegistry } from '@/lib/catalog/registry';
import { composeRepository } from '@/lib/storage/ComposeRepository';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

interface HostCardProps {
  host: HostMetadata;
  onAddCompose: (hostId: string) => void;
  onOpenBundle: (hostId: string) => void;
}

export function HostCard({ host, onAddCompose, onOpenBundle }: HostCardProps) {
  const navigate = useNavigate();
  const { deleteHost } = useHostStore();
  
  const [stacksData, setStacksData] = useState<Record<string, ComposeData>>({});
  const [serviceSpecs, setServiceSpecs] = useState<Record<string, ServiceSpec>>({});
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    async function loadAllStacks() {
      setLoading(true);
      const data: Record<string, ComposeData> = {};
      
      try {
        await Promise.all(
          host.stacks.map(async (s) => {
            const stackConfig = await composeRepository.get(host.id, s.id);
            if (stackConfig) {
              data[s.id] = stackConfig;
            }
          })
        );
        setStacksData(data);

        const serviceIds = Array.from(
          new Set(
            Object.values(data).flatMap((stack) =>
              Object.values(stack.services).map((service) => service.serviceId)
            )
          )
        );
        const loadedSpecs = await Promise.all(
          serviceIds.map(async (serviceId) => [serviceId, await CatalogRegistry.getService(serviceId, 'builtin')] as const)
        );
        const specMap = loadedSpecs.reduce<Record<string, ServiceSpec>>((acc, [serviceId, spec]) => {
          if (spec) acc[serviceId] = spec;
          return acc;
        }, {});
        setServiceSpecs(specMap);
      } catch (error) {
        console.error('Failed to load stacks for host:', host.id, error);
      } finally {
        setLoading(false);
      }
    }

    loadAllStacks();
  }, [host.id, host.stacks]);

  const handleSelectHost = async () => {
    navigate(`/hosts/${host.id}`);
  };

  const handleSelectStack = async (composeId: string) => {
    navigate(`/hosts/${host.id}/${composeId}`);
  };

  return (
    <>
    <Card 
      className="group relative flex flex-col border border-border/40 bg-card/30 hover:bg-card/50 transition-all hover:border-primary/30 overflow-hidden"
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <div 
          onClick={handleSelectHost}
          className="flex items-center gap-2 cursor-pointer group/title"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center transition-all group-hover/title:bg-primary group-hover/title:text-primary-foreground">
            <Globe size={16} />
          </div>
          <div>
            <CardTitle className="text-sm font-black tracking-tight group-hover/title:text-primary transition-colors">
              {host.name}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">
              {host.stacks.length} Compose projects
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all"
          onClick={(e) => { e.stopPropagation(); setDeleteOpen(true); }}
        >
          <Trash2 size={13} />
        </Button>
      </CardHeader>

      <CardContent className="flex-1 p-4 pt-2 space-y-3">
        <ScrollArea className="max-h-[160px]">
          <div className="space-y-1.5 pr-1">
            {host.stacks.map(stack => {
              const data = stacksData[stack.id];
              const serviceIds = data ? Object.values(data.services).map(s => s.serviceId) : [];
              
              return (
                <div 
                  key={stack.id}
                  onClick={(e) => {
                      e.stopPropagation();
                      handleSelectStack(stack.id);
                  }}
                  className="flex flex-col gap-1.5 p-2 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all cursor-pointer group/stack"
                >
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                          <Box size={12} className="text-muted-foreground group-hover/stack:text-primary" />
                          <span className="text-[11px] font-bold truncate max-w-[120px]">{stack.name}</span>
                      </div>
                      {loading && <Activity size={10} className="animate-pulse text-muted-foreground/30" />}
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {serviceIds.length > 0 ? (
                      serviceIds.slice(0, 6).map((svcId, idx) => {
                        const spec = serviceSpecs[svcId];
                        return (
                          <div 
                            key={`${stack.id}-${svcId}-${idx}`}
                            className="w-5 h-5 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center p-1"
                            title={spec?.name || svcId}
                          >
                              {spec?.icon ? (
                                  <img src={spec.icon} className="w-full h-full grayscale group-hover/stack:grayscale-0 transition-all" alt="" />
                              ) : (
                                  <Activity size={8} className="text-muted-foreground" />
                              )}
                          </div>
                        );
                      })
                    ) : !loading && (
                      <span className="text-[9px] text-muted-foreground/50 font-medium italic">No services</span>
                    )}
                    {serviceIds.length > 6 && (
                      <div className="w-5 h-5 rounded-md bg-muted/30 border border-border/30 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          +{serviceIds.length - 6}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>

      <div className="px-4 pb-4 mt-auto flex gap-2">
         <Button 
           variant="outline" 
           size="sm"
           onClick={(e) => {
             e.stopPropagation();
             onAddCompose(host.id);
           }}
           className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest border-border/40 hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all"
         >
           <Plus size={10} className="mr-1.5" /> Compose
         </Button>
         <Button 
           variant="secondary"
           size="sm"
           onClick={(e) => {
             e.stopPropagation();
             onOpenBundle(host.id);
           }}
           className="flex-1 h-7 text-[9px] font-black uppercase tracking-widest"
         >
           <Layers size={10} className="mr-1.5" /> Bundle
         </Button>
      </div>
    </Card>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete host?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-bold text-foreground">{host.name}</span> and its compose projects will be removed from this browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => deleteHost(host.id)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
