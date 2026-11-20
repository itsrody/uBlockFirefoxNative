/* global process */

import { dirname, join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT = join(ROOT, "assets", "requests.json");

const countArg = process.argv[2];
const count = countArg === undefined ? 2000 : Number.parseInt(countArg, 10);
if ( !Number.isInteger(count) || count < 1 ) {
    throw new Error(`Invalid request count: ${countArg}`);
}

// Deterministic mix of first-party pages and third-party ad/tracker/asset URLs.
// The benchmark only matches strings; none of these hosts are contacted.
const pages = [
    "https://example.com/",
    "https://news.example.org/article/12345",
    "https://www.wikipedia.org/wiki/Ad_blocking",
    "https://store.example.net/product/98765",
    "https://forum.example.org/thread/4567",
    "https://video.example.com/watch?v=abc123",
];

const schemes = [ "https", "https", "https", "http" ];

const hosts = [
    "adservice.google.com",
    "doubleclick.net",
    "www.googleadservices.com",
    "pagead2.googlesyndication.com",
    "cm.g.doubleclick.net",
    "www.google-analytics.com",
    "analytics.google.com",
    "connect.facebook.net",
    "pixel.quantserve.com",
    "sb.scorecardresearch.com",
    "bat.bing.com",
    "ads.pubmatic.com",
    "adsrvr.org",
    "cdn.taboola.com",
    "tracker.outbrain.com",
    "static.criteo.net",
    "as-sec.casalemedia.com",
    "rtb.openx.net",
    "fastlane.rubiconproject.com",
    "secure.adnxs.com",
    "www.googletagmanager.com",
    "platform.twitter.com",
    "syndication.twitter.com",
    "pbs.twimg.com",
    "redditstatic.com",
    "cdn.jsdelivr.net",
    "cdnjs.cloudflare.com",
    "ajax.googleapis.com",
    "fonts.gstatic.com",
    "images.unsplash.com",
    "static.cloudflareinsights.com",
];

const paths = [
    "/ads.js",
    "/pagead/show_ads.js",
    "/ga.js",
    "/analytics.js",
    "/pixel.gif",
    "/beacon.js",
    "/iframe.html",
    "/banner/300x250.png",
    "/video/ad.mp4",
    "/font.woff2",
    "/style.css",
    "/api/v1/collect",
    "/sdk.js",
    "/tag.js",
    "/static/main.js",
    "/assets/logo.svg",
];

const queries = [
    "",
    "?utm_source=newsletter&utm_medium=email",
    "?utm_campaign=summer&utm_content=banner",
    "?gclid=abc123",
    "?fbclid=xyz789",
    "?mc_cid=deadbeef&mc_eid=cafebabe",
    "?ref=homepage",
];

const types = [
    "script",
    "image",
    "xmlhttprequest",
    "xhr",
    "sub_frame",
    "stylesheet",
    "font",
    "media",
    "other",
];

function pick(list, seed) {
    return list[seed % list.length];
}

const requests = [];
for ( let i = 0; i < count; i += 1 ) {
    const frameUrl = pick(pages, i);
    const isMain = i % 10 === 0;
    const scheme = pick(schemes, i * 3);
    const host = pick(hosts, i * 7);
    const path = pick(paths, i * 11);
    const query = pick(queries, i * 13);
    const suffix = query === "" ? `?cb=${i}` : `${query}&cb=${i}`;
    requests.push({
        url: isMain ? frameUrl : `${scheme}://${host}${path}${suffix}`,
        frameUrl,
        cpt: isMain ? "main_frame" : pick(types, i * 17),
    });
}

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(requests, null, 2)}\n`);
console.log(`Wrote ${count} requests to assets/requests.json`);
