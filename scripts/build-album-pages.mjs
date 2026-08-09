import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(repoRoot, 'index.html');
const siteUrl = 'https://entroversu.com';
const lastModified = '2026-08-09';

const escapeHtml = value => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const escapeXml = escapeHtml;
const slugify = value => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[’']/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

const sourceHtml = fs.readFileSync(indexPath, 'utf8');
const schemaMatch = sourceHtml.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/);
if (!schemaMatch) throw new Error('Homepage JSON-LD not found.');
const oldSchema = JSON.parse(schemaMatch[1]);
const oldArtistSchema = oldSchema.album ? oldSchema : oldSchema['@graph']?.find(item => item['@type'] === 'MusicGroup');
if (!oldArtistSchema?.album) throw new Error('Homepage MusicGroup album data not found.');
const structuredAlbums = new Map(oldArtistSchema.album.map(album => [album.name, album]));
const lines = sourceHtml.split(/\r?\n/);
const albums = [];

const extract = (value, pattern, label) => {
  const match = value.match(pattern);
  if (!match) throw new Error(`Could not extract ${label}.`);
  return match[1];
};

for (let index = 0; index < lines.length; index += 1) {
  const coverMatch = lines[index].match(/class="album-cover"[^\n]*?src="covers\/(\d{3})\.jpg"/);
  if (!coverMatch) continue;

  const number = coverMatch[1];
  const infoLine = lines[index + 1];
  const trackLine = lines[index + 3];
  const title = extract(infoLine, /class="album-title">(?:<a[^>]*>)?([^<]+)(?:<\/a>)?<\/(?:div|h3)>/, `title ${number}`);
  const date = extract(infoLine, /class="album-date">([^<]+)<\/div>/, `date ${number}`);
  const genre = extract(infoLine, /class="album-genre">([^<]+)<\/div>/, `genre ${number}`);
  const spotify = extract(infoLine, /href="(https:\/\/open\.spotify\.com\/album\/[^"]+)"/, `Spotify URL ${number}`);
  const apple = extract(infoLine, /href="(https:\/\/music\.apple\.com\/[^\"]+\/album\/[^\"]+)"/, `Apple URL ${number}`);
  const youtube = extract(infoLine, /href="(https:\/\/www\.youtube\.com\/playlist\?list=[^"]+)"/, `YouTube URL ${number}`);
  const structured = structuredAlbums.get(title);
  if (!structured) throw new Error(`Structured data missing for ${title}.`);

  const tracks = [...trackLine.matchAll(/<li><span class="track-num">([^<]+)<\/span><span class="track-name">([^<]+)<\/span>(?:<span class="track-isrc">([^<]+)<\/span>)?<\/li>/g)]
    .map(match => ({ position: Number(match[1]), name: match[2], isrc: match[3] || '' }));
  if (tracks.length !== structured.numTracks) {
    throw new Error(`${title}: ${tracks.length} visible tracks but ${structured.numTracks} in JSON-LD.`);
  }

  const slug = slugify(title);
  const album = {
    number,
    title,
    date,
    datePublished: structured.datePublished,
    genre,
    numTracks: tracks.length,
    spotify,
    apple,
    youtube,
    tracks,
    slug,
    url: `${siteUrl}/albums/${slug}/`,
    image: `${siteUrl}/covers/${number}.jpg`,
  };
  albums.push(album);

  const alt = `Album Cover: ${title} - ${genre}`;
  lines[index] = `<picture><source type="image/webp" srcset="covers/${number}.webp"><img class="album-cover" src="covers/${number}.jpg" alt="${escapeHtml(alt)}" width="500" height="500" loading="lazy" decoding="async" onerror="this.outerHTML='<div class=\\'album-cover-placeholder\\'><span>${number}</span></div>'"></picture>`;
  lines[index + 1] = infoLine.replace(
    /<div class="album-title">([^<]+)<\/div>/,
    `<h3 class="album-title"><a class="album-detail-link" href="albums/${slug}/">$1</a></h3>`,
  );
}

