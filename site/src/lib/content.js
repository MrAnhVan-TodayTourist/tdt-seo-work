import fs from 'node:fs';
import path from 'node:path';

/**
 * Content helpers — all website text lives in flat key:value JSON files
 * under `content/<lang>/*.json`. This module is the ONLY way pages read
 * that content, so no text is ever hard-coded in Astro.
 */

/**
 * Ngôn ngữ của website — CHỈ tiếng Việt.
 *
 * Bản tiếng Anh đã bị bỏ (2026-10): `/en/**` không còn được build, các URL /en/…
 * cũ được `site/scripts/build-en-redirects.mjs` sinh trang chuyển hướng về bản
 * /vi/ tương ứng. Vì vậy KHÔNG còn bước dịch Argos trong CI và `content/en` đã xoá.
 * Đây là nguồn duy nhất quyết định số ngôn ngữ (router `[lang]`, hreflang, sitemap).
 */
export const LANGS = ['vi'];
export const DEFAULT_LANG = 'vi';
/** Static sub-page slugs rendered by `[lang]/[page].astro`. */
export const PAGE_SLUGS = [
  'about',
  'tours',
  'contact',
  've-may-bay',
  'cho-thue-xe',
  'y-kien-khach-hang',
  'doi-tac',
  'dat-tour',
  'tim-tour',
  'tuyen-dung',
  'chi-duong',
];

/**
 * Trang CHỈ có bản VI và nằm ở CẤP GỐC: '/<slug>/' (KHÔNG có tiền tố ngôn ngữ,
 * cũng không có URL '/vi/<slug>/' hay '/en/<slug>/').
 *
 *   key   = slug trên URL cấp gốc
 *   value = slug trang tương đương trong PAGE_SLUGS (nguồn nội dung + bản dịch EN)
 *
 * Một trang cấp gốc là file `pages/<slug>.astro` dùng lại component của trang
 * tương đương (thường đọc cùng file content) nên nội dung luôn khớp nhau.
 *
 * Registry này là nguồn duy nhất để biết "cấp gốc", dùng ở 3 chỗ:
 *  - hreflang (lib/seo.js `alternates()`): KHÔNG phát '/en/<slug>/' → URL 404.
 *  - nút đổi ngôn ngữ ở header (langHref): đưa khách sang bản tương đương
 *    ('/vi/cho-thue-xe/', '/en/cho-thue-xe/') thay vì URL không tồn tại.
 *  - sitemap.xml.ts: thêm chính URL cấp gốc đó vào sitemap (chỉ 1 hreflang).
 */
export const ROOT_PAGE_EQUIV = {
  'dich-vu-cho-thue-xe-gia-tot-tai-dong-nai-tp-hcm': 'cho-thue-xe',
};

/**
 * Nếu pathname chỉ là MỘT trang VI-only ở cấp gốc → trả slug cấp gốc, ngược lại null.
 * '/dich-vu-a-b-c/' → 'dich-vu-a-b-c';  '/vi/dich-vu-a-b-c/' → null.
 */
export function viOnlyRootSlug(pathname) {
  const seg = String(pathname || '/').split('/').filter(Boolean);
  return seg.length === 1 && ROOT_PAGE_EQUIV[seg[0]] ? seg[0] : null;
}

/**
 * BẢN SAO ở CẤP GỐC (KHÔNG có tiền tố ngôn ngữ) của mọi trang tiếng Việt.
 *
 * GitHub Pages KHÔNG có redirect server-side, nên các URL cũ kiểu
 * 'todaytourist.com/tim-tour/' phải tồn tại thật. CI sinh chúng bằng cách copy
 * `.astro-dist/vi/**` lên root (`site/scripts/copy-vi-to-root.mjs`); ở đây chỉ
 * cần biết "path này là bản sao của path nào" để SEO trỏ đúng URL.
 *
 * Đây là tập "mục đầu tiên" của các đường dẫn công khai: 'tours' phủ cả
 * '/tours/', '/tours/<slug>/' và '/tours/khu-vuc/<region>/'.
 *
 * KHÔNG gồm 'home' (trang công cụ /vi/home/generated/ — không được lộ ra root)
 * và không tính các slug trong ROOT_PAGE_EQUIV (trang VI cấp gốc viết riêng,
 * canonical = chính nó).
 */
