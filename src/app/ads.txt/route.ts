import { NextResponse } from 'next/server';

export async function GET() {
  const defaultAdsTxt = "google.com, pub-1385801472165821, DIRECT, f08c47fec0942fa0";
  
  return new NextResponse(defaultAdsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
