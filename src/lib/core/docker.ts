export interface DockerTag {
  name: string;
  last_updated?: string;
}

export class DockerTagFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DockerTagFetchError';
  }
}

export async function fetchImageTags(image: string, customApi?: string): Promise<string[]> {
  try {
    if (customApi) {
      const response = await fetch(customApi);
      if (!response.ok) throw new Error('Failed to fetch tags from custom API');
      const data = await response.json();
      assertNoRegistryError(data);
      if (Array.isArray(data)) return data.map((tag) => typeof tag === 'string' ? tag : getTagName(tag)).filter(Boolean);
      if (hasArrayProperty(data, 'results')) return data.results.map(getTagName).filter(Boolean);
      if (hasArrayProperty(data, 'tags')) return data.tags.filter((tag): tag is string => typeof tag === 'string');
      return [];
    }

    if (image.includes('ghcr.io')) {
      const repo = image.replace('ghcr.io/', '').split(':')[0];

      try {
        const tokenRes = await fetch(`/ghcr-auth?scope=repository:${repo}:pull&service=ghcr.io`);
        if (tokenRes.ok) {
          const { token } = await tokenRes.json();
          const response = await fetch(`/ghcr/${repo}/tags/list`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (response.ok) {
            const data = await response.json();
            assertNoRegistryError(data);
            return hasArrayProperty(data, 'tags')
              ? data.tags.filter((tag): tag is string => typeof tag === 'string')
              : [];
          }
        }
      } catch (error) {
        if (error instanceof DockerTagFetchError) throw error;
        console.warn('GHCR token fetch failed, falling back to anonymous');
      }

      const response = await fetch(`/ghcr/${repo}/tags/list`);
      if (!response.ok) return [];
      const data = await response.json();
      assertNoRegistryError(data);
      return hasArrayProperty(data, 'tags')
        ? data.tags.filter((tag): tag is string => typeof tag === 'string')
        : [];
    }

    let fullImage = image.includes('/') ? image : `library/${image}`;
    const lastSlash = fullImage.lastIndexOf('/');
    const lastColon = fullImage.lastIndexOf(':');
    fullImage = lastColon > lastSlash ? fullImage.slice(0, lastColon) : fullImage;

    if (fullImage.split('/')[0].includes('.')) {
      return [];
    }

    const response = await fetch(`/docker-hub/repositories/${fullImage}/tags?page_size=30`);
    if (!response.ok) {
      console.warn(`Docker Hub fetch failed for ${fullImage}, status: ${response.status}`);
      return [];
    }

    const data = await response.json();
    assertNoRegistryError(data);
    return hasArrayProperty(data, 'results') ? data.results.map(getTagName).filter(Boolean) : [];
  } catch (error) {
    if (error instanceof DockerTagFetchError) {
      throw error;
    }
    console.error('Error fetching docker tags:', error);
    return [];
  }
}

function assertNoRegistryError(data: unknown): void {
  if (!data || typeof data !== 'object') return;

  const body = data as Record<string, unknown>;
  const detail = typeof body.detail === 'string' ? body.detail : '';
  const message = typeof body.message === 'string' ? body.message : '';
  const error = typeof body.error === 'string' ? body.error : '';
  const text = `${detail} ${message} ${error}`.toLowerCase();

  if (text.includes('rate limit')) {
    throw new DockerTagFetchError('Docker Hub rate limit exceeded. Try again later.');
  }

  if (detail && !hasArrayProperty(data, 'results') && !hasArrayProperty(data, 'tags')) {
    throw new DockerTagFetchError(detail);
  }
}

function hasArrayProperty<K extends string>(data: unknown, key: K): data is Record<K, unknown[]> {
  return Boolean(data && typeof data === 'object' && Array.isArray((data as Record<K, unknown>)[key]));
}

function getTagName(tag: unknown): string {
  if (typeof tag === 'string') return tag;
  if (!tag || typeof tag !== 'object') return '';
  const name = (tag as Partial<DockerTag>).name;
  return typeof name === 'string' ? name : '';
}
