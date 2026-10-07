import { SCORING_CONFIG } from "./scoring/config.ts";
import type { WaterwayContext } from "./scoring/environmentalRisk.ts";

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: { name?: string; waterway?: string; natural?: string };
};

export type WeatherContext = {
  status: "available" | "unavailable";
  precipitationMm: number | null;
  probabilityPercent: number | null;
  source: "Open-Meteo";
  message: string;
};

export type EnvironmentalContextResponse = {
  coordinates: { latitude: number; longitude: number };
  weather: WeatherContext;
  waterway: WaterwayContext;
  generatedAt: string;
};

function requestSignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function distanceMeters(fromLat: number, fromLon: number, toLat: number, toLon: number) {
  const earthRadius = 6_371_000;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = toRadians(toLat - fromLat);
  const longitudeDelta = toRadians(toLon - fromLon);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function fetchWeatherContext(latitude: number, longitude: number, signal?: AbortSignal): Promise<WeatherContext> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      daily: "precipitation_sum,precipitation_probability_max",
      timezone: "auto",
      forecast_days: "1",
    }).toString();
    const response = await fetch(url, {
      signal: requestSignal(signal, 8000),
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
    const data = await response.json() as {
      daily?: { precipitation_sum?: unknown[]; precipitation_probability_max?: unknown[] };
    };
    const precipitationMm = finiteNumber(data.daily?.precipitation_sum?.[0]);
    const probabilityPercent = finiteNumber(data.daily?.precipitation_probability_max?.[0]);
    if (precipitationMm === null) throw new Error("Weather response did not contain rainfall");
    return {
      status: "available",
      precipitationMm: Math.max(0, precipitationMm),
      probabilityPercent: probabilityPercent === null ? null : Math.min(100, Math.max(0, probabilityPercent)),
      source: "Open-Meteo",
      message: probabilityPercent === null
        ? `${Math.max(0, precipitationMm).toFixed(1)} mm forecast for the next 24 hours.`
        : `${Math.round(Math.min(100, Math.max(0, probabilityPercent)))}% rain probability · ${Math.max(0, precipitationMm).toFixed(1)} mm / 24h.`,
    };
  } catch {
    return {
      status: "unavailable",
      precipitationMm: null,
      probabilityPercent: null,
      source: "Open-Meteo",
      message: "Live rainfall unavailable. Priority uses visible evidence with lower coverage; no fallback was invented.",
    };
  }
}

export async function fetchWaterwayContext(latitude: number, longitude: number, signal?: AbortSignal): Promise<WaterwayContext> {
  const radius = SCORING_CONFIG.waterway.searchRadiusMeters;
  const query = `[out:json][timeout:8];(node["waterway"~"river|stream|canal"](around:${radius},${latitude},${longitude});way["waterway"~"river|stream|canal"](around:${radius},${latitude},${longitude});way["natural"="water"](around:${radius},${latitude},${longitude});relation["natural"="water"](around:${radius},${latitude},${longitude}););out center tags;`;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "DrainGuard-AI/0.12 environmental-context",
      },
      body: new URLSearchParams({ data: query }),
      signal: requestSignal(signal, 9000),
    });
    if (!response.ok) throw new Error(`Waterway service returned ${response.status}`);
    const data = await response.json() as { elements?: OverpassElement[] };
    const candidates = (data.elements ?? []).flatMap((element) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [{
        distanceMeters: distanceMeters(latitude, longitude, lat as number, lon as number),
        featureName: element.tags?.name,
        featureType: element.tags?.waterway ?? (element.tags?.natural === "water" ? "water body" : "mapped water feature"),
      }];
    });
    const nearest = candidates.reduce<(typeof candidates)[number] | null>((best, candidate) => (
      !best || candidate.distanceMeters < best.distanceMeters ? candidate : best
    ), null);

    if (!nearest) {
      return {
        status: "available",
        distanceMeters: radius,
        source: "OpenStreetMap / Overpass",
        message: `No mapped water feature found within ${radius / 1000} km; bounded proximity concern is low.`,
      };
    }

    return {
      status: "available",
      distanceMeters: Math.round(nearest.distanceMeters),
      featureName: nearest.featureName,
      featureType: nearest.featureType,
      source: "OpenStreetMap / Overpass",
      message: `${nearest.featureName ?? "Mapped water feature"} is approximately ${Math.round(nearest.distanceMeters)} m away.`,
    };
  } catch {
    return {
      status: "unavailable",
      distanceMeters: null,
      source: "OpenStreetMap / Overpass",
      message: "Mapped waterway context unavailable. No proximity value was fabricated.",
    };
  }
}

export async function fetchEnvironmentalContext(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<EnvironmentalContextResponse> {
  const [weather, waterway] = await Promise.all([
    fetchWeatherContext(latitude, longitude, signal),
    fetchWaterwayContext(latitude, longitude, signal),
  ]);
  return {
    coordinates: { latitude, longitude },
    weather,
    waterway,
    generatedAt: new Date().toISOString(),
  };
}