const VI_MIRROR_HEADS = new Set([...PAGE_SLUGS, 'tin-tuc']);

/**
 * Path cấp gốc là bản sao của 1 trang tiếng Việt → trả path đó (giữ dạng
 * '<seg>/<seg>/'); '/' (trang chủ) → '/'; không phải bản sao → null.
 *   '/tim-tour/'          → '/tim-tour/'
 *   '/tours/<slug>/'     → '/tours/<slug>/'
 *   '/vi/tim-tour/'       → null   (đã có tiền tố ngôn ngữ)
 */
export function viMirrorPath(pathname) {
  const seg = String(pathname || '/')
    .split('#')[0]
    .split('?')[0]
    .split('/')
    .filter(Boolean);
  if (!seg.length) return '/';
  if (seg[0] === 'vi' || seg[0] === 'en') return null;
  if (ROOT_PAGE_EQUIV[seg[0]]) return null;
  return VI_MIRROR_HEADS.has(seg[0]) ? `/${seg.join('/')}/` : null;
}

/**
 * Path của TRANG THẬT (có tiền tố ngôn ngữ) mà bản sao cấp gốc trỏ về:
 *   '/' → '/vi/',  '/tim-tour/' → '/vi/tim-tour/',  '/vi/tim-tour/' → null.
 */
export function viMirrorTarget(pathname) {
  const p = viMirrorPath(pathname);
  if (p === null) return null;
  return p === '/' ? `/${DEFAULT_LANG}/` : `/${DEFAULT_LANG}${p}`;
}

/**
 * Mục đã ĐỔI TÊN (path cũ vẫn được build để không 404, nhưng canonical/hreflang/
 * nút đổi ngôn ngữ phải trỏ về path mới).
 *   '/vi/tour/<slug>/' → '/vi/tours/<slug>/'
 *   '/en/tour/<slug>/' → '/en/tours/<slug>/'
 * (Trước 2026-09 chi tiết tour nằm ở '<lang>/tour/', nay là '<lang>/tours/'.)
 */
const MOVED_SEGMENTS = { tour: 'tours' };

/** Đổi tên mục đầu tiên (sau tiền tố ngôn ngữ nếu có); path khác giữ nguyên dạng. */
export function resolveMovedPath(pathname) {
  const seg = String(pathname || '/')
    .split('#')[0]
    .split('?')[0]
    .split('/')
    .filter(Boolean);
  const lang = seg[0] === 'vi' || seg[0] === 'en' ? seg.shift() : '';
  const renamed = MOVED_SEGMENTS[seg[0]];
  if (renamed) seg[0] = renamed;
  return `/${[lang, ...seg].filter(Boolean).join('/')}${seg.length ? '/' : ''}`;
}

/**
 * Slug hoá chuỗi tiếng Việt dùng cho URL khu vực:
 *   'Châu Á' → 'chau-a',  'Miền Tây' → 'mien-tay',  'Biển đảo' → 'bien-dao'.
 */
