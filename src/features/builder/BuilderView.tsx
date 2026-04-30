import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, useBlocker } from 'react-router-dom';
import {
   RefreshCw, Box, Check, Layers
} from 'lucide-react';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStore } from '@/lib/store/useHostStore';
import { useCatalog } from '@/lib/catalog';
import { getCatalogCategories } from '@/lib/catalog';
import { ServiceSpec } from '@/types';
import { cn } from '@/lib/utils';
import { validateStack } from '@/lib/core/rules';
import { renderCompose } from '@/lib/core/renderers/compose';
import { renderReadme } from '@/lib/core/renderers/readme';
import { ServiceSettings } from './components/ServiceSettings';
import { StackSettings } from './components/StackSettings';
import { PreviewPanel } from './components/PreviewPanel';
import { ServiceCatalogDialog } from './components/ServiceCatalogDialog';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BundleLauncher } from '../host/components/BundleLauncher';
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

export function BuilderView() {
   const { hostId, composeId } = useParams<{ hostId: string; composeId: string }>();
   const { config, activeInstanceId, isDirty, saveCompose, loadCompose } = useComposeStore();
   const { settings, hosts } = useHostStore();
   const { getSpec } = useCatalog();
   const [isBundleLauncherOpen, setIsBundleLauncherOpen] = useState(false);
   const [isServiceCatalogOpen, setIsServiceCatalogOpen] = useState(false);
   const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
   const [spec, setSpec] = useState<ServiceSpec | null>(null);
   const blocker = useBlocker(({ nextLocation }) => {
     if (!isDirty) return false;
     return nextLocation.pathname !== `/hosts/${hostId}/${composeId}`;
   });
   const blockerRef = React.useRef(blocker);

   useEffect(() => {
     blockerRef.current = blocker;
   }, [blocker]);

   const resetBlocker = useCallback(() => {
     const currentBlocker = blockerRef.current;
     if (currentBlocker.state === 'blocked') {
       currentBlocker.reset?.();
     }
   }, []);

   const proceedBlocker = useCallback(() => {
     const currentBlocker = blockerRef.current;
     if (currentBlocker.state === 'blocked') {
       currentBlocker.proceed?.();
     }
   }, []);

   const activeStack = useMemo(() => {
      const host = hosts.find((item) => item.id === hostId);
      return host?.stacks.find((stack) => stack.id === composeId) || null;
   }, [hosts, hostId, composeId]);

   useEffect(() => {
     if (!hostId || !composeId) return;
     loadCompose(hostId, composeId);
   }, [hostId, composeId, loadCompose]);

   useEffect(() => {
     let mounted = true;
     async function loadSpec() {
       if (!activeInstanceId) {
         if (mounted) setSpec(null);
         return;
       }
       const service = config.services[activeInstanceId];
       if (!service) {
         if (mounted) setSpec(null);
         return;
       }
       const loaded = await getSpec(service.serviceId);
       if (mounted) setSpec(loaded || null);
     }
     loadSpec();
     return () => {
       mounted = false;
     };
   }, [activeInstanceId, config.services, getSpec]);

   const [yamlWidth, setYamlWidth] = useState(450);
   const [isResizing, setIsResizing] = useState(false);

   const startResizing = useCallback(() => setIsResizing(true), []);
   const stopResizing = useCallback(() => setIsResizing(false), []);
   const resize = useCallback((e: MouseEvent) => {
      if (isResizing) {
         const newWidth = window.innerWidth - e.clientX;
         if (newWidth > 320 && newWidth < 800) setYamlWidth(newWidth);
      }
   }, [isResizing]);

   useEffect(() => {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
      return () => {
         window.removeEventListener('mousemove', resize);
         window.removeEventListener('mouseup', stopResizing);
      };
   }, [isResizing, resize, stopResizing]);

   const validation = useMemo(() => validateStack(config, settings), [config, settings]);
   const yaml = useMemo(() => renderCompose(config, settings), [config, settings]);
   const docs = useMemo(
     () => renderReadme(config, activeStack?.name, activeStack?.description),
     [config, activeStack?.name, activeStack?.description],
   );

   // No auto-selection to allow StackSettings view

   const hasServices = Object.keys(config.services).length > 0;
   const resetToSaved = async () => {
      if (!hostId || !composeId) return;
      await loadCompose(hostId, composeId);
      setResetConfirmOpen(false);
   };

   return (
      <>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">

      <div className="border-b border-border/50 bg-card/5 shrink-0 sticky top-0 z-30 backdrop-blur-md">
        {activeInstanceId && config.services[activeInstanceId] ? (
          <div className="py-4 px-6 flex items-center justify-between animate-in fade-in duration-500">
            <div className="flex items-center gap-6">
              <div className="w-9 h-9 flex items-center justify-center shrink-0">
                {spec?.icon ? (
                  <img
                    src={spec.icon.includes('/') ? spec.icon : `https://cdn.simpleicons.org/${spec.icon}/ffffff`}
                    className="w-7 h-7 object-contain"
                    alt=""
                  />
                ) : (
                   <Box size={24} className="text-primary" />
                )}
              </div>

              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-12">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">
                    {spec?.name ?? config.services[activeInstanceId].serviceId}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                  {spec?.category && <><span className="text-secondary/60">{getCatalogCategories(spec).join(' / ')}</span><span className="opacity-30">•</span></>}
                  <span>{activeInstanceId}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={isDirty ? "default" : "ghost"}
                size="sm"
                disabled={!isDirty}
                onClick={() => {
                  if (hostId && composeId) saveCompose(hostId, composeId);
                }}
                className="h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all"
              >
                 <Check size={12} className="mr-2" /> Save
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                disabled={!isDirty}
                onClick={() => setResetConfirmOpen(true)}
                className="h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 hover:text-destructive transition-all"
              >
                 <RefreshCw size={12} className="mr-2" /> Discard
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-4 px-6 flex items-center justify-between animate-in fade-in duration-500">
            <div className="flex items-center gap-6">
              <div className="w-9 h-9 flex items-center justify-center shrink-0">
                <Layers size={20} className="text-secondary" />
              </div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-xl font-bold tracking-tight text-foreground">{activeStack?.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">Compose-level defaults</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={isDirty ? "default" : "ghost"}
                size="sm"
                disabled={!isDirty}
                onClick={() => {
                  if (hostId && composeId) saveCompose(hostId, composeId);
                }}
                className="h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all"
              >
                 <Check size={12} className="mr-2" /> Save
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                disabled={!isDirty}
                onClick={() => setResetConfirmOpen(true)}
                className="h-8 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 hover:text-destructive transition-all"
              >
                 <RefreshCw size={12} className="mr-2" /> Discard
              </Button>
            </div>
          </div>
        )}
        
        <input 
           type="file" 
           id="import-yaml" 
           className="hidden" 
           accept=".yml,.yaml"
           onChange={(e) => {
             const file = e.target.files?.[0];
             if (file) {
               const reader = new FileReader();
               reader.onload = () => {
                 const content = reader.result as string;
                 if (content) {
                   useComposeStore.getState().importYaml(content);
                   e.target.value = '';
                 }
               };
               reader.readAsText(file);
             }
           }}
        />
      </div>


         <div className="flex-1 overflow-hidden flex">
            {/* Main Workspace */}
            <ScrollArea className="flex-1">
               <div className="p-8">
                  {activeInstanceId && config.services[activeInstanceId] ? (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
                        <ServiceSettings
                           key={activeInstanceId}
                           instanceId={activeInstanceId}
                           service={config.services[activeInstanceId]}
                        />
                     </div>
                  ) : (
                      <StackSettings
                        onAddService={() => setIsServiceCatalogOpen(true)}
                        onAddBundle={() => setIsBundleLauncherOpen(true)}
                        onImport={() => document.getElementById('import-yaml')?.click()}
                      />
                  )}
               </div>
            </ScrollArea>

            {/* Action Sidebar (Right) */}
            {hasServices && (
               <>
                  <div
                     onMouseDown={startResizing}
                     className={cn(
                        "w-px h-full cursor-col-resize hover:bg-primary/20 transition-colors z-50 bg-border/40",
                        isResizing && "bg-primary/50"
                     )}
                  />

                  <div
                     className="bg-card/10 flex flex-col hidden lg:flex shrink-0 border-l border-border/50"
                     style={{ width: yamlWidth }}
                  >
                     <PreviewPanel
                        yaml={yaml}
                        docs={docs}
                        validation={validation}
                        config={config}
                        settings={settings}
                     />
                  </div>
               </>
            )}
         </div>
      </div>
      <BundleLauncher 
         open={isBundleLauncherOpen} 
         onOpenChange={setIsBundleLauncherOpen}
         mode="import"
      />
      <ServiceCatalogDialog
         open={isServiceCatalogOpen}
         onOpenChange={setIsServiceCatalogOpen}
      />
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard Unsaved Changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Discard will reload this compose from the last saved version. Unsaved edits will be discarded.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={resetToSaved}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => {
          if (!open) resetBlocker();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes in your compose. Save before leaving this page?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex items-center gap-2">
            <AlertDialogCancel onClick={resetBlocker}>Cancel</AlertDialogCancel>
            <Button
              variant="ghost"
              className="h-10 px-4 text-xs font-bold"
              onClick={proceedBlocker}
            >
              Leave without saving
            </Button>
            <AlertDialogAction
              onClick={async () => {
                if (hostId && composeId) {
                  await saveCompose(hostId, composeId);
                }
                proceedBlocker();
              }}
            >
              Save & Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
   </>
   );
}
