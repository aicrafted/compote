import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DIST_DIR } from '../config';

interface RawCatalogMetadata {
  id?: string;
  name?: string;
  category?: string;
  categories?: string[];
  description?: string;
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
      entries.push({
        id: serviceId,
        name: metadata.name || serviceId,
        category: categories[0],
        categories,
        description: metadata.description || '',
        source: 'builtin',
        tags: metadata.tags || [],
        resourceClass: metadata.resourceClass,
        ...(metadata.iconSVG !== undefined ? { iconSVG: metadata.iconSVG } : {}),
      });
    } catch {
      continue;
    }
  }

  return entries;
}

function normalizeCategories(category?: string, categories?: string[]): string[] {
  const values = categories?.length ? categories : [category || 'OTHER'];
  return Array.from(new Set(values.map((value) => String(value || '').toUpperCase()).filter(Boolean)));
}
