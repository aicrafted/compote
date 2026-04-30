import { useEffect, useRef, useState } from 'react';
import { Cloud, Package, Search, Star } from 'lucide-react';
import { ServiceSpec } from '@/types';
import {
  GhcrResult,
  HubResult,
  formatCount,
  hubImageRef,
  isGhcrQuery,
  makeGhcrSpec,
  makeHubSpec,
  searchDockerHub,
  searchGhcrRepository,
} from '@/lib/catalog/registry-search';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

type SearchState = 'idle' | 'loading' | 'done' | 'error';

interface RegistrySearchProps {
  onAdd: (spec: ServiceSpec) => Promise<void>;
}

export function RegistrySearch({ onAdd }: RegistrySearchProps) {
  const [query, setQuery] = useState('');
  const [hubResults, setHubResults] = useState<HubResult[]>([]);
  const [ghcrResult, setGhcrResult] = useState<GhcrResult | null>(null);
  const [state, setState] = useState<SearchState>('idle');
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isGhcr = isGhcrQuery(query);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setHubResults([]);
    setGhcrResult(null);
    setError('');

    if (isGhcr) {
      const parts = query.replace('ghcr.io/', '').split(':')[0].split('/');
      if (parts.length < 2 || parts.some((p) => !p)) {
        setState('idle');
        return;
      }
      setState('loading');
      timerRef.current = setTimeout(() => {
        searchGhcr(query.replace('ghcr.io/', '').split(':')[0]);
      }, 600);
    } else {
      if (query.trim().length < 2) {
        setState('idle');
        return;
      }
      setState('loading');
      timerRef.current = setTimeout(() => {
        searchHub(query.trim());
      }, 400);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, isGhcr]);

  async function searchHub(q: string) {
    try {
      const results = await searchDockerHub(q);
      setHubResults(results);
      setState('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Search failed');
      setState('error');
    }
  }

  async function searchGhcr(repo: string) {
    try {
      const result = await searchGhcrRepository(repo);
      setGhcrResult(result);
      setState('done');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'GHCR lookup failed');
      setState('error');
    }
  }

  const isEmpty = state === 'done' && hubResults.length === 0 && !ghcrResult;

  return (
    <div className="flex flex-col h-[60vh]">
      <div className="p-4 pb-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/50" size={13} />
            <Input
              autoFocus
              placeholder="nginx  or  ghcr.io/owner/repo"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/40">
            {isGhcr
              ? <><Cloud size={11} /> GHCR</>
              : <><Package size={11} /> Docker Hub</>
            }
          </div>
        </div>

        {state === 'loading' && (
          <p className="text-[11px] text-muted-foreground/40 animate-pulse">Searching...</p>
        )}
        {state === 'error' && (
          <p className="text-[11px] text-destructive/70">{error}</p>
        )}
        {isEmpty && (
          <p className="text-[11px] text-muted-foreground/40">No results for "{query}"</p>
        )}
      </div>

      <ScrollArea className="flex-1 px-4 pb-4">
        {isGhcr && ghcrResult ? (
          <GhcrResultCard result={ghcrResult} onAdd={() => onAdd(makeGhcrSpec(ghcrResult))} />
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {hubResults.map((result) => (
              <HubResultCard key={result.repoName} result={result} onAdd={() => onAdd(makeHubSpec(result))} />
            ))}
          </div>
        )}

        {state === 'idle' && (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Package size={28} className="text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/40">
              Type an image name to search Docker Hub
            </p>
            <p className="text-[10px] text-muted-foreground/30">
              or paste a <span className="font-mono">ghcr.io/owner/repo</span> URL for GHCR
            </p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function HubResultCard({ result, onAdd }: { result: HubResult; onAdd: () => void }) {
  const imageRef = hubImageRef(result.repoName);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/30 p-3 hover:border-border hover:bg-muted/10 transition-colors">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
          <Package size={14} className="text-muted-foreground/50" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium truncate">{imageRef}</span>
            {result.isOfficial && (
              <span className="text-[9px] font-bold uppercase tracking-widest text-primary/60 bg-primary/10 rounded px-1 py-0.5 shrink-0">
                Official
              </span>
            )}
          </div>
          {result.description && (
            <p className="line-clamp-2 text-[10px] leading-tight text-muted-foreground/50 mt-0.5">{result.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground/30">
            <span className="flex items-center gap-1"><Star size={9} />{formatCount(result.stars)}</span>
            <span className="flex items-center gap-1"><Package size={9} />{formatCount(result.pulls)}</span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onAdd} className="h-7 px-2.5 text-[10px] font-bold shrink-0">
        Add
      </Button>
    </div>
  );
}

function GhcrResultCard({ result, onAdd }: { result: GhcrResult; onAdd: () => void }) {
  const topTags = result.tags.slice(0, 5);
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/50 bg-card/30 p-3 hover:border-border hover:bg-muted/10 transition-colors">
      <div className="flex items-start gap-2.5 min-w-0">
        <div className="flex size-8 items-center justify-center rounded-lg bg-muted/30 shrink-0">
          <Cloud size={14} className="text-muted-foreground/50" />
        </div>
        <div className="min-w-0">
          <span className="text-xs font-medium font-mono">ghcr.io/{result.repo}</span>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {topTags.map((tag) => (
              <span key={tag} className="text-[9px] font-mono text-muted-foreground/40 bg-muted/30 rounded px-1 py-0.5">
                {tag}
              </span>
            ))}
            {result.tags.length > 5 && (
              <span className="text-[9px] text-muted-foreground/30">+{result.tags.length - 5} more</span>
            )}
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onAdd} className="h-7 px-2.5 text-[10px] font-bold shrink-0">
        Add
      </Button>
    </div>
  );
}

