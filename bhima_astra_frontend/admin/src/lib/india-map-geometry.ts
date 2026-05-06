type LonLatRing = [number, number][];

/** Minimal GeoJSON fragment for India admin boundary. */
export type IndiaFeatureCollection = {
  features: Array<{
    geometry: {
      type: string;
      coordinates: number[][][] | number[][][][];
    };
  }>;
};

export interface IndiaSceneBuild {
  /** True when grid cell center lies inside India (mainland admin outline). */
  gridInside: boolean[];
  /** Outer boundary in scene XZ (same space as graph wave). */
  borderXZ: { x: number; z: number }[];
  /** Shape placeholder (Three.js removed for strict stack). */
  landShape: any;
}

function bboxFromRing(ring: LonLatRing): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of ring) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  return { minLon, maxLon, minLat, maxLat };
}

function projectLonLat(
  lon: number,
  lat: number,
  bbox: { minLon: number; maxLon: number; minLat: number; maxLat: number },
  width: number,
  depth: number
): { x: number; z: number } {
  const { minLon, maxLon, minLat, maxLat } = bbox;
  const u = (lon - minLon) / (maxLon - minLon);
  const v = (lat - minLat) / (maxLat - minLat);
  const x = (u - 0.5) * width;
  const z = (0.5 - v) * depth;
  return { x, z };
}

/** Ray-cast; ring is closed polyline in XZ. */
export function pointInPolygonXZ(x: number, z: number, ring: { x: number; z: number }[]): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i].x;
    const zi = ring[i].z;
    const xj = ring[j].x;
    const zj = ring[j].z;
    const intersect = zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-14) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getOuterRing(fc: IndiaFeatureCollection): LonLatRing {
  const f = fc.features[0];
  if (!f) return [];
  const g = f.geometry;
  if (g.type === 'Polygon') {
    return (g.coordinates as number[][][])[0] as LonLatRing;
  }
  if (g.type === 'MultiPolygon') {
    let best: LonLatRing = [];
    let bestA = 0;
    for (const poly of g.coordinates as number[][][][]) {
      const ring = poly[0] as LonLatRing;
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      a = Math.abs(a);
      if (a > bestA) {
        bestA = a;
        best = ring;
      }
    }
    return best;
  }
  return [];
}

/**
 * Build India land mesh data aligned to the graph wave grid (public-domain admin outline).
 * Source: simplified country polygon (e.g. world.geo.json–style open data), no API key.
 */
export function buildIndiaSceneForGrid(
  fc: IndiaFeatureCollection,
  cols: number,
  rows: number,
  width: number,
  depth: number
): IndiaSceneBuild {
  const outerLonLat = getOuterRing(fc);
  const bbox = bboxFromRing(outerLonLat);
  const borderXZ = outerLonLat.map(([lon, lat]) => projectLonLat(lon, lat, bbox, width, depth));
  const ringForHit = borderXZ.map((p) => ({ x: p.x, z: p.z }));

  const gridInside: boolean[] = [];
  for (let rz = 0; rz < rows; rz++) {
    for (let rx = 0; rx < cols; rx++) {
      const x = (rx / (cols - 1) - 0.5) * width;
      const z = (rz / (rows - 1) - 0.5) * depth;
      gridInside.push(pointInPolygonXZ(x, z, ringForHit));
    }
  }

  const shape: any = {};
  if (borderXZ.length > 2) {
    // no-op placeholder when Three.js is not available
    for (let k = 1; k < borderXZ.length; k++) {
      // no-op placeholder
    }
    // no-op placeholder
  }

  return { gridInside, borderXZ, landShape: shape };
}

export function borderLinePositionsXZ(borderXZ: { x: number; z: number }[], y: number): Float32Array {
  const n = borderXZ.length;
  const arr = new Float32Array(n * 3);
  let o = 0;
  for (const p of borderXZ) {
    arr[o++] = p.x;
    arr[o++] = y;
    arr[o++] = p.z;
  }
  return arr;
}
