import { handleBundleDelete, handleBundles, handleBundleUpload } from './routes/bundles';
import { handleCatalog, handleCatalogDelete, handleCatalogUpload } from './routes/catalog';
import { handleStore } from './routes/store';
import { handleStatic } from './static';

const PORT = Number(process.env.PORT ?? 3000);

Bun.serve({
  port: PORT,
  hostname: '0.0.0.0',
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith('/api/store/')) return handleStore(request, path);
    if (path === '/api/catalog/index') return handleCatalog();
    if (path === '/api/bundles/index') return handleBundles();
    if (path.startsWith('/api/catalog/')) {
      const id = decodeURIComponent(path.slice('/api/catalog/'.length));
      if (request.method === 'POST') return handleCatalogUpload(request, id);
      if (request.method === 'DELETE') return handleCatalogDelete(id);
    }
    if (path.startsWith('/api/bundles/')) {
      const id = decodeURIComponent(path.slice('/api/bundles/'.length));
      if (request.method === 'POST') return handleBundleUpload(request, id);
      if (request.method === 'DELETE') return handleBundleDelete(id);
    }
    return handleStatic(request);
  },
});

console.log(`Compote listening on http://0.0.0.0:${PORT}`);
