import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { auth } = body;

    if (auth?.username !== 'admin' || auth?.password !== 'accessometti') {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    return NextResponse.json({ today: 0, total: 0 });
  } catch (e) {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
