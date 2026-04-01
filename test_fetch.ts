import Parser from "rss-parser";
import fetch from "node-fetch";

const parser = new Parser();
const testUrl = "https://www.ansa.it/sito/ansait_rss.xml";

async function testFetch() {
  console.log("Fetching ANSA Feed...");
  try {
    const res = await fetch(testUrl + "?refresh=" + Date.now());
    const xml = await res.text();
    const feed = await parser.parseString(xml);
    console.log("Feed Title:", feed.title);
    console.log("Last 3 items news dates:");
    feed.items.slice(0, 3).forEach(item => {
      console.log(`- ${item.title}: ${item.pubDate} (Timestamp: ${new Date(item.pubDate).getTime()})`);
    });
  } catch (e) {
    console.error("Test failed:", e);
  }
}

testFetch();
