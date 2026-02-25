/**
 * Server-seitige PDF-Generierung aus TipTap-HTML-Templates.
 * Verwendet @react-pdf/renderer mit Briefpapier-Hintergrund.
 * Nur in API-Routes verwenden – nicht im Client.
 */
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  renderToBuffer,
} from '@react-pdf/renderer';
import { substituteVariables } from './templateVariables';

// DIN A4 Maße in pt (1 pt = 1/72 inch)
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

// DIN 5008 Ränder
const MARGIN_TOP = 113;    // ~4 cm
const MARGIN_LEFT = 70;    // ~2,5 cm
const MARGIN_RIGHT = 70;   // ~2,5 cm
const MARGIN_BOTTOM = 57;  // ~2 cm

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#1a1a1a',
  },
  letterhead: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
  },
  content: {
    marginTop: MARGIN_TOP,
    marginLeft: MARGIN_LEFT,
    marginRight: MARGIN_RIGHT,
    marginBottom: MARGIN_BOTTOM,
  },
  paragraph: {
    marginBottom: 8,
  },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginBottom: 10, marginTop: 6 },
  h2: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginBottom: 8, marginTop: 5 },
  h3: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginBottom: 6, marginTop: 4 },
  listItem: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: { width: 14, fontSize: 11 },
  listText: { flex: 1 },
});

// ------ HTML-Parser ------

type HtmlNode =
  | { type: 'text'; content: string; bold?: boolean; italic?: boolean; underline?: boolean }
  | { type: 'block'; tag: string; children: HtmlNode[] };

function parseHtml(html: string): HtmlNode[] {
  // Einfacher rekursiver Parser für TipTap-HTML-Output
  const nodes: HtmlNode[] = [];
  const div = { innerHTML: html };
  void div; // used for type reference only

  // Reguläre Ausdrücke für bekannte Tags
  const blockTagRe = /<(p|h1|h2|h3|ul|ol|li|br)\b[^>]*>([\s\S]*?)<\/\1>|<br\s*\/?>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = blockTagRe.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const text = stripTags(html.slice(lastIndex, match.index));
      if (text.trim()) nodes.push({ type: 'text', content: text });
    }
    const tag = match[1]?.toLowerCase();
    const inner = match[2] ?? '';
    if (tag === 'br' || match[0] === '<br>') {
      nodes.push({ type: 'text', content: '\n' });
    } else if (tag) {
      nodes.push({ type: 'block', tag, children: parseInline(inner) });
    }
    lastIndex = blockTagRe.lastIndex;
  }

  if (lastIndex < html.length) {
    const rest = stripTags(html.slice(lastIndex));
    if (rest.trim()) nodes.push({ type: 'text', content: rest });
  }

  return nodes;
}

