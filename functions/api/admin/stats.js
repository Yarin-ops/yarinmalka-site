// Returns aggregated stats for the admin dashboard.
const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const BRANCH = 'main';

async function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

async function getJsonFromRepo(env, path) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: await ghHeaders(env) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const binary = atob(data.content.replace(/\n/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder('utf-8').decode(bytes));
}

async function countGuides(env) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/guides?ref=${BRANCH}`,
    { headers: await ghHeaders(env) }
  );
  if (!res.ok) return 0;
  const list = await res.json();
  return list.filter(f => f.name.endsWith('.html')).length;
}

async function getCommits(env, limit = 8) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=${limit}`,
    { headers: await ghHeaders(env) }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.map(c => ({
    sha: c.sha.substring(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author.name,
    date: c.commit.author.date,
  }));
}

async function getMailerLiteCount(env) {
  if (!env.MAILERLITE_TOKEN || !env.MAILERLITE_GROUP_ID) return null;
  try {
    const res = await fetch(
      `https://connect.mailerlite.com/api/groups/${env.MAILERLITE_GROUP_ID}`,
      { headers: { 'Authorization': `Bearer ${env.MAILERLITE_TOKEN}`, 'Accept': 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.active_count ?? null;
  } catch (_) { return null; }
}

export async function onRequestGet({ env }) {
  try {
    const [projects, guides, commits, subs] = await Promise.all([
      getJsonFromRepo(env, 'assets/data/projects.json'),
      countGuides(env),
      getCommits(env, 8),
      getMailerLiteCount(env),
    ]);

    return new Response(JSON.stringify({
      projects: {
        total: projects?.projects?.length || 0,
        featured: (projects?.projects || []).filter(p => p.featured).length,
      },
      guides: { total: guides },
      subscribers: { total: subs },
      commits,
      lastDeploy: commits[0]?.date || null,
    }), { headers: { 'content-type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
