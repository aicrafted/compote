import { handleBundles } from './routes/bundles';
import { handleCatalog } from './routes/catalog';
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
    return handleStatic(request);
  },
});

console.log(`Compote listening on http://0.0.0.0:${PORT}`);
