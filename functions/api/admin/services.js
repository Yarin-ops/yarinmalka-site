import { makeCrud } from './_store.js';

const handlers = makeCrud({
  filePath: 'assets/data/services.json',
  key: 'services',
  validate: (s) => {
    if (!s.id || !/^[a-z0-9-]+$/.test(s.id)) return 'id must be lowercase slug';
    if (!s.title) return 'title required';
    if (!s.description) return 'description required';
    return null;
  },
});

export const onRequestGet = handlers.onRequestGet;
export const onRequestPut = handlers.onRequestPut;
