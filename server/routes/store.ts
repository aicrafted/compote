import { storeDel, storeGet, storePut } from '../db';

const STORE_PREFIX = '/api/store/';

export async function handleStore(request: Request, pathname: string): Promise<Response> {
  const key = decodeURIComponent(pathname.slice(STORE_PREFIX.length));

  if (!key) {
    return new Response('Missing store key', { status: 400 });
  }

  if (request.method === 'GET') {
    const row = storeGet.get(key);
    if (!row) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(row.value, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (request.method === 'PUT') {
    const body = await request.text();
    storePut.run(key, body);
    return new Response(null, { status: 204 });
  }

  if (request.method === 'DELETE') {
    storeDel.run(key);
    return new Response(null, { status: 204 });
  }

  return new Response('Method not allowed', {
    status: 405,
    headers: { Allow: 'GET, PUT, DELETE' },
  });
}
