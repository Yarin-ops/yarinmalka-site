import { readJson, json, errorResponse } from './_store.js';

const OWNER = 'Yarin-ops';
const REPO = 'yarinmalka-site';
const BRANCH = 'main';

function ghHeaders(env) {
  return {
    'authorization': `Bearer ${env.GITHUB_TOKEN}`,
    'accept': 'application/vnd.github+json',
    'user-agent': 'yarinmalka-admin',
  };
}

async function countDirFiles(env, path, ext) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,
    { headers: ghHeaders(env) }
  );
  if (!res.ok) return 0;
  const list = await res.json();
  return list.filter(f => f.name.endsWith(ext)).length;
}

async function getCommits(env, limit = 8) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=${limit}`,
    { headers: ghHeaders(env) }
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
    const [projData, guidesCount, commits, subs] = await Promise.all([
      readJson(env, 'assets/data/projects.json').catch(() => ({ content: { projects: [] } })),
      countDirFiles(env, 'guides', '.html'),
      getCommits(env, 8),
      getMailerLiteCount(env),
    ]);

    const projects = projData.content.projects || [];
    return json({
      projects: {
        total: projects.length,
        featured: projects.filter(p => p.featured).length,
      },
      guides: { total: guidesCount },
      subscribers: { total: subs },
      commits,
      lastDeploy: commits[0]?.date || null,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}
