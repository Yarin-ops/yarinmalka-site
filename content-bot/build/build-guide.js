#!/usr/bin/env node
/**
 * build-guide.js - convert markdown guide source -> production HTML
 *
 * Usage: node build-guide.js <path-to-markdown> [--out <output-path>]
 *
 * Reads frontmatter (YAML-style between ---/---) and markdown body.
 * Generates a complete guide HTML using template.guide.html, including
 * auto-generated TOC from h2 headings, JSON-LD, OG tags, etc.
 */

const fs = require('fs');
const path = require('path');

// ---------- frontmatter parsing ----------
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!m) throw new Error('Missing frontmatter (--- block at top of file)');
  const yaml = m[1];
  const body = m[2];
  const meta = {};
  for (const line of yaml.split('\n')) {
    const km = line.match(/^([a-z][a-z0-9_]*)\s*:\s*(.*)$/i);
    if (km) {
      let val = km[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      meta[km[1]] = val;
    }
  }
  return { meta, body };
}

// ---------- minimal markdown -> HTML ----------
// Supports the patterns the existing guides use: h2/h3, p, ul, ol, strong,
// em, code, links, note boxes (lines prefixed with `> `), inline html passthrough.
function escHTML(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(s) {
  // Links: [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, txt, url) => {
    const ext = /^https?:\/\//.test(url);
    const tgt = ext ? ' target="_blank" rel="noopener"' : '';
    return `<a href="${url}"${tgt}>${txt}</a>`;
  });
  // Bold: **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic: *text* (after bold so it doesn't conflict)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // Inline code: `code`
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  return s;
}

function slugify(text) {
  // Strip HTML, normalize, lowercase, replace spaces and punctuation with -
  return text
    .replace(/<[^>]+>/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^֐-׿\w\s-]/g, '') // keep Hebrew + word chars
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function mdToHTML(md) {
  const lines = md.split('\n');
  const out = [];
  const tocItems = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i++; continue; }

    // Pass-through HTML blocks (e.g. <figure>, <div class="note-box">)
    if (trimmed.startsWith('<') && !trimmed.startsWith('<a ')) {
      // Capture until matching close (heuristic: until empty line or another paragraph)
      const block = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '') {
        block.push(lines[i]);
        i++;
      }
      out.push('      ' + block.join('\n      '));
      continue;
    }

    // h2 with auto-id
    if (trimmed.startsWith('## ')) {
      const text = trimmed.slice(3);
      // Optional explicit id syntax: ## title {#myid}
      const idMatch = text.match(/\s*\{#([\w-]+)\}\s*$/);
      let title, id;
      if (idMatch) {
        title = text.replace(idMatch[0], '');
        id = idMatch[1];
      } else {
        title = text;
        id = slugify(text);
      }
      tocItems.push({ id, title: title.replace(/<[^>]+>/g, '').replace(/\*\*/g, '') });
      out.push(`      <h2 id="${id}">${inline(title)}</h2>`);
      i++; continue;
    }

    // h3
    if (trimmed.startsWith('### ')) {
      const text = trimmed.slice(4);
      out.push(`      <h3>${inline(text)}</h3>`);
      i++; continue;
    }

    // Note box: starts with "> "
    if (trimmed.startsWith('> ')) {
      const noteLines = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        noteLines.push(lines[i].trim().slice(2));
        i++;
      }
      out.push(`      <div class="note-box">${inline(noteLines.join(' '))}</div>`);
      continue;
    }

    // Unordered list
    if (trimmed.startsWith('- ')) {
      const items = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(`        <li>${inline(lines[i].trim().slice(2))}</li>`);
        i++;
      }
      out.push('      <ul>\n' + items.join('\n') + '\n      </ul>');
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(`        <li>${inline(lines[i].trim().replace(/^\d+\.\s/, ''))}</li>`);
        i++;
      }
      out.push('      <ol>\n' + items.join('\n') + '\n      </ol>');
      continue;
    }

    // Paragraph (collect until blank line)
    const paraLines = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() !== '' && !lines[i].trim().match(/^(#|>|-|\d+\.|<)/)) {
      paraLines.push(lines[i].trim());
      i++;
    }
    out.push(`      <p>${inline(paraLines.join(' '))}</p>`);
  }

  // Build TOC
  const tocHTML = tocItems
    .map(t => `      <li><a href="#${t.id}">${t.title}</a></li>`)
    .join('\n');

  return { content: out.join('\n\n'), toc: tocHTML };
}

// ---------- main ----------
function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: node build-guide.js <markdown-file> [--out <output-path>]');
    process.exit(1);
  }
  const mdPath = args[0];
  const outIdx = args.indexOf('--out');
  const explicitOut = outIdx > -1 ? args[outIdx + 1] : null;

  const text = fs.readFileSync(mdPath, 'utf8');
  const { meta, body } = parseFrontmatter(text);

  // Validate required fields
  const required = ['title', 'description', 'slug', 'date', 'reading_time', 'number',
                    'category', 'breadcrumb', 'h1_main', 'h1_accent', 'lead'];
  for (const f of required) {
    if (!meta[f]) throw new Error(`Missing required frontmatter field: ${f}`);
  }

  const { content, toc } = mdToHTML(body);

  // Format date for display: 2026-05-08 -> 08.05.2026
  const dateDisplay = meta.date.split('-').reverse().join('.');

  // Load template
  const templatePath = path.join(__dirname, 'template.guide.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // Replace placeholders
  const map = {
    '{{TITLE}}': meta.title,
    '{{DESCRIPTION}}': meta.description,
    '{{SLUG}}': meta.slug,
    '{{DATE}}': meta.date,
    '{{DATE_DISPLAY}}': dateDisplay,
    '{{NUMBER}}': meta.number,
    '{{READING_TIME}}': meta.reading_time,
    '{{CATEGORY}}': meta.category,
    '{{BREADCRUMB}}': meta.breadcrumb,
    '{{H1_MAIN}}': meta.h1_main,
    '{{H1_ACCENT}}': meta.h1_accent,
    '{{LEAD}}': meta.lead,
    '{{CONTENT}}': content,
    '{{TOC}}': toc,
  };

  for (const [k, v] of Object.entries(map)) {
    html = html.split(k).join(v);
  }

  // Determine output path
  const out = explicitOut ||
    path.join(__dirname, '..', 'site', 'guides', `${meta.slug}.html`);
  fs.writeFileSync(out, html, 'utf8');

  console.log(`✓ Built: ${out}`);
  console.log(`  Slug: ${meta.slug}`);
  console.log(`  TOC items: ${toc.split('\n').length}`);
  console.log(`  HTML size: ${(html.length / 1024).toFixed(1)} KB`);
  console.log('');
  console.log('Next manual steps:');
  console.log(`  1. Add a card in site/guides.html linking to /guides/${meta.slug}.html`);
  console.log(`  2. Add to JSON-LD blogPost array in site/guides.html`);
  console.log(`  3. Add to site/sitemap.xml`);
  console.log(`  4. Commit and push (use a simple ASCII commit message - CF API is picky)`);
}

main();
