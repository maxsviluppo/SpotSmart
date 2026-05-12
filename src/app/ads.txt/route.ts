import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Stringa ads.txt standard ufficiale per l'account AdSense associato a SpotSmart / Piazza Cardarelli
  const defaultAdsTxt = "google.com, pub-1385801472165821, DIRECT, f08c47fec0942fa0";
  
  return new NextResponse(defaultAdsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