if (albums.length !== 16) throw new Error(`Expected 16 albums, found ${albums.length}.`);

const artistId = `${siteUrl}/#artist`;
const artistSchema = {
  '@type': 'MusicGroup',
  '@id': artistId,
  name: 'Entroversu',
  url: `${siteUrl}/`,
  image: `${siteUrl}/og-image.png`,
  description: '300 albums. 300 genres. One vision. A sonic experiment at the intersection of human vision and artificial sound.',
  foundingDate: '2025-12',
  foundingLocation: { '@type': 'Place', name: 'Switzerland' },
  genre: ['Experimental', 'AI-assisted Music', 'Cross-genre'],
  sameAs: [
    'https://open.spotify.com/artist/7htQtZU5SzBfbaLKAZ4cMu',
    'https://music.apple.com/us/artist/entroversu/1860770727',
    'https://music.amazon.de/artists/B0G6JSWMXQ/entroversu',
    'https://www.youtube.com/@Entroversu',
  ],
  album: albums.map(album => ({
    '@type': 'MusicAlbum',
    '@id': `${album.url}#album`,
    name: album.title,
    url: album.url,
    image: album.image,
    datePublished: album.datePublished,
    genre: album.genre,
    numTracks: album.numTracks,
    albumProductionType: 'https://schema.org/StudioAlbum',
    albumReleaseType: 'https://schema.org/AlbumRelease',
    byArtist: { '@id': artistId },
    sameAs: [album.spotify, album.apple, album.youtube],
  })),
};
const homepageSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: `${siteUrl}/`,
      name: 'Entroversu',
      alternateName: 'EntroVersU',
      inLanguage: 'en',
      publisher: { '@id': artistId },
    },
    artistSchema,
  ],
};

let homepage = lines.join('\n');
homepage = homepage.replace(
  /<script type="application\/ld\+json">\s*[\s\S]*?\s*<\/script>/,
  `<script type="application/ld+json">\n${JSON.stringify(homepageSchema, null, 2)}\n</script>`,
);
fs.writeFileSync(indexPath, `${homepage.trimEnd()}\n`, 'utf8');

