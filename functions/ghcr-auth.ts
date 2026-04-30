export const onRequest: PagesFunction = async ({ request }) => {
  const url = new URL(request.url);
  const upstream = `https://ghcr.io/token${url.search}`;
  const res = await fetch(upstream, { method: request.method });
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
