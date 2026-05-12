import { NextResponse } from 'next/server';
import { FEEDS } from '@/components/feeds';

let cachedSources: any[] | null = null;

export async function GET() {
  return NextResponse.json(cachedSources || FEEDS);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { auth, sources } = body;

    if (auth?.username !== 'admin' || auth?.password !== 'accessometti') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (sources && Array.isArray(sources)) {
      cachedSources = sources;
    }

    return new NextResponse("Saved", { status: 200 });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
