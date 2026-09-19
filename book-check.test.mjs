import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = new URL("./", import.meta.url);
const index = await readFile(new URL("index.html", root), "utf8");
const pages = [...index.matchAll(/<article\b[^>]*class="([^"]*\bbook-page\b[^"]*)"[^>]*>/g)].map((m) => m[1]);

test("every photo file exists", async () => {
  const sources = [...index.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(sources.length, 40);
  for (const source of sources) await access(fileURLToPath(new URL(source, root)));
});

test("leaves alternate verso and recto", () => {
  pages.forEach((classes, i) => {
    assert.match(classes, i % 2 === 0 ? /\brecto\b/ : /\bverso\b/, `leaf ${i} (${classes})`);
  });
});

test("spreads pair odd recto with the following verso", () => {
  const photos = [...index.matchAll(/class="plate[^"]*"[\s\S]*?<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(photos).size, photos.length, "no photo repeats across the book");
});
