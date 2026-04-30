export const onRequest: PagesFunction = async ({ request, params }) => {
  const path = (params.path as string[]).join('/');
  const url = new URL(request.url);
  const upstream = `https://ghcr.io/v2/${path}${url.search}`;
  const authHeader = request.headers.get('Authorization');
  const res = await fetch(upstream, {
    method: request.method,
    headers: {
      Accept: 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
