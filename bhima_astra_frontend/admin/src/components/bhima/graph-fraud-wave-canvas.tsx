import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import * as THREE from 'three';
import type { GraphFraudResult } from '../../lib/types';

const COLS = 52;
const ROWS = 34;
const COUNT = COLS * ROWS;
const WIDTH = 5.35;
const DEPTH = 3.45;

interface GraphFraudWaveCanvasProps {
  graphResult: GraphFraudResult | null;
  isGraphActive: boolean;
  highlightCluster: boolean;
  waveSeed: number;
}

function normToGrid(nx: number, ny: number): number {
  const gx = Math.min(COLS - 1, Math.max(0, Math.floor(nx * (COLS - 1))));
  const gz = Math.min(ROWS - 1, Math.max(0, Math.floor(ny * (ROWS - 1))));
  return gz * COLS + gx;
}

function waveHeight(x: number, z: number, t: number): number {
  return (
    Math.sin(x * 2.05 + t * 0.92) * Math.cos(z * 1.82 + t * 0.68) * 0.29 +
    Math.sin((x + z) * 3.15 + t * 1.12) * 0.1 +
    Math.sin(x * 4.9 - t * 0.38) * Math.sin(z * 4.1 + t * 0.2) * 0.045
  );
}

function workerGridIndices(graphResult: GraphFraudResult | null): number[] {
  if (!graphResult?.nodes.length) return [];
  return graphResult.nodes.map((n) => normToGrid(n.x, n.y));
}

function workerClusterGridSet(graphResult: GraphFraudResult | null): Set<number> {
  const s = new Set<number>();
  if (!graphResult) return s;
  graphResult.nodes.forEach((n) => {
    if (n.inSuspiciousCluster) s.add(normToGrid(n.x, n.y));
  });
  return s;
}

