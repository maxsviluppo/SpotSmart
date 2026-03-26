import fs from 'fs';
import { FEEDS } from './src/feeds.ts';

const SOURCES_FILE = './.data/news_sources.json';

try {
    const existing: any[] = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
    const existingMap = new Map(existing.map(s => [s.url, s]));
    
    const merged = FEEDS.map(f => {
        const ext = existingMap.get(f.url);
        return {
            ...f,
            active: ext ? ext.active : true
        };
    });
    
    // Add any existing sources that were NOT in FEEDS
    const feedUrls = new Set(FEEDS.map(f => f.url));
    existing.forEach(s => {
        if (!feedUrls.has(s.url)) {
            merged.push({
                id: s.id || `ext-${Math.random().toString(36).substr(2, 9)}`,
                ...s
            });
        }
    });

    fs.writeFileSync(SOURCES_FILE, JSON.stringify(merged, null, 2));
    console.log(`Merged ${merged.length} sources.`);
} catch (e) {
    console.error(e);
}
