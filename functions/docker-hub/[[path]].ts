export const onRequest: PagesFunction = async ({ request, params }) => {
  const path = (params.path as string[]).join('/');
  const url = new URL(request.url);
  const upstream = `https://hub.docker.com/v2/${path}${url.search}`;
  const res = await fetch(upstream, {
    method: request.method,
    headers: { Accept: 'application/json' },
  });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
