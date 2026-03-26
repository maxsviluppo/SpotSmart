
import Parser from "rss-parser";
import * as fs from "fs";
import * as path from "path";

const parser = new Parser();

async function checkCategories() {
  const sourcesPath = path.join(process.cwd(), ".data", "news_sources.json");
  const sources = JSON.parse(fs.readFileSync(sourcesPath, "utf-8"));

  const categoryStats: Record<string, { total: number, active: number, results: number }> = {};

  console.log(`Checking ${sources.length} sources...`);

  // Group by category
  for (const s of sources) {
    if (!categoryStats[s.cat]) {
      categoryStats[s.cat] = { total: 0, active: 0, results: 0 };
    }
    categoryStats[s.cat].total++;
    if (s.active) categoryStats[s.cat].active++;
  }

  // Sample one feed per category to see if it works
  const sampleFeeds = Object.keys(categoryStats).map(cat => {
      return sources.find((s: any) => s.cat === cat && s.active);
  });

  console.log("\n--- Category Sampling ---");
  for (const feed of sampleFeeds) {
    if (!feed) continue;
    try {
      const response = await fetch(feed.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      const result = await parser.parseString(xml);
      categoryStats[feed.cat].results = result.items.length;
      console.log(`${feed.cat.padEnd(12)} | Sample: ${feed.name.padEnd(15)} | Items: ${result.items.length}`);
    } catch (e) {
      console.log(`${feed.cat.padEnd(12)} | Sample: ${feed.name.padEnd(15)} | ERROR: ${e.message}`);
    }
  }

  console.log("\n--- Final Stats ---");
  console.log("Category     | Total | Active | Example Result");
  for (const [cat, stats] of Object.entries(categoryStats)) {
    console.log(`${cat.padEnd(12)} | ${stats.total.toString().padEnd(5)} | ${stats.active.toString().padEnd(6)} | ${stats.results}`);
  }
}

checkCategories();
