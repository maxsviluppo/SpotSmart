import { NextResponse } from 'next/server';

let cachedAnalytics: any = { trackingId: '', enabled: true, verificationTag: '' };

export async function GET() {
  return NextResponse.json(cachedAnalytics);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { auth, data } = body;

    if (auth?.username !== 'admin' || auth?.password !== 'accessometti') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (data) {
      cachedAnalytics = data;
    }

    return new NextResponse("Saved", { status: 200 });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
