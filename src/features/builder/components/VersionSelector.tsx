import React from 'react';
import { AlertTriangle, ExternalLink, Loader2, Tag as TagIcon } from 'lucide-react';
import { SuggestInput } from '@/components/ui/suggest-input';
import { fetchImageTags } from '@/lib/core/docker';
import { cn } from '@/lib/utils';

interface VersionSelectorProps {
  image: string;
  currentTag: string;
  tagsApi?: string;
  onChange: (tag: string) => void;
}

export function VersionSelector({ image, currentTag, tagsApi, onChange }: VersionSelectorProps) {
  const [tags, setTags] = React.useState<string[]>([currentTag]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loadedKey, setLoadedKey] = React.useState('');
  const currentTagRef = React.useRef(currentTag);
  const tagsUrl = getRegistryTagsUrl(image);

  currentTagRef.current = currentTag;

  React.useEffect(() => {
    setTags(currentTagRef.current ? [currentTagRef.current] : []);
    setError('');
    setLoadedKey('');
  }, [image, tagsApi]);

  const loadTags = () => {
    const key = `${image}|${tagsApi || ''}`;
    if (loading || loadedKey === key) return;

    setLoading(true);
    setError('');
    fetchImageTags(image, tagsApi)
      .then((loadedTags) => {
        setTags(Array.from(new Set([currentTag, ...loadedTags.filter(Boolean)].filter(Boolean))));
        setLoadedKey(key);
      })
      .catch((caught) => {
        setError(caught instanceof Error ? caught.message : 'Failed to fetch tags');
      })
      .finally(() => setLoading(false));
  };

  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="relative block min-w-0 flex-1" title={error || undefined}>
        <TagIcon
          size={11}
          className={cn(
            'pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2',
            error ? 'text-destructive/70' : 'text-primary/40'
          )}
        />
        <SuggestInput
          value={currentTag}
          suggestions={tags}
          onFocus={loadTags}
          onValueChange={onChange}
          onBlur={(event) => onChange(event.currentTarget.value.trim())}
          className="h-8 rounded-lg pl-7 pr-7 font-mono text-xs font-bold"
          placeholder="latest"
          spellCheck={false}
        />
        {loading && (
          <Loader2 size={12} className="pointer-events-none absolute right-2.5 top-1/2 z-10 -translate-y-1/2 animate-spin text-primary/50" />
        )}
        {!loading && error && (
          <AlertTriangle size={12} className="pointer-events-none absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-destructive/70" />
        )}
      </span>
      {!loading && tagsUrl && (
        <a
          href={tagsUrl}
          target="_blank"
          rel="noreferrer"
          title="Open tags in registry"
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground/40 transition-colors hover:text-primary"
          onMouseDown={(event) => event.preventDefault()}
        >
          <ExternalLink size={12} />
        </a>
      )}
    </span>
  );
}

function getRegistryTagsUrl(image: string): string | null {
  const imageWithoutTag = stripImageTag(image);

  if (imageWithoutTag.startsWith('ghcr.io/')) {
    return `https://${imageWithoutTag}`;
  }

  if (imageWithoutTag.split('/')[0].includes('.')) {
    return null;
  }

  const dockerHubImage = imageWithoutTag.includes('/') ? imageWithoutTag : `library/${imageWithoutTag}`;
  return `https://hub.docker.com/r/${dockerHubImage}/tags`;
}

function stripImageTag(image: string): string {
  const lastSlash = image.lastIndexOf('/');
  const lastColon = image.lastIndexOf(':');
  return lastColon > lastSlash ? image.slice(0, lastColon) : image;
}