function dedupeEdges(graph: GraphFraudResult): { a: string; b: string }[] {
  const seen = new Set<string>();
  const out: { a: string; b: string }[] = [];
  for (const e of graph.edges) {
    const k = e.from < e.to ? `${e.from}|${e.to}` : `${e.to}|${e.from}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ a: e.from, b: e.to });
  }
  return out;
}

function WaveField({ graphResult, isGraphActive, highlightCluster, waveSeed }: GraphFraudWaveCanvasProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bases = useMemo(() => {
    const arr = new Float32Array(COUNT * 2);
    let i = 0;
    for (let rz = 0; rz < ROWS; rz++) {
      for (let rx = 0; rx < COLS; rx++) {
        const x = (rx / (COLS - 1) - 0.5) * WIDTH;
        const z = (rz / (ROWS - 1) - 0.5) * DEPTH;
        arr[i++] = x;
        arr[i++] = z;
      }
    }
    return arr;
  }, []);

  const workerGrids = useMemo(() => workerGridIndices(graphResult), [graphResult]);
  const workerSet = useMemo(() => new Set(workerGrids), [workerGrids]);
  const clusterGrid = useMemo(() => workerClusterGridSet(graphResult), [graphResult]);

  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 5, 4), []);
  const sphereMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(0xffffff),
        toneMapped: false,
      }),
    []
  );

  const { camera, pointer } = useThree();
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const ripple = useRef({ x: 0, z: 0, amp: 0 });

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || mesh.instanceColor) return;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(COUNT * 3), 3);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime + waveSeed * 0.0001;
    const mesh = meshRef.current;
    if (!mesh || !mesh.instanceColor) return;

    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit)) {
      ripple.current.x = hit.x;
      ripple.current.z = hit.z;
      ripple.current.amp = Math.min(1.05, ripple.current.amp + 0.04);
    }
    ripple.current.amp *= 0.988;

    const col = mesh.instanceColor.array as Float32Array;
    const hasWorkers = workerGrids.length > 0;
    let focusIdx = -1;
    if (hasWorkers && isGraphActive) {
      const len = workerGrids.length;
      const slot = ((Math.floor(t * 1.15) + (waveSeed % 2047)) % len + len) % len;
      focusIdx = workerGrids[slot]!;
    }

    for (let i = 0; i < COUNT; i++) {
      const x = bases[i * 2];
      const z = bases[i * 2 + 1];
      const isWorker = workerSet.has(i);

      let y = waveHeight(x, z, t);
      const dx = x - ripple.current.x;
      const dz = z - ripple.current.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      y += ripple.current.amp * 0.24 * Math.exp(-d * d * 3.4) * Math.sin(d * 15 - t * 7.5);

      dummy.position.set(x, y, z);
      const dist = Math.sqrt(x * x + z * z);
      const horizon = Math.min(1, 0.32 + 0.68 * (1 - dist / 3.95));

      let baseScale = (isWorker ? 0.034 : 0.026) * horizon;
      let br = (isWorker ? 0.08 : 0.045) + (isWorker ? 0.22 : 0.18) * horizon;

      if (isWorker && graphResult) {
        const pulse = 0.78 + 0.22 * Math.sin(t * (isGraphActive ? 6.5 : 2.9) + i * 0.37);
        let mult = isGraphActive ? 2.45 : 1.35;
        if (highlightCluster && clusterGrid.has(i)) mult *= 1.18;
        if (isGraphActive && i === focusIdx) mult *= 1.32;
        baseScale *= mult * pulse;
        br = Math.min(1, br + 0.48 * pulse);
      }

      dummy.scale.setScalar(baseScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const o = i * 3;
      col[o] = col[o + 1] = col[o + 2] = br;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[sphereGeo, sphereMat, COUNT]} frustumCulled={false} />;
}

function GraphEdgeLines({
  graphResult,
  isGraphActive,
  highlightCluster,
}: {
  graphResult: GraphFraudResult;
  isGraphActive: boolean;
  highlightCluster: boolean;
}) {
  const lineRef = useRef<THREE.LineSegments>(null);
  const edges = useMemo(() => dedupeEdges(graphResult), [graphResult]);
  const maxVerts = Math.max(2, edges.length * 2);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(maxVerts * 3), 3));
    return g;
  }, [maxVerts]);

  const idToNorm = useMemo(() => {
    const m = new Map<string, { x: number; y: number; cl: boolean }>();
    graphResult.nodes.forEach((n) => m.set(n.id, { x: n.x, y: n.y, cl: n.inSuspiciousCluster }));
    return m;
  }, [graphResult]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const mesh = lineRef.current;
    if (!mesh) return;
    const pos = mesh.geometry.attributes.position.array as Float32Array;
    let p = 0;

    const xyz = (nx: number, ny: number) => {
      const x = (nx - 0.5) * WIDTH;
      const z = (ny - 0.5) * DEPTH;
      const y = waveHeight(x, z, t) + 0.06;
      return [x, y, z] as const;
    };

    for (const e of edges) {
      const A = idToNorm.get(e.a);
      const B = idToNorm.get(e.b);
      if (!A || !B) continue;
      const [x1, y1, z1] = xyz(A.x, A.y);
      const [x2, y2, z2] = xyz(B.x, B.y);
      pos[p++] = x1;
      pos[p++] = y1;
      pos[p++] = z1;
      pos[p++] = x2;
      pos[p++] = y2;
      pos[p++] = z2;
    }
    mesh.geometry.setDrawRange(0, p / 3);
    mesh.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <lineSegments ref={lineRef} frustumCulled={false}>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial
        color="#ffffff"
        transparent
        opacity={isGraphActive ? 0.62 : highlightCluster ? 0.5 : 0.34}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  );
}

function Scene({ graphResult, isGraphActive, highlightCluster, waveSeed }: GraphFraudWaveCanvasProps) {
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled = isGraphActive;
  }, [isGraphActive]);

  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[2.5, 4, 2]} intensity={0.25} />

      <WaveField graphResult={graphResult} isGraphActive={isGraphActive} highlightCluster={highlightCluster} waveSeed={waveSeed} />
      {graphResult ? (
        <GraphEdgeLines graphResult={graphResult} isGraphActive={isGraphActive} highlightCluster={highlightCluster} />
      ) : null}

      <OrbitControls
        ref={controlsRef}
        enablePan
        enableRotate
        enableZoom
        dampingFactor={0.12}
        enableDamping
        minDistance={3.2}
        maxDistance={9.0}
        rotateSpeed={0.8}
        zoomSpeed={0.85}
        panSpeed={0.65}
      />
    </>
  );
}

export function GraphFraudWaveCanvas({ graphResult, isGraphActive, highlightCluster, waveSeed }: GraphFraudWaveCanvasProps) {
  return (
    <div className="absolute inset-0 min-h-0 min-w-0" data-graph-viewport>
      <Canvas
        camera={{ position: [0, 1.9, 4.75], fov: 52 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
        frameloop="always"
      >
        <Scene graphResult={graphResult} isGraphActive={isGraphActive} highlightCluster={highlightCluster} waveSeed={waveSeed} />
      </Canvas>
      <div
        className="pointer-events-none absolute bottom-1.5 right-2 z-10 font-mono text-[8px] uppercase tracking-[0.2em]"
        style={{ color: 'rgba(255,255,255,0.28)', lineHeight: 1.4 }}
      >
        drag orbit · scroll zoom · ripple
      </div>
    </div>
  );
}
