import { readJson, writeJson, json, errorResponse } from './_store.js';

const FILE_PATH = 'assets/data/settings.json';

export async function onRequestGet({ env }) {
  try {
    const { content, sha } = await readJson(env, FILE_PATH);
    return json({ settings: content, sha });
  } catch (e) {
    return errorResponse(e.message);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json();
    if (!body.settings || typeof body.settings !== 'object') {
      return errorResponse('settings object required', 400);
    }
    const { sha } = await readJson(env, FILE_PATH);
    await writeJson(env, FILE_PATH, body.settings, sha,
      body.message || 'Update settings via admin');
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e.message);
  }
}
