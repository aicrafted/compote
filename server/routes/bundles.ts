import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DIST_DIR } from '../config';

interface BundleSpec {
  id: string;
  name: string;
  description: string;
  mainServices: string[];
  optionalServices?: string[];
  recommendedProxyMode?: 'none' | 'generic' | 'caddy';
  difficulty: 'easy' | 'moderate' | 'advanced';
  resourceClass: 'light' | 'medium' | 'heavy';
  notes?: string[];
}

export function handleBundles(): Response {
  return Response.json(buildBundlesIndex());
}

function buildBundlesIndex(): BundleSpec[] {
  const byId = new Map<string, BundleSpec>();
  for (const bundle of loadBuiltinBundles()) {
    byId.set(bundle.id, bundle);
  }
  for (const bundle of loadUserBundles()) {
    byId.set(bundle.id, bundle);
  }
  return Array.from(byId.values());
}

function loadBuiltinBundles(): BundleSpec[] {
  const indexPath = path.join(DIST_DIR, 'bundles', 'bundles.json');
  if (!existsSync(indexPath)) return [];

  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8')) as BundleSpec[];
  } catch {
    return [];
  }
}

function loadUserBundles(): BundleSpec[] {
  const bundlesRoot = path.join(DATA_DIR, 'bundles');
  if (!existsSync(bundlesRoot)) return [];

  const bundles: BundleSpec[] = [];
  const bundleDirs = readdirSync(bundlesRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());

  for (const dirEntry of bundleDirs) {
    const bundlePath = path.join(bundlesRoot, dirEntry.name, 'bundle.json');
    if (!existsSync(bundlePath)) continue;

    try {
      const bundle = JSON.parse(readFileSync(bundlePath, 'utf-8')) as BundleSpec;
      const id = bundle.id || dirEntry.name;
      if (!id) continue;
      bundles.push({ ...bundle, id });
    } catch {
      continue;
    }
  }

  return bundles;
}
