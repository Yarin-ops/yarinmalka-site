import { makeCrud } from './_store.js';

const handlers = makeCrud({
  filePath: 'assets/data/projects.json',
  key: 'projects',
  validate: (p) => {
    if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) return 'id must be lowercase slug';
    if (!p.title) return 'title required';
    if (!p.url) return 'url required';
    return null;
  },
});

export const onRequestGet = handlers.onRequestGet;
export const onRequestPut = handlers.onRequestPut;
