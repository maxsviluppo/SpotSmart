import { NextResponse } from 'next/server';
import { defaultSeo } from '@/components/SpotSmartApp';

let cachedSeo: Record<string, any> | null = null;

export async function GET() {
  return NextResponse.json(cachedSeo || defaultSeo);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { auth, category, data } = body;

    if (auth?.username !== 'admin' || auth?.password !== 'accessometti') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (!cachedSeo) {
      cachedSeo = { ...defaultSeo };
    }

    if (category && data) {
      cachedSeo[category] = data;
    }

    return new NextResponse("Saved", { status: 200 });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
