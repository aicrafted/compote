import React from 'react';
import { Package, Plus, X } from 'lucide-react';
import { ServiceConfig } from '@/types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { CustomSelect } from '@/components/ui/custom-select';
import { SettingsSection } from '../SettingsSection';
import { VersionSelector } from '../VersionSelector';

interface ImageBuildSectionProps {
  image: string;
  imageTag?: string;
  tagsApi?: string;
  platform?: string;
  pullPolicy?: string;
  build?: ServiceConfig['build'];
  onChange: (patch: Partial<ServiceConfig>) => void;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

type ArgRow = { id: string; key: string; value: string };

function splitImageRef(image: string) {
  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');

  if (lastColon > lastSlash) {
    return {
      baseImage: image.slice(0, lastColon),
      defaultTag: image.slice(lastColon + 1) || 'latest',
    };
  }

  return { baseImage: image, defaultTag: 'latest' };
}

export function ImageBuildSection({ image, imageTag, tagsApi, platform, pullPolicy, build, onChange, collapsible, defaultOpen }: ImageBuildSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen ?? true);
  const buildEnabled = Boolean(build);
  const { baseImage, defaultTag } = splitImageRef(image);
  const [imageDraft, setImageDraft] = React.useState(baseImage);

  const [argRows, setArgRows] = React.useState<ArgRow[]>(() =>
    Object.entries(build?.args || {}).map(([key, value]) => ({ id: crypto.randomUUID(), key, value }))
  );

  React.useEffect(() => {
    setArgRows(Object.entries(build?.args || {}).map(([key, value]) => ({ id: crypto.randomUUID(), key, value })));
  }, [build]);

  React.useEffect(() => {
    setImageDraft(baseImage);
  }, [baseImage]);

  const handleBuildToggle = (enabled: boolean) => {
    onChange({ build: enabled ? (build ?? {}) : undefined });
  };

  const patchBuild = (patch: Partial<NonNullable<ServiceConfig['build']>>) => {
    onChange({ build: { ...(build ?? {}), ...patch } });
  };

  const commitImage = () => {
    const trimmed = imageDraft.trim();
    if (!trimmed) {
      onChange({ image: undefined, imageTag: undefined });
      return;
    }

    const nextImage = splitImageRef(trimmed);
    onChange({
      image: nextImage.baseImage,
      imageTag: nextImage.baseImage === baseImage ? imageTag : nextImage.defaultTag === 'latest' ? undefined : nextImage.defaultTag,
    });
  };

  const commitArgRows = (rows: ArgRow[]) => {
    setArgRows(rows);
    const args = rows.reduce<Record<string, string>>((acc, row) => {
      if (row.key.trim()) acc[row.key.trim()] = row.value;
      return acc;
    }, {});
    onChange({ build: { ...(build ?? {}), args: Object.keys(args).length > 0 ? args : undefined } });
  };

  const updateRow = (id: string, patch: Partial<ArgRow>) =>
    setArgRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <SettingsSection
      title="Image & Build"
      icon={<Package size={14} />}
      collapsible={collapsible}
      open={open}
      onOpenChange={setOpen}
      action={
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Build</span>
          <Switch size="sm" checked={buildEnabled} onCheckedChange={(enabled) => { handleBuildToggle(enabled); if (enabled) setOpen(true); }} />
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(16rem,1fr)_minmax(14rem,20rem)] gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Image</Label>
          <Input
            value={imageDraft}
            onChange={(event) => setImageDraft(event.target.value)}
            onBlur={commitImage}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commitImage();
                event.currentTarget.blur();
              }
            }}
            className="h-8 font-mono text-xs text-foreground/90"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Version</Label>
          <VersionSelector
            image={image}
            currentTag={imageTag ?? defaultTag}
            tagsApi={tagsApi}
            onChange={(tag) => onChange({ imageTag: tag })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Platform</Label>
          <Input
            defaultValue={platform}
            onBlur={(e) => onChange({ platform: e.target.value.trim() || undefined })}
            className="font-mono text-xs"
            placeholder="linux/amd64"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted-foreground/60">Pull Policy</Label>
          <CustomSelect
            value={pullPolicy || '_default'}
            options={[
              { value: '_default', label: 'default' },
              { value: 'always', label: 'always' },
              { value: 'missing', label: 'missing' },
              { value: 'never', label: 'never' },
              { value: 'build', label: 'build' },
            ]}
            onChange={(value) => onChange({ pullPolicy: value === '_default' ? undefined : value })}
          />
        </div>
      </div>

      {buildEnabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60">Context</Label>
              <Input
                defaultValue={build?.context}
                onBlur={(e) => patchBuild({ context: e.target.value.trim() || undefined })}
                className="font-mono text-xs"
                placeholder="."
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground/60">Dockerfile</Label>
              <Input
                defaultValue={build?.dockerfile}
                onBlur={(e) => patchBuild({ dockerfile: e.target.value.trim() || undefined })}
                className="font-mono text-xs"
                placeholder="Dockerfile"
              />
            </div>

            <div className="col-span-2 space-y-2">
              <Label className="text-[10px] text-muted-foreground/60">Target Stage</Label>
              <Input
                defaultValue={build?.target}
                onBlur={(e) => patchBuild({ target: e.target.value.trim() || undefined })}
                className="font-mono text-xs"
                placeholder="production"
              />
            </div>
          </div>

          <SettingsSection.Subtitle
            title="Build Args"
            action={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setArgRows((prev) => [...prev, { id: crypto.randomUUID(), key: '', value: '' }])}
              >
                <Plus size={14} />
              </Button>
            }
          />

          {argRows.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border/40 bg-background/30">
              <div className="grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] border-b border-border/40 text-[10px] font-medium tracking-wide text-muted-foreground/60">
                <div className="px-2.5 py-2">Name</div>
                <div className="border-l border-border/40 px-2.5 py-2">Value</div>
                <div />
              </div>

              <div className="divide-y divide-border/20">
                {argRows.map((row) => (
                  <div
                    key={row.id}
                    className="group/arg grid grid-cols-[minmax(10rem,0.8fr)_minmax(12rem,1.2fr)_2rem] items-center"
                  >
                    <Input
                      value={row.key}
                      onChange={(e) => updateRow(row.id, { key: e.target.value })}
                      onBlur={() => commitArgRows(argRows)}
                      className="h-8 rounded-none border-0 bg-transparent font-mono text-xs focus-visible:ring-0"
                      placeholder="NODE_VERSION"
                    />
                    <Input
                      value={row.value}
                      onChange={(e) => updateRow(row.id, { value: e.target.value })}
                      onBlur={() => commitArgRows(argRows)}
                      className="h-8 rounded-none border-0 border-l border-border/40 bg-transparent font-mono text-xs focus-visible:ring-0"
                      placeholder="18"
                    />
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => commitArgRows(argRows.filter((r) => r.id !== row.id))}
                      className="mx-auto opacity-0 group-hover/arg:opacity-100"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