function parseInline(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  const inlineRe = /<(strong|b|em|i|u)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // eslint-disable-next-line no-cond-assign
  while ((match = inlineRe.exec(html)) !== null) {
    if (match.index > lastIndex) {
      const text = stripTags(html.slice(lastIndex, match.index));
      if (text) nodes.push({ type: 'text', content: decodeHtmlEntities(text) });
    }
    const tag = match[1].toLowerCase();
    const inner = decodeHtmlEntities(stripTags(match[2]));
    nodes.push({
      type: 'text',
      content: inner,
      bold: tag === 'strong' || tag === 'b',
      italic: tag === 'em' || tag === 'i',
      underline: tag === 'u',
    });
    lastIndex = inlineRe.lastIndex;
  }

  if (lastIndex < html.length) {
    const text = decodeHtmlEntities(stripTags(html.slice(lastIndex)));
    if (text) nodes.push({ type: 'text', content: text });
  }

  return nodes;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ------ React-PDF Renderer ------

function renderInlineNode(node: HtmlNode, index: number): React.ReactElement {
  if (node.type === 'text') {
    const fontFamily =
      node.bold && node.italic
        ? 'Helvetica-BoldOblique'
        : node.bold
        ? 'Helvetica-Bold'
        : node.italic
        ? 'Helvetica-Oblique'
        : 'Helvetica';
    return React.createElement(
      Text,
      {
        key: index,
        style: {
          fontFamily,
          textDecoration: node.underline ? 'underline' : 'none',
        },
      },
      node.content
    );
  }
  return React.createElement(Text, { key: index }, '');
}

function renderBlock(node: HtmlNode, index: number): React.ReactElement {
  if (node.type === 'text') {
    return React.createElement(Text, { key: index, style: styles.paragraph }, node.content);
  }

  const { tag, children } = node;

  if (tag === 'h1') {
    return React.createElement(
      Text,
      { key: index, style: styles.h1 },
      children.map((c, i) => renderInlineNode(c, i))
    );
  }
  if (tag === 'h2') {
    return React.createElement(
      Text,
      { key: index, style: styles.h2 },
      children.map((c, i) => renderInlineNode(c, i))
    );
  }
  if (tag === 'h3') {
    return React.createElement(
      Text,
      { key: index, style: styles.h3 },
      children.map((c, i) => renderInlineNode(c, i))
    );
  }
  if (tag === 'ul') {
    return React.createElement(
      View,
      { key: index },
      children.filter(c => c.type === 'block' && c.tag === 'li').map((li, i) =>
        React.createElement(
          View,
          { key: i, style: styles.listItem },
          React.createElement(Text, { style: styles.bullet }, '•'),
          React.createElement(
            Text,
            { style: styles.listText },
            (li as { type: 'block'; tag: string; children: HtmlNode[] }).children.map((c, j) =>
              renderInlineNode(c, j)
            )
          )
        )
      )
    );
  }
  if (tag === 'ol') {
    const counter = { n: 1 };
    return React.createElement(
      View,
      { key: index },
      children.filter(c => c.type === 'block' && c.tag === 'li').map((li, i) => {
        const n = counter.n++;
        return React.createElement(
          View,
          { key: i, style: styles.listItem },
          React.createElement(Text, { style: styles.bullet }, `${n}.`),
          React.createElement(
            Text,
            { style: styles.listText },
            (li as { type: 'block'; tag: string; children: HtmlNode[] }).children.map((c, j) =>
              renderInlineNode(c, j)
            )
          )
        );
      })
    );
  }
  if (tag === 'p') {
    return React.createElement(
      Text,
      { key: index, style: styles.paragraph },
      children.length > 0
        ? children.map((c, i) => renderInlineNode(c, i))
        : ' '
    );
  }
  // Fallback
  return React.createElement(
    Text,
    { key: index, style: styles.paragraph },
    children.map((c, i) => renderInlineNode(c, i))
  );
}

function buildPdfDocument(html: string, letterheadPath: string | null): React.ReactElement {
  const blocks = parseHtml(html);

  const pageContent: React.ReactElement[] = [];

  if (letterheadPath) {
    // Absolutes Dateisystem-Pfad für @react-pdf/renderer
    const absPath = `${process.cwd()}/public${letterheadPath}`;
    pageContent.push(
      React.createElement(Image, {
        key: 'letterhead',
        src: absPath,
        style: styles.letterhead,
      })
    );
  }

  pageContent.push(
    React.createElement(
      View,
      { key: 'content', style: styles.content },
      blocks.map((block, i) => renderBlock(block, i))
    )
  );

  const page = React.createElement(Page, { key: 'page', size: 'A4', style: styles.page }, ...pageContent);
  return React.createElement(Document, {}, page);
}

export async function generateTemplatePdf(
  htmlContent: string,
  variables: Record<string, string>,
  letterheadPath: string | null
): Promise<Buffer> {
  const substituted = substituteVariables(htmlContent, variables);
  const doc = buildPdfDocument(substituted, letterheadPath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(doc as any);
  return Buffer.from(buffer);
}
