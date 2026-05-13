import { makeCrud } from './_store.js';

const handlers = makeCrud({
  filePath: 'assets/data/testimonials.json',
  key: 'testimonials',
  validate: (t) => {
    if (!t.id || !/^[a-z0-9-]+$/.test(t.id)) return 'id must be lowercase slug';
    if (!t.name) return 'name required';
    if (!t.quote) return 'quote required';
    return null;
  },
});

export const onRequestGet = handlers.onRequestGet;
export const onRequestPut = handlers.onRequestPut;
