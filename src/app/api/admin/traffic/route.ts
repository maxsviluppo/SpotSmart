import { NextResponse } from 'next/server';

let memoryTraffic = { today: 120, total: 1450 };

export async function GET() {
  return NextResponse.json(memoryTraffic);
}
