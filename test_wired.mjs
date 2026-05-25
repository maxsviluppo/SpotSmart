import Parser from 'rss-parser';

const parser = new Parser();

async function test() {
  const url = 'https://www.wired.it/feed/';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
      }
    });
    console.log('Status:', res.status);
    console.log('Content-Type:', res.headers.get('content-type'));
    const text = await res.text();
    console.log('Response Snippet:\n', text.slice(0, 1000));
  } catch (e) {
    console.error(e);
  }
}

test();
