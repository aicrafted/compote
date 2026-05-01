import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DIST_DIR } from '../config';

interface RawCatalogMetadata {
  id?: string;
  name?: string;
  category?: string;
  categories?: string[];
  description?: string;
  image?: string;
  containerPorts?: number[];
  tags?: string[];
  resourceClass?: string;
  iconSVG?: boolean;
}

interface CatalogEntry {
  id: string;
  name: string;
  category: string;
  categories?: string[];
  description: string;
  source: 'builtin' | 'user';
  tags?: string[];
  resourceClass?: string;
  iconSVG?: boolean;
}

export function handleCatalog(): Response {
  return Response.json(buildCatalogIndex());
}

export async function handleCatalogUpload(request: Request, id: string): Promise<Response> {
  const validation = validateId(id);
  if (validation) return jsonError(validation);

  const form = await request.formData();
  const metadataText = form.get('metadata');
  const composeText = form.get('compose');
  const icon = form.get('icon');

  if (typeof metadataText !== 'string') return jsonError('metadata is required');
  if (typeof composeText !== 'string') return jsonError('compose is required');

  let metadata: RawCatalogMetadata;
  try {
    metadata = JSON.parse(metadataText) as RawCatalogMetadata;
  } catch {
    return jsonError('metadata must be valid JSON');
  }

  const metadataError = validateMetadata(metadata);
  if (metadataError) return jsonError(metadataError);
  const iconExtension = icon instanceof File && icon.size > 0
    ? icon.type === 'image/svg+xml'
      ? 'svg'
      : icon.type === 'image/png'
        ? 'png'
        : null
    : null;
  if (icon instanceof File && icon.size > 0 && !iconExtension) return jsonError('icon must be SVG or PNG');

  const entry = toCatalogEntry(id, metadata, 'user');
  const serviceDir = path.join(DATA_DIR, 'catalog', id);
  mkdirSync(serviceDir, { recursive: true });
  writeFileSync(path.join(serviceDir, 'metadata.json'), JSON.stringify({ ...metadata, id }, null, 2));
  writeFileSync(path.join(serviceDir, 'compose-part.yml'), composeText);

  if (icon instanceof File && icon.size > 0 && iconExtension) {
    writeFileSync(path.join(serviceDir, `icon.${iconExtension}`), Buffer.from(await icon.arrayBuffer()));
  }

  return Response.json(entry, { status: 201 });
}

export function handleCatalogDelete(id: string): Response {
  const validation = validateId(id);
  if (validation) return jsonError(validation);

  const builtinDir = path.join(DIST_DIR, 'catalog', id);
  if (existsSync(builtinDir)) return jsonError('builtin services cannot be deleted', 403);

  const serviceDir = path.join(DATA_DIR, 'catalog', id);
  if (!existsSync(serviceDir)) return jsonError('service not found', 404);

  rmSync(serviceDir, { recursive: true, force: true });
  return new Response(null, { status: 204 });
}

function buildCatalogIndex(): CatalogEntry[] {
  const byId = new Map<string, CatalogEntry>();
  for (const entry of loadBuiltinEntries()) {
    byId.set(entry.id, entry);
  }
  for (const entry of loadUserEntries()) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function loadBuiltinEntries(): CatalogEntry[] {
  const indexPath = path.join(DIST_DIR, 'catalog', 'catalog.json');
  if (!existsSync(indexPath)) return [];

  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as CatalogEntry[];
  } catch {
    return [];
  }
}

function loadUserEntries(): CatalogEntry[] {
  const catalogRoot = path.join(DATA_DIR, 'catalog');
  if (!existsSync(catalogRoot)) return [];

  const entries: CatalogEntry[] = [];
  const serviceDirs = readdirSync(catalogRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const dirEntry of serviceDirs) {
    const metadataPath = path.join(catalogRoot, dirEntry.name, 'metadata.json');
    if (!existsSync(metadataPath)) continue;

    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8')) as RawCatalogMetadata;
      const serviceId = (metadata.id || dirEntry.name).trim();
      if (!serviceId) continue;

      const categories = normalizeCategories(metadata.category, metadata.categories);
      entries.push(toCatalogEntry(serviceId, metadata, 'user', categories));
    } catch {
      continue;
    }
  }

  return entries;
}

function toCatalogEntry(
  id: string,
  metadata: RawCatalogMetadata,
  source: CatalogEntry['source'],
  normalizedCategories = normalizeCategories(metadata.category, metadata.categories)
): CatalogEntry {
  return {
    id,
    name: metadata.name || id,
    category: normalizedCategories[0],
    categories: normalizedCategories,
    description: metadata.description || '',
    source,
    tags: metadata.tags || [],
    resourceClass: metadata.resourceClass,
    ...(metadata.iconSVG !== undefined ? { iconSVG: metadata.iconSVG } : {}),
  };
}

function validateId(id: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return 'id must be kebab-case';
  }
  return null;
}

function validateMetadata(metadata: RawCatalogMetadata): string | null {
  if (!isNonEmptyString(metadata.name)) return 'metadata.name is required';
  if (!isNonEmptyString(metadata.category)) return 'metadata.category is required';
  if (!isNonEmptyString(metadata.image)) return 'metadata.image is required';
  if (!Array.isArray(metadata.containerPorts) || metadata.containerPorts.some((port) => typeof port !== 'number')) {
    return 'metadata.containerPorts must be an array of numbers';
  }
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function jsonError(error: string, status = 400): Response {
  return Response.json({ error }, { status });
}

function normalizeCategories(category?: string, categories?: string[]): string[] {
  const values = categories?.length ? categories : [category || 'OTHER'];
  return Array.from(new Set(values.map((value) => String(value || '').toUpperCase()).filter(Boolean)));
}
