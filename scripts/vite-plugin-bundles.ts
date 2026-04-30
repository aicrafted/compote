import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

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

const PUBLIC_BUNDLES_ROOT = path.resolve(process.cwd(), 'public', 'bundles');

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function buildBundles() {
  ensureDir(PUBLIC_BUNDLES_ROOT);

  const bundles: BundleSpec[] = [];
  const bundleDirs = fs.existsSync(PUBLIC_BUNDLES_ROOT)
    ? fs.readdirSync(PUBLIC_BUNDLES_ROOT, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];

  for (const dirEntry of bundleDirs) {
    const bundleDir = path.join(PUBLIC_BUNDLES_ROOT, dirEntry.name);
    const bundlePath = path.join(bundleDir, 'bundle.json');
    if (!fs.existsSync(bundlePath)) continue;

    const raw = fs.readFileSync(bundlePath, 'utf-8');
    const bundle = JSON.parse(raw) as BundleSpec;
    const id = bundle.id || dirEntry.name;
    if (!id) continue;

    bundles.push({ ...bundle, id });
  }

  const indexPath = path.join(PUBLIC_BUNDLES_ROOT, 'bundles.json');
  fs.writeFileSync(indexPath, JSON.stringify(bundles, null, 2));
}

export function bundlesPlugin(): Plugin {
  return {
    name: 'bundles-plugin',
    buildStart() {
      buildBundles();
    },
    configureServer() {
      buildBundles();
    },
  };
}
