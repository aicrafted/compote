import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DIST_DIR } from '../config';

interface BundleSpec {
  id: string;
  name: string;
  description: string;
  source?: 'builtin' | 'user';
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

export async function handleBundleUpload(request: Request, id: string): Promise<Response> {
  const validation = validateId(id);
  if (validation) return jsonError(validation);

  const form = await request.formData();
  const bundleText = form.get('bundle');
  if (typeof bundleText !== 'string') return jsonError('bundle is required');

  let bundle: BundleSpec;
  try {
    bundle = JSON.parse(bundleText) as BundleSpec;
  } catch {
    return jsonError('bundle must be valid JSON');
  }

  const bundleError = validateBundle(bundle, id);
  if (bundleError) return jsonError(bundleError);

  const userBundle = { ...bundle, id, source: 'user' as const };
  const bundleDir = path.join(DATA_DIR, 'bundles', id);
  mkdirSync(bundleDir, { recursive: true });
  writeFileSync(path.join(bundleDir, 'bundle.json'), JSON.stringify(userBundle, null, 2));

  return Response.json(userBundle, { status: 201 });
}

export function handleBundleDelete(id: string): Response {
  const validation = validateId(id);
  if (validation) return jsonError(validation);

  const builtinDir = path.join(DIST_DIR, 'bundles', id);
  if (existsSync(builtinDir)) return jsonError('builtin bundles cannot be deleted', 403);

  const bundleDir = path.join(DATA_DIR, 'bundles', id);
  if (!existsSync(bundleDir)) return jsonError('bundle not found', 404);

  rmSync(bundleDir, { recursive: true, force: true });
  return new Response(null, { status: 204 });
}

function buildBundlesIndex(): BundleSpec[] {
  const byId = new Map<string, BundleSpec>();
  for (const bundle of loadBuiltinBundles()) {
    byId.set(bundle.id, { ...bundle, source: 'builtin' });
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
      bundles.push({ ...bundle, id, source: 'user' });
    } catch {
      continue;
    }
  }

  return bundles;
}

function validateId(id: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    return 'id must be kebab-case';
  }
  return null;
}

function validateBundle(bundle: BundleSpec, id: string): string | null {
  if (bundle.id !== id) return 'bundle.id must match the URL id';
  if (!isNonEmptyString(bundle.name)) return 'bundle.name is required';
  if (!Array.isArray(bundle.mainServices) || bundle.mainServices.length === 0 || bundle.mainServices.some((service) => !isNonEmptyString(service))) {
    return 'bundle.mainServices must be a non-empty array of strings';
  }
  if (!['easy', 'moderate', 'advanced'].includes(bundle.difficulty)) return 'bundle.difficulty is invalid';
  if (!['light', 'medium', 'heavy'].includes(bundle.resourceClass)) return 'bundle.resourceClass is invalid';
  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function jsonError(error: string, status = 400): Response {
  return Response.json({ error }, { status });
}
