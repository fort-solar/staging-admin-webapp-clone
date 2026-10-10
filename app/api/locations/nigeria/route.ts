import { NextRequest, NextResponse } from "next/server";

const API = "https://countriesnow.space/api/v0.1/countries";

export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get("state")?.trim();

  try {
    const response = await fetch(`${API}/${state ? "state/cities" : "states"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state ? { country: "Nigeria", state } : { country: "Nigeria" }),
      next: { revalidate: 86400 },
    });
    if (!response.ok) throw new Error("Location provider unavailable");

    const payload = await response.json();
    const items = state
      ? payload.data
      : payload.data?.states?.map((item: { name: string }) => item.name);

    return NextResponse.json({ data: Array.isArray(items) ? items : [] });
  } catch {
    return NextResponse.json({ data: [], message: "Location provider unavailable" }, { status: 502 });
  }
}
