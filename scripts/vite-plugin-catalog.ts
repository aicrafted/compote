import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

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
  source: 'builtin';
  tags?: string[];
  resourceClass?: string;
  iconSVG?: boolean;
}

const PUBLIC_CATALOG_ROOT = path.resolve(process.cwd(), 'public', 'catalog');

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildCatalog() {
  ensureDir(PUBLIC_CATALOG_ROOT);

  const entries: CatalogEntry[] = [];
  const serviceDirs = fs.existsSync(PUBLIC_CATALOG_ROOT)
    ? fs.readdirSync(PUBLIC_CATALOG_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  for (const dirEntry of serviceDirs) {
    const serviceDir = path.join(PUBLIC_CATALOG_ROOT, dirEntry.name);
    const metadataPath = path.join(serviceDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      continue;
    }

    const raw = fs.readFileSync(metadataPath, 'utf-8');
    const metadata = JSON.parse(raw) as RawCatalogMetadata;
    const serviceId = (metadata.id || dirEntry.name).trim();
    if (!serviceId) {
      continue;
    }

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
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  const indexPath = path.join(PUBLIC_CATALOG_ROOT, 'catalog.json');
  fs.writeFileSync(indexPath, JSON.stringify(entries, null, 2));
}

function normalizeCategories(category?: string, categories?: string[]): string[] {
  const values = categories?.length ? categories : [category || 'OTHER'];
  return Array.from(new Set(values.map((value) => String(value || '').toUpperCase()).filter(Boolean)));
}

export function catalogPlugin(): Plugin {
  return {
    name: 'catalog-plugin',
    buildStart() {
      buildCatalog();
    },
    configureServer() {
      buildCatalog();
    },
  };
}