const albumCss = `
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a0a0a;--text:#e8e4df;--accent:#c4a872;--dim:#928c84;--border:#2d2b28;--card:rgba(17,17,16,.9)}
html{color-scheme:dark}
body{min-height:100vh;background:radial-gradient(circle at 50% 15%,rgba(196,168,114,.09),transparent 35%),var(--bg);color:var(--text);font-family:'Cormorant Garamond',Georgia,serif;padding:2rem}
body::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.5;background-image:radial-gradient(circle at 15% 20%,#c4a872 0 1px,transparent 1.5px),radial-gradient(circle at 72% 12%,#c4a872 0 1px,transparent 1.5px),radial-gradient(circle at 88% 62%,#c4a872 0 1px,transparent 1.5px),radial-gradient(circle at 35% 75%,#c4a872 0 1px,transparent 1.5px);background-size:270px 230px,330px 290px,410px 370px,360px 310px}
a{color:inherit}
.shell{position:relative;z-index:1;max-width:1060px;margin:0 auto}
.back{display:inline-block;font-family:'Space Mono',monospace;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);text-decoration:none;margin:1rem 0 2.5rem}
.back:hover,.back:focus-visible{text-decoration:underline;text-underline-offset:.3em;outline:none}
.album{display:grid;grid-template-columns:minmax(280px,460px) 1fr;gap:clamp(2rem,6vw,5rem);align-items:start;background:var(--card);border:1px solid rgba(196,168,114,.35);padding:clamp(1rem,3vw,2rem);box-shadow:0 20px 70px rgba(0,0,0,.35)}
.cover{width:100%;height:auto;aspect-ratio:1;object-fit:cover;display:block;border:1px solid var(--border)}
.number,.date,.genre{font-family:'Space Mono',monospace;text-transform:uppercase;letter-spacing:.14em}
.number{font-size:.75rem;color:var(--accent);margin-bottom:1rem}
h1{font-size:clamp(2rem,5vw,4.2rem);font-weight:300;line-height:1.05;text-wrap:balance}
.date{font-size:.7rem;color:var(--dim);margin-top:1.4rem}
.genre{font-size:.68rem;color:var(--accent);margin-top:.8rem;line-height:1.7}
.summary{font-size:1.15rem;color:var(--dim);line-height:1.7;margin-top:1.4rem}
.services{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:1.7rem}
.services a{font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;text-decoration:none;color:var(--accent);border:1px solid rgba(196,168,114,.4);padding:.7rem .85rem}
.services a:hover,.services a:focus-visible{background:var(--accent);color:var(--bg);outline:none}
.tracks{grid-column:1/-1;margin-top:1rem;border-top:1px solid var(--border);padding-top:2rem}
.tracks h2{font-family:'Space Mono',monospace;font-size:.78rem;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin-bottom:1rem}
.tracks ol{list-style:none;counter-reset:track}
.tracks li{counter-increment:track;display:grid;grid-template-columns:2rem 1fr auto;gap:.7rem;align-items:baseline;padding:.8rem 0;border-bottom:1px solid var(--border);font-family:'Space Mono',monospace;font-size:.72rem}
.tracks li::before{content:counter(track,decimal-leading-zero);color:var(--accent)}
.isrc{font-size:.58rem;color:var(--dim);letter-spacing:.08em}
.album-nav{display:flex;justify-content:space-between;gap:1rem;margin:2rem 0 4rem;font-family:'Space Mono',monospace;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase}
.album-nav a{text-decoration:none;color:var(--dim);max-width:45%}
.album-nav a:last-child{text-align:right}
.album-nav a:hover,.album-nav a:focus-visible{color:var(--accent);outline:none}
footer{text-align:center;color:var(--dim);font-family:'Space Mono',monospace;font-size:.6rem;letter-spacing:.16em;text-transform:uppercase;padding-bottom:2rem}
@media(max-width:760px){body{padding:1rem}.album{grid-template-columns:1fr}.tracks{grid-column:auto}.tracks li{grid-template-columns:1.6rem 1fr}.isrc{grid-column:2}.album-nav{align-items:flex-start}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

const albumSchema = album => ({
  '@context': 'https://schema.org',
  '@type': 'MusicAlbum',
  '@id': `${album.url}#album`,
  name: album.title,
  url: album.url,
  image: album.image,
  inLanguage: 'en',
  datePublished: album.datePublished,
  genre: album.genre,
  numTracks: album.numTracks,
  albumProductionType: 'https://schema.org/StudioAlbum',
  albumReleaseType: 'https://schema.org/AlbumRelease',
  byArtist: {
    '@type': 'MusicGroup',
    '@id': artistId,
    name: 'Entroversu',
    url: `${siteUrl}/`,
  },
  sameAs: [album.spotify, album.apple, album.youtube],
  track: album.tracks.map(track => ({
    '@type': 'MusicRecording',
    name: track.name,
    position: track.position,
    ...(track.isrc ? { isrcCode: track.isrc } : {}),
    inAlbum: { '@id': `${album.url}#album` },
  })),
});

