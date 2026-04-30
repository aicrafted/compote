import React, { useEffect, useState } from 'react';
import { FileCog, KeyRound } from 'lucide-react';
import { ServiceConfig, ServiceSpec } from '@/types';
import { useCatalog } from '@/lib/catalog';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { useHostStore } from '@/lib/store/useHostStore';
import { StorageSection } from './sections/StorageSection';
import { NetworkSection } from './sections/NetworkSection';
import { EnvironmentSection } from './sections/EnvironmentSection';
import { LabelsSection } from './sections/LabelsSection';
import { RuntimeSection } from './sections/RuntimeSection';
import { BootOrderSection } from './sections/BootOrderSection';
import { HealthcheckSection } from './sections/HealthcheckSection';
import { DevicesSection } from './sections/DevicesSection';
import { ExecutionSection } from './sections/ExecutionSection';
import { ImageBuildSection } from './sections/ImageBuildSection';
import { AdvancedYamlSection } from './sections/AdvancedYamlSection';
import { ServiceResourceSection } from './ResourceSections';
import { getExposedPorts } from '@/lib/core/ports';
import { validateStack } from '@/lib/core/rules';

interface ServiceSettingsProps {
   instanceId: string;
   service: ServiceConfig;
}

export function ServiceSettings({ instanceId, service }: ServiceSettingsProps) {
   const { getSpec } = useCatalog();
   const { upsertService, renameService, config } = useComposeStore();
   const { settings } = useHostStore();
   const [spec, setSpec] = useState<ServiceSpec | null>(null);
   const [instanceIdDraft, setInstanceIdDraft] = useState(instanceId);

   useEffect(() => {
      let mounted = true;
      async function load() {
         const loaded = await getSpec(service.serviceId);
         if (mounted) setSpec(loaded || null);
      }
      load();
      return () => {
         mounted = false;
      };
   }, [getSpec, service.serviceId]);

   const effectiveSpec: ServiceSpec = React.useMemo(() => spec ?? {
      id: service.serviceId,
      name: service.serviceId,
      category: 'OTHER',
      categories: ['OTHER'],
      description: '',
      image: service.serviceId,
      tags: [],
      containerPorts: [],
      requires: [],
      requiredEnv: [],
   }, [service.serviceId, spec]);

   const availableServices = Object.keys(config.services).filter(id => id !== instanceId);
   const availableNetworks = Array.from(new Set([
      ...Object.keys(config.networks || {}),
      ...(settings.externalNetworks || []),
      ...Object.values(config.services).flatMap((item) => item.networks || []),
   ].filter(Boolean)));
   const availableVolumes = Array.from(new Set([
      ...Object.keys(config.volumes || {}),
      ...(settings.externalVolumes || []),
      ...Object.values(config.services).flatMap((item) =>
         (item.volumes || [])
            .filter((volume) => volume.type === 'volume')
            .map((volume) => volume.host)
      ),
   ].filter(Boolean)));
   const availableConfigs = Object.keys(config.configs || {});
   const availableSecrets = Object.keys(config.secrets || {});
   const exposedPorts = getExposedPorts(effectiveSpec);
   const handleUpdate = (patch: Partial<ServiceConfig>) => upsertService(instanceId, patch);
   const portConflicts = React.useMemo(() => {
      const validation = validateStack(config, settings);
      return service.ports.reduce<Record<number, string[]>>((acc, port) => {
         const issues = validation.results.filter((result) =>
            result.severity === 'error' &&
            result.affectedServices.includes(instanceId) &&
            (result.id === `port-conflict-${port.host}` || result.id === `host-port-conflict-${instanceId}-${port.host}`)
         );
         if (issues.length > 0) {
            acc[port.host] = issues.map((issue) => issue.message);
         }
         return acc;
      }, {});
   }, [config, instanceId, service.ports, settings]);

   const hasExecution = Boolean(service.command || service.entrypoint || service.workingDir || service.user || service.profiles?.length);
   const hasDependsOn = Boolean(service.dependsOn?.length || effectiveSpec.requires?.length);
   const hasVolumes = Boolean(service.volumes?.length);
   const hasNetwork = Boolean(service.networks?.length || service.ports?.length || exposedPorts.length);
   const hasDevices = Boolean(service.devices?.length);
   const hasLabels = Boolean(Object.keys(service.labels || {}).length);
   const hasRaw = Boolean(service.raw && Object.keys(service.raw).length > 0);

   const commitRename = () => {
      const next = instanceIdDraft.trim();
      if (next && next !== instanceId && !config.services[next]) {
         renameService(instanceId, next);
      } else {
         setInstanceIdDraft(instanceId);
      }
   };

   return (
      <div className="flex flex-col animate-in fade-in slide-in-from-top-4 duration-500">
         <div className="space-y-6">
            <div className="space-y-1">
               <span className="text-[10px] text-muted-foreground/60 font-medium">Instance ID</span>
               <div className="rounded-xl border border-border/60 bg-card/40 px-3 py-1.5">
                  <input
                     value={instanceIdDraft}
                     onChange={(e) => setInstanceIdDraft(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                     onBlur={commitRename}
                     onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setInstanceIdDraft(instanceId); }}
                     className="w-full bg-transparent text-sm font-mono outline-none text-foreground/80"
                     spellCheck={false}
                  />
               </div>
            </div>
            <ImageBuildSection
               image={service.image || effectiveSpec.image}
               imageTag={service.imageTag}
               tagsApi={effectiveSpec.tagsApi}
               platform={service.platform}
               pullPolicy={service.pullPolicy}
               build={service.build}
               onChange={handleUpdate}
               collapsible
               defaultOpen
            />

            <StorageSection
               volumes={service.volumes}
               volumeSuggestions={availableVolumes}
               onChange={(volumes) => handleUpdate({ volumes })}
               collapsible
               defaultOpen={hasVolumes}
            />

            <NetworkSection
               serviceId={instanceId}
               networks={service.networks}
               ports={service.ports}
               exposedPorts={exposedPorts}
               networkSuggestions={availableNetworks}
               portConflicts={portConflicts}
               onChange={handleUpdate}
               collapsible
               defaultOpen={hasNetwork}
            />

            <EnvironmentSection
               serviceId={instanceId}
               env={service.env}
               spec={effectiveSpec}
               onChange={(env) => handleUpdate({ env })}
            />

            <RuntimeSection
               restart={service.restart}
               limits={service.limits}
               containerName={service.containerName}
               spec={effectiveSpec}
               onChange={handleUpdate}
            />

            <BootOrderSection
               dependsOn={service.dependsOn}
               spec={effectiveSpec}
               availableServices={availableServices}
               onChange={(dependsOn) => handleUpdate({ dependsOn })}
               collapsible
               defaultOpen={hasDependsOn}
            />

            <HealthcheckSection
               healthcheck={service.healthcheck}
               onChange={(healthcheck) => handleUpdate({ healthcheck })}
            />

            <ExecutionSection
               command={service.command}
               entrypoint={service.entrypoint}
               workingDir={service.workingDir}
               user={service.user}
               profiles={service.profiles}
               onChange={handleUpdate}
               collapsible
               defaultOpen={hasExecution}
            />

            <DevicesSection
               devices={service.devices || []}
               onChange={(devices) => handleUpdate({ devices })}
               collapsible
               defaultOpen={hasDevices}
            />

            <LabelsSection
               labels={service.labels}
               onChange={(labels) => handleUpdate({ labels })}
               collapsible
               defaultOpen={hasLabels}
            />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
               <ServiceResourceSection
                  title="Configs"
                  icon={<FileCog size={14} />}
                  addLabel="Attach Config"
                  resources={service.configs || []}
                  availableSources={availableConfigs}
                  defaultTarget={(source) => `/run/configs/${source}`}
                  onChange={(configs) => handleUpdate({ configs })}
               />

               <ServiceResourceSection
                  title="Secrets"
                  icon={<KeyRound size={14} />}
                  addLabel="Attach Secret"
                  resources={service.secrets || []}
                  availableSources={availableSecrets}
                  defaultTarget={(source) => `/run/secrets/${source}`}
                  onChange={(secrets) => handleUpdate({ secrets })}
               />
            </div>

            <AdvancedYamlSection
               raw={service.raw}
               onChange={(raw) => handleUpdate({ raw })}
               collapsible
               defaultOpen={hasRaw}
            />
         </div>
      </div>
   );
}
