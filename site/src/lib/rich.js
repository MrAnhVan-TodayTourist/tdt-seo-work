/**
 * rich.js — sanitize HTML an toàn cho render WYSIWYG qua set:html.
 * Dùng cho các field "wysiwyg" ở Quản lý Trang (footer/header/giới thiệu/liên hệ).
 *
 * Module nằm trong src/lib/ nên KHÔNG bị copyLayout ghi đè (an toàn).
 */
import sanitizeHtml from 'sanitize-html';

/**
 * Chuẩn hoá link nội bộ do admin nhập trong SunEditor: thêm '/' vào cuối.
 *
 * Vì sao cần: build dùng `build.format: 'directory'` nên '/vi/about' bị GitHub
 * Pages trả 301 → '/vi/about/'. Link do admin gõ tay trong content JSON KHÔNG
 * đi qua `href()` (lib/content.js) nên phải chuẩn hoá ở đây — nếu không mỗi link
 * footer tốn 1 redirect.
 *
 * Bỏ qua: link ngoài, protocol-relative ('//cdn...'), '/', link đã có '/' cuối,
 * và file tĩnh (segment cuối chứa '.' — vd .jpg, .pdf, .html).
 */
/**
 * Link nội bộ (cùng domain) phải được Google theo dõi: không nofollow, không mở tab mới.
 * Chỉ link ra ngoài mới giữ 'noopener nofollow' + target _blank.
 */
const SITE_HOST_RE = /^https?:\/\/(www\.)?todaytourist\.com(\/|$)/i;
export function linkTransform(tagName, attribs) {
  const href = String(attribs.href || '');
  const internal = (href.startsWith('/') && !href.startsWith('//')) || SITE_HOST_RE.test(href);
  if (internal) {
    const { target, rel, ...rest } = attribs;
    return { tagName: 'a', attribs: rest };
  }
  return { tagName: 'a', attribs: { ...attribs, rel: 'noopener nofollow', target: '_blank' } };
}

const INTERNAL_HREF_RE = /(href=")(\/[^"?#]*)([?#][^"]*)?(")/g;

export function normalizeInternalLinks(html) {
  return String(html || '').replace(INTERNAL_HREF_RE, (match, pre, path, suffix = '', post) => {
    if (path.startsWith('//') || path.length <= 1 || path.endsWith('/')) return match;
    if (path.split('/').pop().includes('.')) return match;
    return `${pre}${path}/${suffix}${post}`;
  });
}

export function richText(html) {
  return normalizeInternalLinks(sanitizeHtml(html || '', {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'a',
      'ul', 'ol', 'li', 'h2', 'h3',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    transformTags: {
      a: linkTransform,
    },
  }));
}

/**
 * richDoc — sanitize cho trang "Liên hệ 2" (full-document editor): cho phép
 * h1-h6, blockquote, pre, hr, bảng, ảnh, màu chữ (span style), v.v.
 */
export function richDoc(html) {
  return normalizeInternalLinks(sanitizeHtml(html || '', {
    allowedTags: [
      'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'span', 'a',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'blockquote', 'pre', 'hr',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'img', 'div', 'iframe',
    ],
    allowedAttributes: {
      a: ['href', 'target', 'rel', 'style'],
      img: ['src', 'alt', 'style'],
      iframe: ['src', 'width', 'height', 'style', 'loading', 'title', 'frameborder', 'allowfullscreen'],
      span: ['style'],
      div: ['style'],
      p: ['style'],
      ul: ['style'],
      ol: ['style'],
      li: ['style'],
      h1: ['style'], h2: ['style'], h3: ['style'], h4: ['style'], h5: ['style'], h6: ['style'],
      th: ['colspan', 'rowspan', 'style'],
      td: ['colspan', 'rowspan', 'style'],
      table: ['style'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
    transformTags: {
      a: linkTransform,
    },
  }));
}
