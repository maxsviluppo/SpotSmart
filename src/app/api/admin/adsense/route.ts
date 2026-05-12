import { NextResponse } from 'next/server';

let cachedAdSense: any = { enabled: false, client: "", script: "", adsTxt: "", metaTag: "" };

export async function GET() {
  return NextResponse.json(cachedAdSense);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { auth, data } = body;

    if (auth?.username !== 'admin' || auth?.password !== 'accessometti') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    if (data) {
      cachedAdSense = data;
    }

    return new NextResponse("Saved Successfully", { status: 200 });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
