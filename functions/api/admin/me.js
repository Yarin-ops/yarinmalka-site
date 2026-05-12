// Returns the authenticated user info from Cloudflare Access headers (if present).
export async function onRequestGet({ request }) {
  const email = request.headers.get('Cf-Access-Authenticated-User-Email') || 'admin';
  return new Response(JSON.stringify({ authenticated: true, email }), {
    headers: { 'content-type': 'application/json' },
  });
}
