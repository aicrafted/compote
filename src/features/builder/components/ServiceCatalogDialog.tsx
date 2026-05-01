import React, { useMemo, useState } from 'react';
import { Box, Plus, Search, Trash2 } from 'lucide-react';
import { CatalogEntry, ServiceConfig, ServiceSpec } from '@/types';
import { getCatalogCategories, getCatalogIconUrl, useCatalog } from '@/lib/catalog';
import { useComposeStore } from '@/lib/store/useComposeStore';
import { cn } from '@/lib/utils';
import { getDefaultPortMappings } from '@/lib/core/ports';
import { RegistrySearch } from './RegistrySearch';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isServerMode } from '@/lib/storage/driver';

interface ServiceCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function nextInstanceId(serviceId: string, existing: Record<string, ServiceConfig>): string {
  if (!existing[serviceId]) return serviceId;
  let i = 2;
  while (existing[`${serviceId}-${i}`]) i++;
  return `${serviceId}-${i}`;
}

export function ServiceCatalogDialog({ open, onOpenChange }: ServiceCatalogDialogProps) {
  const { allServices, servicesByCategory, getSpec, addUserService, uploadServerService, removeUserService } = useCatalog();
  const { config, upsertService, setActiveInstance } = useComposeStore();
  const [view, setView] = useState<'catalog' | 'search'>('catalog');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const categories = useMemo(() => Object.keys(servicesByCategory).sort((a, b) => a.localeCompare(b)), [servicesByCategory]);

  const filteredServices = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allServices.filter((service) => {
      const matchesSearch =
        !query ||
        service.name.toLowerCase().includes(query) ||
        service.id.toLowerCase().includes(query) ||
        service.tags?.some((tag) => tag.toLowerCase().includes(query));
      const matchesCategory = !activeCategory || getCatalogCategories(service).includes(activeCategory);
      return matchesSearch && matchesCategory;
    });
  }, [activeCategory, allServices, searchQuery]);

  const handleSelectCatalog = async (service: CatalogEntry) => {
    const spec = await getSpec(service.id, service.source);
    const instanceId = nextInstanceId(service.id, config.services);
    upsertService(instanceId, {
      serviceId: service.id,
      enabled: true,
      env: spec ? getDefaultEnv(spec) : {},
      ports: spec ? getDefaultPortMappings(spec) : [],
    });
    setActiveInstance(instanceId);
    onOpenChange(false);
  };

  const handleAddExternal = async (spec: ServiceSpec) => {
    await addUserService(spec);
    const instanceId = nextInstanceId(spec.id, config.services);
    upsertService(instanceId, { serviceId: spec.id, enabled: true });
    setActiveInstance(instanceId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border/40 p-4 pb-0">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>Add Service</DialogTitle>
              <DialogDescription>Select a catalog service to add to this compose.</DialogDescription>
            </div>
          </div>

          <div className="flex gap-0 pt-3">
            {(['catalog', 'search'] as const).map((v) => (
              <Button
                key={v}
                variant="ghost"
                size="sm"
                onClick={() => setView(v)}
                className={cn(
                  'h-8 rounded-none border-b-2 px-4 text-xs font-bold',
                  view === v
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-transparent'
                )}
              >
                {v === 'catalog' ? 'Library' : 'Search Registries'}
              </Button>
            ))}
          </div>
        </DialogHeader>

        {view === 'catalog' ? (
          <>
            <div className="space-y-2 p-4 pb-2">
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={13} />
                <Input
                  placeholder="Search library..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              {isServerMode && (
                <Button size="sm" className="h-8 gap-2 text-xs" onClick={() => setUploadOpen(true)}>
                  <Plus size={13} />
                  Add custom service
                </Button>
              )}

              <div className="flex flex-wrap gap-x-1 gap-y-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setActiveCategory(null)}
                  className={cn(
                    'h-6 px-2 text-[10px] font-bold uppercase tracking-widest',
                    activeCategory === null
                      ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                      : 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-transparent'
                  )}
                >
                  All
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveCategory(category)}
                    className={cn(
                      'h-6 px-2 text-[10px] font-bold uppercase tracking-widest',
                      activeCategory === category
                        ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                        : 'text-muted-foreground/40 hover:text-muted-foreground/70 hover:bg-transparent'
                    )}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </div>

            <ScrollArea className="h-[52vh] px-4 pb-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 pt-1">
                {filteredServices.map((service) => (
                  <CatalogServiceCard
                    key={service.id}
                    service={service}
                    onSelect={() => handleSelectCatalog(service)}
                    onDelete={isServerMode && service.source === 'user' ? () => removeUserService(service.id) : undefined}
                  />
                ))}
              </div>
            </ScrollArea>
            {isServerMode && (
              <ServiceUploadDialog
                open={uploadOpen}
                onOpenChange={setUploadOpen}
                onUpload={uploadServerService}
              />
            )}
          </>
        ) : (
          <RegistrySearch onAdd={handleAddExternal} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function getDefaultEnv(spec: ServiceSpec): Record<string, string> {
  return spec.requiredEnv.reduce<Record<string, string>>((env, field) => {
    env[field.name] = field.defaultValue || '';
    return env;
  }, {});
}

function CatalogServiceCard({ service, onSelect, onDelete }: { service: CatalogEntry; onSelect: () => void; onDelete?: () => Promise<void> | void }) {
  const iconUrl = getCatalogIconUrl(service);
  const [iconFailed, setIconFailed] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

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
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className="group flex min-h-20 cursor-pointer flex-col gap-2 rounded-lg border border-border/50 bg-card/30 p-3 text-left transition-colors hover:bg-muted/10 hover:border-border"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted/30">
          {iconUrl && !iconFailed
            ? <img src={iconUrl} className="size-5 object-contain" alt="" onError={() => setIconFailed(true)} />
            : <Box size={16} className="text-muted-foreground" />
          }
        </div>
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30 max-w-[6rem]">
            {getCatalogCategories(service).join(' / ')}
          </span>
          {onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground/40 hover:text-destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              <Trash2 size={12} />
            </Button>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <h4 className="truncate text-xs font-medium">{service.name}</h4>
        {service.description && (
          <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground/50">{service.description}</p>
        )}
      </div>
    </div>
  );
}

function ServiceUploadDialog({
  open,
  onOpenChange,
  onUpload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (id: string, files: { metadata: File; compose: File; icon?: File }) => Promise<void>;
}) {
  const [serviceId, setServiceId] = useState('');
  const [metadata, setMetadata] = useState<File | null>(null);
  const [compose, setCompose] = useState<File | null>(null);
  const [icon, setIcon] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setServiceId('');
    setMetadata(null);
    setCompose(null);
    setIcon(null);
    setError('');
    setSubmitting(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(serviceId)) {
      setError('Use kebab-case for the service ID.');
      return;
    }
    if (!metadata || !compose) {
      setError('metadata.json and compose-part.yml are required.');
      return;
    }

    setSubmitting(true);
    try {
      await onUpload(serviceId, { metadata, compose, icon: icon || undefined });
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
          <DialogTitle>Add Custom Service</DialogTitle>
          <DialogDescription>Upload service files into the self-host catalog.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="custom-service-id">Service ID</Label>
            <Input id="custom-service-id" value={serviceId} onChange={(event) => setServiceId(event.target.value)} placeholder="my-service" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-service-metadata">metadata.json</Label>
            <Input id="custom-service-metadata" type="file" accept="application/json,.json" onChange={(event) => setMetadata(event.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-service-compose">compose-part.yml</Label>
            <Input id="custom-service-compose" type="file" accept=".yml,.yaml,text/yaml" onChange={(event) => setCompose(event.target.files?.[0] ?? null)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-service-icon">Icon</Label>
            <Input id="custom-service-icon" type="file" accept="image/svg+xml,image/png" onChange={(event) => setIcon(event.target.files?.[0] ?? null)} />
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
