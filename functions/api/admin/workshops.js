import { makeCrud } from './_store.js';

const handlers = makeCrud({
  filePath: 'assets/data/workshops.json',
  key: 'workshops',
  validate: (w) => {
    if (!w.id || !/^[a-z0-9-]+$/.test(w.id)) return 'id must be lowercase slug';
    if (!w.title) return 'title required';
    if (!w.description) return 'description required';
    return null;
  },
});

export const onRequestGet = handlers.onRequestGet;
export const onRequestPut = handlers.onRequestPut;
