import { fetchEnvironmentalContext } from "../../../lib/environment.ts";

export const runtime = "nodejs";
export const maxDuration = 15;

function coordinate(value: string | null, minimum: number, maximum: number) {
  if (value === null || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latitude = coordinate(searchParams.get("latitude"), -90, 90);
  const longitude = coordinate(searchParams.get("longitude"), -180, 180);
  if (latitude === null || longitude === null) {
    return Response.json(
      { error: "Valid latitude and longitude query parameters are required." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const context = await fetchEnvironmentalContext(latitude, longitude, request.signal);
  return Response.json(context, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