export function slugifyVi(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Danh sách KHU VỰC cho '/<lang>/tours/khu-vuc/<region>/'.
 *
 * Suy ra từ chính `region_name` của các tour bản VI — không có bảng cứng nào để
 * lệch với content. Slug lấy từ bản VI cho CẢ 2 ngôn ngữ (giống slug tour) vì
 * bản EN dịch máy đang để `region_name` rỗng (xem ghi chú trong README/translate).
 *
 * Trả về: [{ slug, name, tourSlugs }] — đã sắp xếp theo tên (tiếng Việt).
 */
export function getTourRegions() {
  const map = new Map();
  for (const tour of getTours(DEFAULT_LANG)) {
    const name = String(tour.regionName || '').trim();
    if (!name) continue;
    const slug = slugifyVi(name);
    if (!slug) continue;
    if (!map.has(slug)) map.set(slug, { slug, name, tourSlugs: [] });
    map.get(slug).tourSlugs.push(tour.slug);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
}

const cache = new Map();

/** Load a flat JSON content file for a language, e.g. getContent('vi', 'home'). */
export function getContent(lang, file) {
  const key = `${lang}/${file}`;
  // Ở DEV: luôn đọc file mới (admin sửa content -> xem được ngay, không cần restart).
  // Ở PRODUCTION build: cache theo tiến trình (mỗi deploy là tiến trình mới nên vẫn đúng).
  if (!import.meta.env.DEV && cache.has(key)) return cache.get(key);
  const p = path.join(process.cwd(), '..', 'content', lang, `${file}.json`);
  const raw = fs.readFileSync(p, 'utf-8');
  const data = JSON.parse(raw);
  cache.set(key, data);
  return data;
}

/** Build a localized internal link: '/vi/', '/vi/tours/', '/en/tours/slug/'.
 *
 * LUÔN có '/' ở cuối: `astro.config.mjs` dùng `build.format: 'directory'`, nên
 * '/vi/tours' bị GitHub Pages trả 301 → '/vi/tours/'. Link thiếu '/' khiến mỗi
 * lượt click nội bộ tốn 1 redirect (hại crawl budget + tốc độ). */
export function href(lang, slug = '') {
  return slug ? `/${lang}/${String(slug).replace(/^\/+|\/+$/g, '')}/` : `/${lang}/`;
}

/**
 * Alternate-language URL for the current path, so the VI/EN switch keeps
 * the visitor on the same page. e.g. '/vi/tours/x/' -> '/en/tours/x/'.
 *
 * Cũng phải có '/' cuối (xem `href()`): thiếu '/' thì mỗi lần bấm nút đổi ngôn
 * ngữ tốn 1 redirect 301.
 */
export function langHref(lang, current) {
  // Trang VI-only ở cấp gốc không có '/<lang>/<slug>/' → trỏ sang trang tương đương
  // (xem ROOT_PAGE_EQUIV), tránh link 404 khi khách bấm nút đổi ngôn ngữ.
  const root = viOnlyRootSlug(current);
  if (root) return href(lang, ROOT_PAGE_EQUIV[root]);
  // Bản sao cấp gốc ('/tim-tour/', '/tours/<slug>/') → bản thật '/vi/<path>/'.
  // Mục đổi tên ('/vi/tour/<slug>/') → '/vi/tours/<slug>/'. Cả hai đều quy về
  // URL thật trước khi đổi tiền tố ngôn ngữ.
  const seg = (viMirrorTarget(current) ?? resolveMovedPath(current)).split('/').filter(Boolean);
  if (seg[0] === 'vi' || seg[0] === 'en') seg[0] = lang;
  else seg.unshift(lang);
  return `/${seg.join('/')}/`;
}

/** Đọc 1 file bài viết dạng `content/<lang>/<kind>/<slug>.json` (null nếu thiếu). */
function readArticle(lang, kind, slug) {
  try {
    return getContent(lang, `${kind}/${slug}`);
  } catch {
    return null;
  }
}

function normalizeTour(t, slug) {
  return {
    slug: t.slug ?? slug,
    name: t.name ?? '',
    region: t.region ?? 'domestic',
    regionName: t.region_name ?? '',
    departure: t.departure ?? '',
    duration: t.duration ?? '',
    price: t.price ?? '',
    image: t.image ?? '',
    desc: t.desc ?? '',
    seoTitle: String(t.seo_title ?? '').trim(),
    highlights: Array.isArray(t.highlights) ? t.highlights : [],
    itinerary: Array.isArray(t.itinerary) ? t.itinerary : [],
    content: Array.isArray(t.content) ? t.content : [],
    // Giữ cờ ẩn/hiện — thiếu dòng này thì getTours() không lọc được tour đang ẩn.
    hidden: t.hidden === true,
  };
}

/**
 * Mục bị admin ẩn (`hidden: true`) không xuất hiện ở website: trang chủ, danh sách,
 * trang khu vực, sitemap… nhưng VẪN còn trong admin để bật lại.
 */
export function isVisible(item) {
  return !!item && item.hidden !== true;
}

/** All tours for a language — index.order + 1 file/article (cấu trúc mới). */
export function getTours(lang) {
  const t = getContent(lang, 'tours');
  if (Array.isArray(t.order)) {
    return t.order
      .map((slug) => {
        const article = readArticle(lang, 'tours', slug);
        return article ? normalizeTour(article, slug) : null;
      })
      .filter((x) => isVisible(x));
  }
  // Legacy fallback (chưa migrate): index phẳng tour_N_*
  const count = Number(t.count) || 0;
  const tours = [];
  for (let i = 1; i <= count; i += 1) {
    const slug = t[`tour_${i}_slug`] ?? '';
    if (!slug) continue;
    tours.push({
      slug,
      name: t[`tour_${i}_name`] ?? '',
      region: t[`tour_${i}_region`] ?? 'domestic',
      regionName: t[`tour_${i}_region_name`] ?? '',
      duration: t[`tour_${i}_duration`] ?? '',
      price: t[`tour_${i}_price`] ?? '',
      image: t[`tour_${i}_image`] ?? '',
      desc: t[`tour_${i}_desc`] ?? '',
      highlights: String(t[`tour_${i}_highlights`] ?? '')
        .split('|')
        .map((s) => s.trim())
        .filter(Boolean),
      itinerary: [],
    });
  }
  return tours.filter((x) => isVisible(x));
}

/** Find a single tour by slug for a language (null if not found). */
export function getTour(lang, slug) {
  const article = readArticle(lang, 'tours', slug);
  return article && isVisible(article)
    ? normalizeTour(article, slug)
    : getTours(lang).find((x) => x.slug === slug) ?? null;
}

/** All news for a language (mới nhất trước). */
export function getNews(lang) {
  const n = getContent(lang, 'news');
  const order = Array.isArray(n.order) ? n.order : [];
  return order
    .map((slug) => readArticle(lang, 'news', slug))
    .filter((x) => isVisible(x))
    .sort((a, b) => String(b.published_at || '').localeCompare(String(a.published_at || '')));
}

/** Một bài tin (title, category, image, summary, body, published_at, content[]). */
export function getNewsItem(lang, slug) {
  const n = readArticle(lang, 'news', slug);
  if (!n || !isVisible(n)) return null;
  return { ...n, content: Array.isArray(n.content) ? n.content : [] };
}

/** Ý kiến khách hàng: index { count, order, items }. Trả mảng theo thứ tự (kèm slug). */
export function getTestimonials(lang) {
  const d = getContent(lang, 'testimonials');
  const order = Array.isArray(d.order) ? d.order : [];
  const items = d.items && typeof d.items === 'object' ? d.items : {};
  return order.map((slug) => (items[slug] ? { ...items[slug], slug } : null)).filter(Boolean);
}

/** Đọc 1 ý kiến khách hàng theo slug (null nếu không có). */
export function getTestimonial(lang, slug) {
  const items = getTestimonials(lang);
  return items.find((x) => x.slug === slug) || null;
}

/** Đối tác: index { count, order, items }. Trả mảng theo thứ tự (kèm slug). */
export function getPartners(lang) {
  const d = getContent(lang, 'partners');
  const order = Array.isArray(d.order) ? d.order : [];
  const items = d.items && typeof d.items === 'object' ? d.items : {};
  return order.map((slug) => (items[slug] ? { ...items[slug], slug } : null)).filter(Boolean);
}
