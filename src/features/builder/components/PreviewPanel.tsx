import React, { useState, useMemo } from 'react';
import { marked } from 'marked';
import {
  Check, Copy, AlertTriangle, CheckCircle2, Wrench,
  Download, Terminal, ShieldCheck, BookOpen, Code, Eye
} from 'lucide-react';
import { ComposeData, EnvFieldSpec, GlobalSettings, ServiceSpec, ValidationSummary } from '@/types';
import { cn } from '@/lib/utils';
import { downloadComposeZip } from '@/lib/core/exporter';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useCatalog } from '@/lib/catalog';
import { getDefaultPortMappings } from '@/lib/core/ports';
import { Button } from '@/components/ui/button';

interface PreviewPanelProps {
  yaml: string;
  docs: string;
  validation: ValidationSummary;
  config: ComposeData;
  settings: GlobalSettings;
}

export function PreviewPanel({ yaml, docs, validation, config, settings }: PreviewPanelProps) {
  const [sidebarAction, setSidebarAction] = useState<'config' | 'verify' | 'readme'>('config');
  const [readmeMode, setReadmeMode] = useState<'preview' | 'source'>('preview');
  const [copied, setCopied] = useState(false);
  const docsHtml = useMemo(() => marked(docs) as string, [docs]);
  const { upsertService, setActiveInstance } = useComposeStore();
  const { getSpec } = useCatalog();

  const errors = validation.results.filter(v => v.severity === 'error');
  const warnings = validation.results.filter(v => v.severity === 'warning');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddMissingDependency = async (serviceId: string) => {
    const existing = config.services[serviceId];
    if (existing) {
      upsertService(serviceId, { enabled: true });
      setActiveInstance(serviceId);
      return;
    }

    const spec = await getSpec(serviceId);
    upsertService(serviceId, {
      serviceId,
      enabled: true,
      env: spec ? getDefaultEnv(spec) : {},
      ports: spec ? getDefaultPortMappings(spec) : [],
      volumes: [],
      labels: {},
      networks: [],
      publiclyExposed: spec?.publicExposure === 'recommended',
    });
    setActiveInstance(serviceId);
  };

  const handleFixMissingEnv = (serviceId: string, key: string) => {
    const service = config.services[serviceId];
    if (!service) return;

    if (service.env[key] === undefined) {
      upsertService(serviceId, { env: { ...service.env, [key]: '' } });
    }
    setActiveInstance(serviceId);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('compote:focus-env-value', {
        detail: { serviceId, key },
      }));
    }, 0);
  };

  const handleFocusHostPort = (serviceId: string, hostPort: number) => {
    setActiveInstance(serviceId);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('compote:focus-host-port', {
        detail: { serviceId, hostPort },
      }));
    }, 0);
  };

  const handleFixIssue = async (result: ValidationSummary['results'][number]) => {
    if (result.metadata?.missingDependencyId) {
      await handleAddMissingDependency(result.metadata.missingDependencyId);
      return;
    }
    if (result.metadata?.missingEnvKey && result.affectedServices[0]) {
      handleFixMissingEnv(result.affectedServices[0], result.metadata.missingEnvKey);
      return;
    }
    if (result.id.startsWith('host-port-conflict-') && result.metadata?.hostPort && result.affectedServices[0]) {
      handleFocusHostPort(result.affectedServices[0], result.metadata.hostPort);
    }
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
       {/* Sidebar Actions Selector */}
       <div className="h-10 border-b border-border bg-card flex shrink-0">
          <SidebarActionTab 
            label="Config" 
            active={sidebarAction === 'config'} 
            onClick={() => setSidebarAction('config')} 
            icon={<Terminal size={11} />}
          />
          <SidebarActionTab 
            label="Verify" 
            active={sidebarAction === 'verify'} 
            onClick={() => setSidebarAction('verify')} 
            icon={<ShieldCheck size={11} />}
            badge={errors.length || warnings.length || undefined}
            badgeType={errors.length > 0 ? 'error' : 'warning'}
          />
          <SidebarActionTab 
            label="Readme" 
            active={sidebarAction === 'readme'} 
            onClick={() => setSidebarAction('readme')} 
            icon={<BookOpen size={11} />}
          />
       </div>

       {/* Action Content Area */}
       <div className="flex-1 overflow-hidden flex flex-col">
          {sidebarAction === 'config' && (
            <div className="flex-1 flex flex-col min-h-0">
               <div className="py-2.5 px-4 flex items-center justify-between border-b border-border/20 bg-card/5">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30">COMPOSE YAML</span>
                  <button 
                    onClick={() => copyToClipboard(yaml)}
                    className="text-primary/70 hover:text-primary transition-all flex items-center gap-1"
                  >
                     {copied ? <Check size={11} /> : <Copy size={11} />}
                     <span className="text-[8px] font-bold uppercase">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
               </div>
               <div className="flex-1 overflow-auto p-4 font-mono text-[9px] bg-black/[0.02] scrollbar-thin">
                  <pre className="text-secondary/60 leading-relaxed font-medium">
                     {yaml}
                  </pre>
               </div>
            </div>
          )}

          {sidebarAction === 'verify' && (
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
               <h4 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40 mb-2">Internal Audit</h4>
               {validation.results.map((res, i) => (
                 <div key={i} className={cn(
                   "p-3 rounded-xl border transition-all",
                   res.severity === 'error' ? "bg-destructive/[0.03] border-destructive/10" : "bg-orange-500/[0.03] border-orange-500/10"
                 )}>
                   <div className="flex items-start gap-2.5">
                      <AlertTriangle size={14} className={cn('mt-0.5 shrink-0', res.severity === 'error' ? "text-destructive/70" : "text-orange-500/70")} />
                      <div className="min-w-0 flex-1">
                         <p className="text-xs font-bold leading-tight mb-1">{res.title}</p>
                         <p className="text-[11px] text-muted-foreground/70 leading-snug">{res.message}</p>
                      </div>
                      {(res.metadata?.missingDependencyId || res.metadata?.missingEnvKey || (res.id.startsWith('host-port-conflict-') && res.metadata?.hostPort)) && (
                        <Button
                          variant="quiet-outline"
                          size="sm"
                          onClick={() => handleFixIssue(res)}
                          className="h-7 shrink-0 px-2 text-[10px]"
                        >
                          <Wrench size={12} /> Fix
                        </Button>
                      )}
                   </div>
                 </div>
               ))}
               {validation.results.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-10">
                    <CheckCircle2 size={24} className="mb-2" />
                    <p className="text-[10px] font-bold">Compose Validated</p>
                 </div>
               )}
            </div>
          )}

          {sidebarAction === 'readme' && (
            <div className="flex-1 flex flex-col min-h-0">
               <div className="py-2.5 px-4 flex items-center justify-between border-b border-border/20 bg-card/5">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setReadmeMode('preview')}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all",
                        readmeMode === 'preview' ? "bg-primary/15 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                      )}
                    >
                      <Eye size={9} /> Preview
                    </button>
                    <button
                      onClick={() => setReadmeMode('source')}
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-bold uppercase transition-all",
                        readmeMode === 'source' ? "bg-primary/15 text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"
                      )}
                    >
                      <Code size={9} /> Source
                    </button>
                  </div>
                  <button
                    onClick={() => copyToClipboard(docs)}
                    className="text-primary/70 hover:text-primary transition-all flex items-center gap-1"
                  >
                     {copied ? <Check size={11} /> : <Copy size={11} />}
                     <span className="text-[8px] font-bold uppercase">{copied ? 'Copied' : 'Copy'}</span>
                  </button>
               </div>
               {readmeMode === 'preview' ? (
                 <div
                   className="flex-1 overflow-auto p-5 scrollbar-thin bg-black/[0.01] md-preview"
                   dangerouslySetInnerHTML={{ __html: docsHtml }}
                 />
               ) : (
                 <div className="flex-1 overflow-auto p-5 font-mono text-[9px] scrollbar-thin bg-black/[0.01]">
                   <pre className="text-muted-foreground/70 whitespace-pre-wrap leading-relaxed">{docs}</pre>
                 </div>
               )}
            </div>
          )}
       </div>

       {/* Footer Action */}
       <div className="p-4 border-t border-border bg-card/5">
          <button 
            onClick={() => downloadComposeZip(config, settings)}

            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 active:scale-95 transition-all text-[9px] tracking-[0.1em] disabled:opacity-30 disabled:grayscale"
          >
            <Download size={13} />
            DOWNLOAD CONFIG
          </button>
       </div>
    </div>
  );
}

function getDefaultEnv(spec: ServiceSpec): Record<string, string> {
  return spec.requiredEnv.reduce<Record<string, string>>((env, field: EnvFieldSpec) => {
    env[field.name] = field.defaultValue || '';
    return env;
  }, {});
}

function SidebarActionTab({ 
  label, active, onClick, icon, badge, badgeType 
}: { 
  label: string, active: boolean, onClick: () => void, icon: React.ReactNode, badge?: number, badgeType?: 'error' | 'warning' 
}) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex-1 h-10 flex items-center justify-center gap-2 cursor-pointer transition-all relative border-b-2",
        active 
          ? "border-primary bg-primary/5 text-primary" 
          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-card/20"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
      {badge !== undefined && badge > 0 && (
        <div className={cn(
          "px-1 min-w-[14px] h-[14px] flex items-center justify-center rounded-full text-[8px] font-bold text-white",
          badgeType === 'error' ? "bg-destructive shadow-sm" : "bg-orange-500 shadow-sm"
        )}>
           {badge}
        </div>
      )}
      {active && <div className="absolute inset-x-0 bottom-[-2px] h-1 bg-primary/40 blur-sm" />}
    </div>
  );
}