albums.forEach((album, index) => {
  const previous = albums[index - 1];
  const next = albums[index + 1];
  const description = `${album.title} by Entroversu — ${album.genre}. Released ${album.date}; ${album.numTracks} tracks. Listen on Spotify, Apple Music or YouTube.`;
  const trackMarkup = album.tracks.map(track => `<li><span>${escapeHtml(track.name)}</span>${track.isrc ? `<span class="isrc">ISRC ${escapeHtml(track.isrc)}</span>` : ''}</li>`).join('\n');
  const page = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(album.title)} — Entroversu</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="Entroversu">
<link rel="canonical" href="${album.url}">
<meta property="og:type" content="music.album">
<meta property="og:site_name" content="Entroversu">
<meta property="og:title" content="${escapeHtml(album.title)} — Entroversu">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${album.url}">
<meta property="og:image" content="${album.image}">
<meta property="og:image:width" content="500">
<meta property="og:image:height" content="500">
<meta property="og:image:alt" content="Album cover for ${escapeHtml(album.title)} by Entroversu">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${escapeHtml(album.title)} — Entroversu">
<meta name="twitter:description" content="${escapeHtml(description)}">
<meta name="twitter:image" content="${album.image}">
<meta name="twitter:image:alt" content="Album cover for ${escapeHtml(album.title)} by Entroversu">
<link rel="icon" type="image/x-icon" href="../../favicon.ico">
<link rel="icon" type="image/png" sizes="192x192" href="../../favicon-192.png">
<link rel="apple-touch-icon" sizes="180x180" href="../../apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>${albumCss}</style>
<script type="application/ld+json">
${JSON.stringify(albumSchema(album), null, 2)}
</script>
</head>
<body>
<div class="shell">
<nav aria-label="Back to catalogue"><a class="back" href="../../#catalogue">← Entroversu Catalogue</a></nav>
<main>
<article class="album">
<picture><source type="image/webp" srcset="../../covers/${album.number}.webp"><img class="cover" src="../../covers/${album.number}.jpg" alt="Album Cover: ${escapeHtml(album.title)} - ${escapeHtml(album.genre)}" width="500" height="500" decoding="async"></picture>
<header>
<p class="number">No. ${album.number}</p>
<h1>${escapeHtml(album.title)}</h1>
<p class="date">${escapeHtml(album.date)}</p>
<p class="genre">${escapeHtml(album.genre)}</p>
<p class="summary">${album.numTracks} tracks by Entroversu. Created in Switzerland as part of the 300 albums · 300 genres project.</p>
<div class="services" aria-label="Listen to ${escapeHtml(album.title)}">
<a href="${album.spotify}" target="_blank" rel="noopener noreferrer">Spotify ↗</a>
<a href="${album.apple}" target="_blank" rel="noopener noreferrer">Apple Music ↗</a>
<a href="${album.youtube}" target="_blank" rel="noopener noreferrer">YouTube ↗</a>
</div>
</header>
<section class="tracks">
<h2>Tracklist</h2>
<ol>
${trackMarkup}
</ol>
</section>
</article>
<nav class="album-nav" aria-label="Album navigation">
${previous ? `<a href="../${previous.slug}/">← ${escapeHtml(previous.title)}</a>` : '<span></span>'}
${next ? `<a href="../${next.slug}/">${escapeHtml(next.title)} →</a>` : '<span></span>'}
</nav>
</main>
<footer>Entroversu · Entropy · Universe · Music</footer>
</div>
</body>
</html>
`;

  const outputDir = path.join(repoRoot, 'albums', album.slug);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(path.join(outputDir, 'index.html'), page, 'utf8');
});

const sitemapEntries = [
  `  <url>\n    <loc>${siteUrl}/</loc>\n    <lastmod>${lastModified}</lastmod>\n    <image:image>\n      <image:loc>${siteUrl}/og-image.png</image:loc>\n      <image:title>Entroversu — Entropy · Universe · Music</image:title>\n    </image:image>\n  </url>`,
  ...albums.map(album => `  <url>\n    <loc>${album.url}</loc>\n    <lastmod>${lastModified}</lastmod>\n    <image:image>\n      <image:loc>${album.image}</image:loc>\n      <image:title>${escapeXml(album.title)} — Entroversu</image:title>\n    </image:image>\n  </url>`),
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${sitemapEntries.join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(repoRoot, 'sitemap.xml'), sitemap, 'utf8');

console.log(`Built ${albums.length} album pages and sitemap.xml.`);
