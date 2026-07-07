import { NextResponse } from "next/server";

// Latin → Devanagari (Nepali) transliteration via Google Input Tools.
// Runs server-side to avoid CORS. Transliterates word-by-word so full
// names come back correctly spaced.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const text = (searchParams.get("text") || "").trim();
  if (!text) return NextResponse.json({ result: "" });

  const words = text.split(/\s+/);
  const converted: string[] = [];

  for (const w of words) {
    if (!w) continue;
    try {
      const url =
        "https://inputtools.google.com/request?itc=ne-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8&text=" +
        encodeURIComponent(w);
      const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const data = await r.json();
      if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]?.[0]) {
        converted.push(data[1][0][1][0]);
      } else {
        converted.push(w);
      }
    } catch {
      converted.push(w); // fall back to the original word on any failure
    }
  }

  return NextResponse.json({ result: converted.join(" ") });
}
