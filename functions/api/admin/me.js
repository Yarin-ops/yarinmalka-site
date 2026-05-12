// Returns the authenticated user info from Cloudflare Access headers.
export async function onRequestGet({ request }) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!email) {
    return new Response(JSON.stringify({ authenticated: false }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ authenticated: true, email }), {
    headers: { 'content-type': 'application/json' },
  });
}
