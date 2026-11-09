// TM-U4 AC10 / master plan decision 12: the time from navigation start until the first course card heading of the home
// page is visible, as an anonymous visitor with an empty cache. The same script runs before and after the frontend moves
// to `GET /api/courses/home`, so the two numbers are comparable. It reads nothing but the public page.
//
// node scripts/api/measure-home.mjs <origin> [--batches 3] [--samples 20] [--gap-seconds 60]
//
// The origin is required and has no default: Main runs it against production under its own Owner grant, and a local
// run passes a local origin. A sample opens a new browser context (so no cache, cookie or connection is shared),
// measures with a MutationObserver started before the page's own scripts, and closes it. Batches are at least a minute
// apart so that a warm edge or function instance of one batch does not decide the next. This file is removed by the
// next TM-U4 PR after the after-measurement.
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const origin = args.find((arg) => !arg.startsWith("--"));
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(args[index + 1]);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`--${name} takes a non-negative integer`);
  }
  return value;
};
if (!origin || !/^https?:\/\/[^/\s]+\/?$/.test(origin)) {
  console.error(
    "usage: node scripts/api/measure-home.mjs <origin, e.g. http://127.0.0.1:3000> [--batches 3] [--samples 20] [--gap-seconds 60]",
  );
  process.exit(2);
}
const batches = option("batches", 3);
const samples = option("samples", 20);
const gapSeconds = option("gap-seconds", 60);
const TIMEOUT_MS = 30_000;

// Runs in the page before its scripts. A card heading of the course grid is the `h2` of a card; the skeleton has none.
const OBSERVER = () => {
  window.__firstCardAt = null;
  const check = () => {
    if (window.__firstCardAt !== null) return;
    const heading = document.querySelector("h2.uppercase");
    if (heading && heading.getClientRects().length > 0) {
      window.__firstCardAt = performance.now();
    }
  };
  new MutationObserver(check).observe(document, {
    childList: true,
    subtree: true,
    attributes: true,
  });
  document.addEventListener("DOMContentLoaded", check);
};

function percentile(sorted, p) {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

const browser = await chromium.launch();
const all = [];
try {
  for (let batch = 0; batch < batches; batch += 1) {
    if (batch > 0) {
      await new Promise((resolve) => setTimeout(resolve, gapSeconds * 1000));
    }
    const times = [];
    for (let sample = 0; sample < samples; sample += 1) {
      const context = await browser.newContext();
      try {
        const page = await context.newPage();
        await page.addInitScript(OBSERVER);
        await page.goto(origin, { waitUntil: "commit" });
        await page.waitForFunction(() => window.__firstCardAt !== null, null, {
          timeout: TIMEOUT_MS,
        });
        times.push(await page.evaluate(() => window.__firstCardAt));
      } finally {
        await context.close();
      }
    }
    const sorted = [...times].sort((a, b) => a - b);
    console.log(
      `batch ${batch + 1}: n=${sorted.length} p50=${percentile(sorted, 50).toFixed(0)} ms p95=${percentile(sorted, 95).toFixed(0)} ms`,
    );
    all.push(...times);
  }
} finally {
  await browser.close();
}
const sorted = all.sort((a, b) => a - b);
console.log(
  `all: n=${sorted.length} p50=${percentile(sorted, 50).toFixed(0)} ms p95=${percentile(sorted, 95).toFixed(0)} ms`,
);
