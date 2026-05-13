import { makeCrud } from './_store.js';

const handlers = makeCrud({
  filePath: 'assets/data/faq.json',
  key: 'faqs',
  validate: (f) => {
    if (!f.id || !/^[a-z0-9-]+$/.test(f.id)) return 'id must be lowercase slug';
    if (!f.question) return 'question required';
    if (!f.answer) return 'answer required';
    return null;
  },
});

export const onRequestGet = handlers.onRequestGet;
export const onRequestPut = handlers.onRequestPut;
