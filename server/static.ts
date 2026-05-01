import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DIST_DIR } from './config';

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
};

export function handleStatic(request: Request): Response {
  const url = new URL(request.url);
  const pathname = decodeURIComponent(url.pathname);

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const catalogFile = resolveMountedFile(pathname, 'catalog');
  if (catalogFile) return fileResponse(catalogFile);

  const bundleFile = resolveMountedFile(pathname, 'bundles');
  if (bundleFile) return fileResponse(bundleFile);

  const distFile = resolveFile(DIST_DIR, pathname);
  if (distFile) return fileResponse(distFile);

  return fileResponse(path.join(DIST_DIR, 'index.html'));
}

function resolveMountedFile(pathname: string, segment: 'catalog' | 'bundles'): string | null {
  if (!pathname.startsWith(`/${segment}/`)) return null;
  const relativePath = pathname.slice(segment.length + 2);
  return resolveFile(path.join(DIST_DIR, segment), relativePath) ?? resolveFile(path.join(DATA_DIR, segment), relativePath);
}

function resolveFile(root: string, requestPath: string): string | null {
  const relativePath = requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(root, relativePath);
  const rootPath = path.resolve(root);

  if (filePath !== rootPath && !filePath.startsWith(`${rootPath}${path.sep}`)) {
    return null;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) return null;
  return filePath;
}

function fileResponse(filePath: string): Response {
  const extension = path.extname(filePath).toLowerCase();
  return new Response(Bun.file(filePath), {
    headers: {
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    },
  });
}
