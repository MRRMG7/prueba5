export interface GeoResult {
  lat: number;
  lon: number;
  nombre: string;
}

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { "Accept-Language": "es" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function nombrePhoton(f: { properties?: Record<string, unknown> } | undefined): string {
  const p = f?.properties ?? {};
  const partes = [p.housenumber, p.street, p.name, p.district, p.city, p.village, p.state, p.postcode, p.country]
    .filter((x): x is string => typeof x === "string" && x.length > 0);
  return [...new Set(partes)].slice(0, 4).join(", ");
}

interface PhotonResponse {
  features?: Array<{
    properties?: Record<string, unknown>;
    geometry?: { coordinates?: number[] };
  }>;
}

interface NominatimItem {
  lat?: string;
  lon?: string;
  display_name?: string;
}

export async function geocodificar(q: string, limite = 1): Promise<GeoResult> {
  const texto = encodeURIComponent(q);
  try {
    const datos = await json<PhotonResponse>(
      `https://photon.komoot.io/api/?q=${texto}&limit=${limite}&lang=es&countrycode=SV`,
    );
    const datos2 = datos?.features ?? [];
    if (!datos2.length) throw new Error("vacío");
    const coords = datos2[0].geometry?.coordinates;
    if (!coords || coords.length < 2) throw new Error("sin coords");
    return {
      lat: coords[1],
      lon: coords[0],
      nombre: nombrePhoton(datos2[0]),
    };
  } catch {
    const datos = await json<NominatimItem[]>(
      `https://nominatim.openstreetmap.org/search?format=json&limit=${limite}&countrycodes=sv&q=${texto}`,
    );
    const lista = Array.isArray(datos) ? datos : [];
    if (!lista.length) throw new Error("No encontrado");
    return {
      lat: parseFloat(lista[0].lat || "0"),
      lon: parseFloat(lista[0].lon || "0"),
      nombre: lista[0].display_name || "",
    };
  }
}

export async function geocodificarInversa(lat: number, lng: number): Promise<string> {
  try {
    const datos = await json<PhotonResponse>(
      `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=es`,
    );
    return nombrePhoton(datos?.features?.[0]);
  } catch {
    try {
      const datos = await json<NominatimItem>(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      );
      return datos?.display_name || "";
    } catch {
      return "";
    }
  }
}