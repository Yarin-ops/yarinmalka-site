import { readJson, writeJson, json, errorResponse } from './_store.js';

const FILE_PATH = 'assets/data/inquiries.json';

export async function onRequestGet({ env }) {
  try {
    const { content } = await readJson(env, FILE_PATH);
    const list = content.inquiries || [];
    return json({
      inquiries: list,
      total: list.length,
      newCount: list.filter(i => i.status === 'new').length,
    });
  } catch (e) {
    return errorResponse(e.message);
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const { id, status, deleteId } = await request.json();
    const { content, sha } = await readJson(env, FILE_PATH);
    let list = content.inquiries || [];
    let message;
    if (deleteId) {
      list = list.filter(i => i.id !== deleteId);
      message = `Delete inquiry ${deleteId.substring(0, 8)}`;
    } else if (id && status) {
      list = list.map(i => i.id === id ? { ...i, status } : i);
      message = `Mark inquiry ${id.substring(0, 8)} as ${status}`;
    } else {
      return errorResponse('missing id+status or deleteId', 400);
    }
    await writeJson(env, FILE_PATH, { inquiries: list }, sha, message);
    return json({ ok: true });
  } catch (e) {
    return errorResponse(e.message);
  }
}
