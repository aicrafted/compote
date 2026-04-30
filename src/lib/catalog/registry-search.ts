import { ServiceSpec } from '@/types';

export interface HubResult {
  repoName: string;
  description: string;
  stars: number;
  pulls: number;
  isOfficial: boolean;
}

export interface GhcrResult {
  repo: string;
  tags: string[];
}

interface DockerHubRepository {
  repo_name?: unknown;
  short_description?: unknown;
  star_count?: unknown;
  pull_count?: unknown;
  is_official?: unknown;
}

function slugify(value: string): string {
  return value.replace(/[/:.]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

export function hubImageRef(repoName: string): string {
  return repoName.startsWith('library/') ? repoName.slice('library/'.length) : repoName;
}

export function isGhcrQuery(query: string): boolean {
  return query.startsWith('ghcr.io/');
}

export async function searchDockerHub(query: string): Promise<HubResult[]> {
  const res = await fetch(`/docker-hub/search/repositories/?query=${encodeURIComponent(query)}&page_size=12`);
  if (!res.ok) throw new Error(`Docker Hub error ${res.status}`);

  const data = asRecord(await res.json());
  const results = Array.isArray(data.results) ? data.results : [];

  return results.map((raw) => {
    const result = raw as DockerHubRepository;
    return {
      repoName: asString(result.repo_name),
      description: asString(result.short_description),
      stars: asNumber(result.star_count),
      pulls: asNumber(result.pull_count),
      isOfficial: result.is_official === true,
    };
  }).filter((result) => result.repoName);
}

export async function searchGhcrRepository(repo: string): Promise<GhcrResult> {
  let token: string | null = null;
  const tokenRes = await fetch(`/ghcr-auth?scope=repository:${repo}:pull&service=ghcr.io`);
  if (tokenRes.ok) {
    const body = asRecord(await tokenRes.json());
    token = asString(body.token) || null;
  }

  const tagsRes = await fetch(`/ghcr/${repo}/tags/list`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!tagsRes.ok) throw new Error(`Image not found or private (${tagsRes.status})`);

  const tagsData = asRecord(await tagsRes.json());
  const tags = Array.isArray(tagsData.tags)
    ? tagsData.tags.filter((tag): tag is string => typeof tag === 'string')
    : [];

  return { repo, tags };
}

export function makeHubSpec(result: HubResult): ServiceSpec {
  const imageRef = hubImageRef(result.repoName);
  const id = slugify(result.repoName);
  return {
    id,
    name: imageRef,
    category: 'OTHER',
    categories: ['OTHER'],
    description: result.description,
    image: `${imageRef}:latest`,
    tags: [],
    containerPorts: [],
    requires: [],
    requiredEnv: [],
  };
}

export function makeGhcrSpec(result: GhcrResult): ServiceSpec {
  const id = slugify(`ghcr-${result.repo}`);
  const tag = result.tags.includes('latest') ? 'latest' : (result.tags[0] ?? 'latest');
  return {
    id,
    name: result.repo.split('/').pop() ?? result.repo,
    category: 'OTHER',
    categories: ['OTHER'],
    description: `ghcr.io/${result.repo}`,
    image: `ghcr.io/${result.repo}:${tag}`,
    tags: [],
    containerPorts: [],
    requires: [],
    requiredEnv: [],
  };
}

