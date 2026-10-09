import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};
const read = relativePath => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const extractJsonLd = html => JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);

const homepage = read('index.html');
const homepageSchema = extractJsonLd(homepage);
const websiteSchema = homepageSchema['@graph']?.find(item => item['@type'] === 'WebSite');
const artistSchema = homepageSchema['@graph']?.find(item => item['@type'] === 'MusicGroup');
const albumLinks = [...homepage.matchAll(/class="album-detail-link" href="([^"]+)"/g)].map(match => match[1]);
assert(websiteSchema?.name === 'Entroversu', 'Homepage schema must describe the WebSite name.');
assert(artistSchema?.album.length === 18, 'Homepage MusicGroup schema must contain 18 albums.');
assert(albumLinks.length === 18, 'Homepage must contain 18 crawlable album links.');
assert(homepage.includes("coverLink.className='album-cover-link'"), 'Homepage covers must link to their album pages.');
assert((homepage.match(/<h3 class="album-title">/g) || []).length === 18, 'Homepage album titles must be h3 headings.');
assert((homepage.match(/<source type="image\/webp"/g) || []).length === 18, 'Homepage must offer 18 WebP covers.');
assert(homepage.includes('https://hits.sh/entroversu.com.svg'), 'Homepage signal counter is missing.');
assert(homepage.includes('data-entities-counter'), 'Homepage entity counter is missing.');
assert(homepage.includes('scripts/entities-counter.js'), 'Homepage entity counter script is missing.');
assert(homepage.includes('https://entroversu-entities.entities-counter.workers.dev'), 'Homepage entity counter endpoint is missing.');
assert(!homepage.includes('ENTITY_COUNTER_ENDPOINT'), 'Homepage contains an undeployed entity counter placeholder.');
assert(homepage.includes('30ba2461d6104a55a627df08e4112768'), 'Homepage Cloudflare Web Analytics token is missing.');
assert(homepage.includes('href="privacy/"'), 'Homepage privacy link is missing.');
assert(!homepage.includes('meta name="keywords"'), 'Homepage must not contain obsolete meta keywords.');

const sitemap = read('sitemap.xml');
const sitemapUrls = [...sitemap.matchAll(/<loc>(https:\/\/entroversu\.com\/[^<]*)<\/loc>/g)].map(match => match[1]);
const sitemapImages = [...sitemap.matchAll(/<image:loc>(https:\/\/entroversu\.com\/[^<]*)<\/image:loc>/g)].map(match => match[1]);
assert(sitemapUrls.length === 20, 'Sitemap must contain 20 page URLs.');
assert(sitemapImages.length === 19, 'Sitemap must contain 19 image URLs.');
assert((sitemap.match(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g) || []).length === 20, 'Every sitemap page needs a lastmod date.');
assert(sitemapUrls.includes('https://entroversu.com/privacy/'), 'Sitemap privacy URL is missing.');

for (const link of albumLinks) {
  const relativePage = path.join(link.replace(/\/$/, ''), 'index.html');
  const absolutePage = path.join(repoRoot, relativePage);
  assert(fs.existsSync(absolutePage), `${link}: detail page missing.`);
  if (!fs.existsSync(absolutePage)) continue;

  const page = fs.readFileSync(absolutePage, 'utf8');
  const schema = extractJsonLd(page);
  const expectedUrl = `https://entroversu.com/${link}`;
  const canonical = page.match(/<link rel="canonical" href="([^"]+)">/)?.[1];
  const visibleTracks = (page.match(/<li><span>/g) || []).length;
  const isrcTracks = schema.track.filter(track => track.isrcCode).length;
  const number = page.match(/src="\.\.\/\.\.\/covers\/(\d{3})\.jpg"/)?.[1];

  assert(canonical === expectedUrl, `${link}: canonical URL mismatch.`);
  assert(schema.url === expectedUrl, `${link}: schema URL mismatch.`);
  assert(schema.track.length === schema.numTracks, `${link}: schema track count mismatch.`);
  assert(visibleTracks === schema.numTracks, `${link}: visible track count mismatch.`);
  assert(isrcTracks === schema.numTracks, `${link}: missing ISRC structured data.`);
  assert((page.match(/class="services"/g) || []).length === 1, `${link}: listening links missing.`);
  assert(page.includes('https://hits.sh/entroversu.com.svg'), `${link}: signal counter is missing.`);
  assert(page.includes('data-entities-counter'), `${link}: entity counter is missing.`);
  assert(page.includes('../../scripts/entities-counter.js'), `${link}: entity counter script is missing.`);
  assert(page.includes('https://entroversu-entities.entities-counter.workers.dev'), `${link}: entity counter endpoint is missing.`);
  assert(page.includes('30ba2461d6104a55a627df08e4112768'), `${link}: Cloudflare Web Analytics token is missing.`);
  assert(page.includes('href="../../privacy/"'), `${link}: privacy link is missing.`);
  assert((page.match(/target="_blank" rel="noopener noreferrer"/g) || []).length === 3, `${link}: external link security attributes missing.`);
  assert(number && fs.existsSync(path.join(repoRoot, 'covers', `${number}.webp`)), `${link}: WebP cover missing.`);
}

const privacy = read('privacy/index.html');
assert(privacy.includes('<link rel="canonical" href="https://entroversu.com/privacy/">'), 'Privacy canonical URL is missing.');
assert(privacy.includes('30ba2461d6104a55a627df08e4112768'), 'Privacy Cloudflare Web Analytics token is missing.');
assert(privacy.includes('Cloudflare Web Analytics'), 'Privacy analytics disclosure is missing.');
assert(privacy.includes('hits.sh'), 'Privacy hits.sh disclosure is missing.');

if (failures.length) {
  console.error(failures.map(message => `- ${message}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log('Validated homepage, privacy page, 18 album pages, 202 ISRC tracks, covers and sitemap.');
}
