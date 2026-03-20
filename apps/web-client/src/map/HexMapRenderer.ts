import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useGameStore } from '../store/gameStore';
import type { ProvinceClientState } from '../store/gameStore';

// ── Nation colors ────────────────────────────────────────────────────────────

const NATION_COLORS: Record<string, { primary: string }> = {
  USA: { primary: '#1C4E8A' },
  RUS: { primary: '#CC0000' },
  CHN: { primary: '#CC0000' },
  GBR: { primary: '#012169' },
  EUF: { primary: '#003399' },
  PRK: { primary: '#024FA2' },
  IRN: { primary: '#239F40' },
  IND: { primary: '#FF9933' },
  PAK: { primary: '#01411C' },
  SAU: { primary: '#006C35' },
  ISR: { primary: '#0038B8' },
  TUR: { primary: '#E30A17' },
};

const DEFAULT_NATION_COLOR = '#2A3F60';
const HEX_SIZE = 1.0;
const BORDER_INSET = 0.05;
const CAPITAL_EMISSIVE = 0.35;
const HOVER_EMISSIVE = 0.5;
const SELECT_EMISSIVE = 0.8;
const EXPAND_RINGS = 3;

// Terrain textures
const TERRAIN_TEXTURE_PATHS: Record<string, string> = {
  plains:   '/assets/terrain/plains.avif',
  forest:   '/assets/terrain/forest.avif',
  mountain: '/assets/terrain/mountain.avif',
  desert:   '/assets/terrain/desert.avif',
  urban:    '/assets/terrain/urban.avif',
  arctic:   '/assets/terrain/arctic.avif',
  coastal:  '/assets/terrain/coastal.avif',
  ocean:    '/assets/terrain/ocean.avif',
};

// Flat-top hex neighbor directions (q, r offsets)
const HEX_DIRS: [number, number][] = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

// ── World-map calibration ─────────────────────────────────────────────────────
//
// Derived from known province centroids vs real-world lon/lat:
//   DC  (lon=-77,  lat=38.9) → pixel (-145.5, -52.8)
//   London (lon=-0.1, lat=51.5) → pixel (-3, -46.8)
//
// Longitude fits well to a linear x transform:
//   lon  = 0.5396 * x_pixel + 1.52
//   x at lon=-180 → -336    x at lon=+180 → +331
//   World map plane: width=667, centerX=-2.8
//
// Latitude/z: the flat-top hex grid shears z by longitude, so z doesn't map
// cleanly to lat. Use a rough vertical range of z=-115..+125 (220 units tall)
// centered at z=5. Labels on provinces make it easy to verify placement.
//
const WORLDMAP = {
  x:      -2.8,   // center x (world units)
  z:       5,     // center z (world units)
  width:   667,   // world units
  height:  333.5, // world units — width/2 (equirectangular ±90° at same scale as x)
  y:       0.5,   // above hex tiles — overlays everything as semi-transparent reference
};

// ── Hex math ──────────────────────────────────────────────────────────────────

function hexToPixel(q: number, r: number): { x: number; z: number } {
  return {
    x: HEX_SIZE * 1.5 * q,
    z: HEX_SIZE * Math.sqrt(3) * (r + q * 0.5),
  };
}

function cubeDistance(q1: number, r1: number, q2: number, r2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs((-q1 - r1) - (-q2 - r2)));
}

function buildHexShape(cx: number, cz: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i);
    const vx = cx + radius * Math.cos(a);
    const vy = cz + radius * Math.sin(a);
    if (i === 0) shape.moveTo(vx, vy); else shape.lineTo(vx, vy);
  }
  shape.closePath();
  return shape;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProvinceMeshData {
  provinceId: string;
  fillMesh: THREE.Mesh;
  borderMesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  borderMaterial: THREE.MeshStandardMaterial;
  baseColor: THREE.Color;
  isCapital: boolean;
  centroidPixel: { x: number; z: number };
}

export interface ProvinceLabel {
  id: string;
  name: string;
  nation: string;
  isCapital: boolean;
  worldX: number;
  worldZ: number;
}

// ── HexMapRenderer ────────────────────────────────────────────────────────────

export class HexMapRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private animFrameId: number | null = null;

  private provinceMap = new Map<string, ProvinceMeshData>();
  private meshToProvince = new Map<string, string>();
  private pickableMeshes: THREE.Mesh[] = [];
  private oceanPlane: THREE.Mesh | null = null;
  private worldMapPlane: THREE.Mesh | null = null;

  private hoveredId: string | null = null;
  private selectedId: string | null = null;
  private zoom = 1.0;
  private panX = 0;
  private panZ = 0;
  private isPanning = false;
  private lastPointer = { x: 0, y: 0 };
  private canvasWidth = 1;
  private canvasHeight = 1;

  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;

  private terrainTextures = new Map<string, THREE.Texture>();
  private textureLoader = new THREE.TextureLoader();
  private storeUnsub: (() => void) | null = null;

  // Label data exposed for the 2D canvas overlay
  private labelData: ProvinceLabel[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x07090d, 1);
    this.renderer.shadowMap.enabled = false;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x07090d);

    this.canvasWidth = canvas.clientWidth || canvas.width;
    this.canvasHeight = canvas.clientHeight || canvas.height;
    this.camera = this.makeCamera(this.canvasWidth, this.canvasHeight);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(this.ambientLight);
    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    this.dirLight.position.set(0, 100, 0);
    this.scene.add(this.dirLight);

    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('click', this.onClick);
    canvas.addEventListener('wheel', this.onWheel, { passive: false });
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('mouseleave', this.onMouseLeave);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    this.storeUnsub = useGameStore.subscribe((s) => {
      this.syncHoverSelect(s.hoveredProvinceId, s.selectedProvinceId);
    });

    this.startLoop();
  }

  // ── Camera ────────────────────────────────────────────────────────────────

  private makeCamera(w: number, h: number): THREE.OrthographicCamera {
    const aspect = w / h;
    const viewH = 60;
    const viewW = viewH * aspect;
    const cam = new THREE.OrthographicCamera(-viewW / 2, viewW / 2, viewH / 2, -viewH / 2, 0.1, 1000);
    cam.position.set(0, 100, 0);
    cam.lookAt(0, 0, 0);
    cam.up.set(0, 0, -1);
    cam.zoom = this.zoom;
    cam.updateProjectionMatrix();
    return cam;
  }

  resize(w: number, h: number): void {
    this.canvasWidth = w;
    this.canvasHeight = h;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const viewH = 60;
    const viewW = viewH * aspect;
    this.camera.left = -viewW / 2;
    this.camera.right = viewW / 2;
    this.camera.top = viewH / 2;
    this.camera.bottom = -viewH / 2;
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  // ── Texture loading ───────────────────────────────────────────────────────

  async preloadTextures(): Promise<void> {
    // Terrain tiles
    await Promise.allSettled(
      Object.entries(TERRAIN_TEXTURE_PATHS).map(([terrain, path]) =>
        new Promise<void>((resolve) => {
          this.textureLoader.load(path, (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(1, 1);
            tex.colorSpace = THREE.SRGBColorSpace;
            this.terrainTextures.set(terrain, tex);
            resolve();
          }, undefined, () => resolve());
        })
      )
    );

    // World map reference image (optional — silently skipped if missing)
    await new Promise<void>((resolve) => {
      this.textureLoader.load('/assets/worldmap.avif', (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const img = tex.image as HTMLImageElement;
        const ratio = img.width / img.height;
        // WORLDMAP.width covers lon -180→+180. Height is derived from image aspect.
        // A proper 2:1 equirectangular map → height = width/2 = 333.5
        // Log so the user can verify their image.
        // Equirectangular world maps must be 2:1. If yours is square (1:1) it needs
        // to be replaced with a proper 2:1 image (e.g. NASA Black Marble 2048×1024).
        console.info(
          `[worldmap] image ${img.width}×${img.height} (${ratio.toFixed(3)}:1). ` +
          `Need 2:1 equirectangular. Forcing geographic height = width/2.`
        );
        this.buildWorldMapPlane(tex, undefined, undefined, undefined, WORLDMAP.width / 2);
        resolve();
      }, undefined, () => resolve());
    });
  }

  private worldMapTex: THREE.Texture | null = null;

  private buildWorldMapPlane(tex: THREE.Texture, cx?: number, cz?: number, w?: number, h?: number): void {
    this.worldMapTex = tex;
    if (this.worldMapPlane) {
      this.scene.remove(this.worldMapPlane);
      this.worldMapPlane.geometry.dispose();
      (this.worldMapPlane.material as THREE.Material).dispose();
    }
    const planeW = w ?? WORLDMAP.width;
    const planeH = h ?? WORLDMAP.height;
    const planeCX = cx ?? WORLDMAP.x;
    const planeCZ = cz ?? WORLDMAP.z;
    const geo = new THREE.PlaneGeometry(planeW, planeH);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
      depthTest: false,
    });
    this.worldMapPlane = new THREE.Mesh(geo, mat);
    this.worldMapPlane.renderOrder = 999;
    this.worldMapPlane.rotation.x = -Math.PI / 2;
    this.worldMapPlane.position.set(planeCX, WORLDMAP.y, planeCZ);
    this.scene.add(this.worldMapPlane);
  }

  // ── Voronoi BFS expansion ─────────────────────────────────────────────────

  private buildExpandedHexMap(
    provinces: ProvinceClientState[]
  ): Map<string, { q: number; r: number }[]> {
    const claimed = new Map<string, string>();
    const result = new Map<string, { q: number; r: number }[]>();
    const frontiers = new Map<string, { q: number; r: number }[]>();

    for (const p of provinces) {
      const hexes = p.hexCoords.map(h => ({ q: h.q, r: h.r }));
      result.set(p.id, [...hexes]);
      frontiers.set(p.id, [...hexes]);
      for (const h of hexes) claimed.set(`${h.q},${h.r}`, p.id);
    }

    for (let ring = 0; ring < EXPAND_RINGS; ring++) {
      const nextFrontiers = new Map<string, { q: number; r: number }[]>();
      for (const p of provinces) {
        const { q: cq, r: cr } = p.centroidHex;
        const frontier = frontiers.get(p.id)!;
        const hexes = result.get(p.id)!;
        const next: { q: number; r: number }[] = [];
        for (const h of frontier) {
          for (const [dq, dr] of HEX_DIRS) {
            const nq = h.q + dq, nr = h.r + dr;
            if (cubeDistance(nq, nr, cq, cr) > EXPAND_RINGS) continue;
            const key = `${nq},${nr}`;
            if (!claimed.has(key)) {
              claimed.set(key, p.id);
              hexes.push({ q: nq, r: nr });
              next.push({ q: nq, r: nr });
            }
          }
        }
        nextFrontiers.set(p.id, next);
      }
      for (const [id, f] of nextFrontiers) frontiers.set(id, f);
      if ([...nextFrontiers.values()].every(f => f.length === 0)) break;
    }
    return result;
  }

  // ── Province mesh building ────────────────────────────────────────────────

  loadProvinces(provinces: ProvinceClientState[]): void {
    // Dispose existing
    for (const d of this.provinceMap.values()) {
      d.fillMesh.geometry.dispose();
      d.borderMesh.geometry.dispose();
      d.material.dispose();
      d.borderMaterial.dispose();
      this.scene.remove(d.fillMesh);
      this.scene.remove(d.borderMesh);
    }
    this.provinceMap.clear();
    this.meshToProvince.clear();
    this.pickableMeshes = [];
    this.labelData = [];

    const expanded = this.buildExpandedHexMap(provinces);

    for (const p of provinces) {
      const hexes = expanded.get(p.id) ?? p.hexCoords.map(h => ({ q: h.q, r: h.r }));
      this.buildProvinceMeshes(p, hexes);
    }

    // Bounds for ocean plane
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const d of this.provinceMap.values()) {
      const bb = new THREE.Box3().setFromObject(d.fillMesh);
      minX = Math.min(minX, bb.min.x); maxX = Math.max(maxX, bb.max.x);
      minZ = Math.min(minZ, bb.min.z); maxZ = Math.max(maxZ, bb.max.z);
    }

    if (this.oceanPlane) {
      this.scene.remove(this.oceanPlane);
      this.oceanPlane.geometry.dispose();
      (this.oceanPlane.material as THREE.Material).dispose();
      this.oceanPlane = null;
    }
    if (isFinite(minX)) {
      const px = (maxX - minX) * 0.08 + 5, pz = (maxZ - minZ) * 0.08 + 5;
      const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
      const pw = maxX - minX + px * 2, ph = maxZ - minZ + pz * 2;
      const oceanTex = this.terrainTextures.get('ocean') ?? null;
      if (oceanTex) { oceanTex.wrapS = oceanTex.wrapT = THREE.RepeatWrapping; oceanTex.repeat.set(pw / 15, ph / 15); }
      const oceanMat = new THREE.MeshStandardMaterial({ color: 0x0d2b45, map: oceanTex, roughness: 0.9 });
      this.oceanPlane = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), oceanMat);
      this.oceanPlane.rotation.x = -Math.PI / 2;
      this.oceanPlane.position.set(cx, -0.05, cz);
      this.scene.add(this.oceanPlane);
    }

    // Rebuild worldmap plane (texture was already sized by image aspect ratio on load)
    if (this.worldMapTex) {
      this.buildWorldMapPlane(this.worldMapTex, undefined, undefined, undefined, WORLDMAP.width / 2);
    }

    this.centerCamera();
  }

  private buildProvinceMeshes(
    province: ProvinceClientState,
    expandedHexes: { q: number; r: number }[]
  ): void {
    const nationInfo = NATION_COLORS[province.nation];
    const primaryHex = nationInfo?.primary ?? DEFAULT_NATION_COLOR;
    const baseColor = new THREE.Color(primaryHex);
    const terrainTex = this.terrainTextures.get(province.terrain) ?? null;

    const tintColor = terrainTex
      ? new THREE.Color(0xffffff).lerp(baseColor, 0.4)
      : (province.isCapital ? baseColor.clone().multiplyScalar(1.4) : baseColor.clone());

    const material = new THREE.MeshStandardMaterial({
      color: tintColor, map: terrainTex, roughness: 0.85, metalness: 0,
      emissive: province.isCapital ? baseColor.clone().multiplyScalar(0.25) : new THREE.Color(0),
      emissiveIntensity: province.isCapital ? CAPITAL_EMISSIVE : 0,
    });
    const borderColor = baseColor.clone().multiplyScalar(1.3).lerp(new THREE.Color(0xffffff), 0.15);
    const borderMaterial = new THREE.MeshStandardMaterial({ color: borderColor, roughness: 1.0 });

    const rotMat = new THREE.Matrix4().makeRotationX(-Math.PI / 2);
    const borderRotMat = new THREE.Matrix4().multiplyMatrices(
      new THREE.Matrix4().makeTranslation(0, -0.01, 0), rotMat
    );

    const fillGeos: THREE.BufferGeometry[] = [];
    const borderGeos: THREE.BufferGeometry[] = [];

    for (const hex of expandedHexes) {
      const { x, z } = hexToPixel(hex.q, hex.r);
      // buildHexShape puts z in the 2D Y slot; rotateX(-π/2) maps Y→-Z, so negate
      // z here so the final 3D Z = hexToPixel.z (matching labels and worldmap).
      const fg = new THREE.ShapeGeometry(buildHexShape(x, -z, HEX_SIZE * (1 - BORDER_INSET)));
      fg.applyMatrix4(rotMat);
      fillGeos.push(fg);
      const bg = new THREE.ShapeGeometry(buildHexShape(x, -z, HEX_SIZE * 0.99));
      bg.applyMatrix4(borderRotMat);
      borderGeos.push(bg);
    }

    const fillMesh = new THREE.Mesh(mergeGeometries(fillGeos), material);
    const borderMesh = new THREE.Mesh(mergeGeometries(borderGeos), borderMaterial);
    fillGeos.forEach(g => g.dispose());
    borderGeos.forEach(g => g.dispose());

    fillMesh.userData['provinceId'] = province.id;
    this.scene.add(fillMesh);
    this.scene.add(borderMesh);
    this.meshToProvince.set(fillMesh.uuid, province.id);
    this.pickableMeshes.push(fillMesh);

    // Capital cone marker
    const centPx = hexToPixel(province.centroidHex.q, province.centroidHex.r);
    if (province.isCapital) {
      const markerMat = new THREE.MeshStandardMaterial({
        color: 0xffdd44, emissive: new THREE.Color(0xffdd44), emissiveIntensity: 1.2,
      });
      const marker = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), markerMat);
      marker.position.set(centPx.x, 0.3, centPx.z);
      marker.rotation.y = Math.PI / 4;
      this.scene.add(marker);
    }

    this.provinceMap.set(province.id, {
      provinceId: province.id, fillMesh, borderMesh, material, borderMaterial,
      baseColor, isCapital: province.isCapital, centroidPixel: centPx,
    });

    // Register label
    this.labelData.push({
      id: province.id,
      name: province.name,
      nation: province.nation,
      isCapital: province.isCapital,
      worldX: centPx.x,
      worldZ: centPx.z,
    });
  }

  // ── Camera / center ───────────────────────────────────────────────────────

  private centerCamera(): void {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const d of this.provinceMap.values()) {
      const bb = new THREE.Box3().setFromObject(d.fillMesh);
      minX = Math.min(minX, bb.min.x); maxX = Math.max(maxX, bb.max.x);
      minZ = Math.min(minZ, bb.min.z); maxZ = Math.max(maxZ, bb.max.z);
    }
    if (!isFinite(minX)) return;
    this.panX = (minX + maxX) / 2;
    this.panZ = (minZ + maxZ) / 2;
    this.camera.position.set(this.panX, 100, this.panZ);
    this.camera.lookAt(this.panX, 0, this.panZ);
    const viewH = 60, viewW = viewH * (this.canvasWidth / this.canvasHeight);
    this.zoom = Math.min(viewW / (maxX - minX + 4), viewH / (maxZ - minZ + 4));
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  }

  // ── Label projection (for 2D canvas overlay) ──────────────────────────────

  getLabels(): ProvinceLabel[] { return this.labelData; }

  projectToScreen(worldX: number, worldZ: number): { x: number; y: number } | null {
    const v = new THREE.Vector3(worldX, 0, worldZ);
    v.project(this.camera);
    if (v.z > 1 || v.z < -1) return null;
    return {
      x: (v.x + 1) / 2 * this.canvasWidth,
      y: (-v.y + 1) / 2 * this.canvasHeight,
    };
  }

  // ── Highlight ─────────────────────────────────────────────────────────────

  private syncHoverSelect(h: string | null, s: string | null): void {
    if (this.hoveredId && this.hoveredId !== s) this.setHighlight(this.hoveredId, 'normal');
    if (this.selectedId && this.selectedId !== h) this.setHighlight(this.selectedId, 'normal');
    this.hoveredId = h; this.selectedId = s;
    if (s) this.setHighlight(s, 'selected');
    if (h && h !== s) this.setHighlight(h, 'hover');
  }

  private setHighlight(id: string, mode: 'normal' | 'hover' | 'selected'): void {
    const d = this.provinceMap.get(id);
    if (!d) return;
    const m = d.material;
    if (mode === 'normal') {
      m.emissive.set(d.isCapital ? d.baseColor.clone().multiplyScalar(0.25) : new THREE.Color(0));
      m.emissiveIntensity = d.isCapital ? CAPITAL_EMISSIVE : 0;
    } else if (mode === 'hover') {
      m.emissive.set(0x88aaff); m.emissiveIntensity = HOVER_EMISSIVE;
    } else {
      m.emissive.set(0xe8a020); m.emissiveIntensity = SELECT_EMISSIVE;
    }
  }

  // ── Mouse ─────────────────────────────────────────────────────────────────

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    if (this.isPanning) {
      const dx = e.clientX - this.lastPointer.x, dy = e.clientY - this.lastPointer.y;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      const viewH = 60 / this.zoom, viewW = viewH * (this.canvasWidth / this.canvasHeight);
      this.panX -= dx * (viewW / this.canvasWidth);
      this.panZ -= dy * (viewH / this.canvasHeight);
      this.camera.position.set(this.panX, 100, this.panZ);
      this.camera.lookAt(this.panX, 0, this.panZ);
      return;
    }
    const hit = this.raycastProvince();
    const store = useGameStore.getState();
    if (hit !== store.hoveredProvinceId) store.hoverProvince(hit);
  };

  private onClick = (): void => {
    const hit = this.raycastProvince();
    const store = useGameStore.getState();
    store.selectProvince(hit === store.selectedProvinceId ? null : hit);
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.zoom = Math.max(0.3, Math.min(12, this.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = true;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.renderer.domElement.style.cursor = 'grabbing';
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 1 || e.button === 2) {
      this.isPanning = false;
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private onMouseLeave = (): void => {
    this.isPanning = false;
    this.renderer.domElement.style.cursor = 'default';
    useGameStore.getState().hoverProvince(null);
  };

  // ── Raycast ───────────────────────────────────────────────────────────────

  private raycastProvince(): string | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.pickableMeshes);
    if (!hits.length) return null;
    return this.meshToProvince.get(hits[0]!.object.uuid) ?? null;
  }

  // ── Render loop ───────────────────────────────────────────────────────────

  private startLoop(): void {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  // ── Dispose ───────────────────────────────────────────────────────────────

  dispose(): void {
    if (this.animFrameId !== null) cancelAnimationFrame(this.animFrameId);
    const c = this.renderer.domElement;
    c.removeEventListener('mousemove', this.onMouseMove);
    c.removeEventListener('click', this.onClick);
    c.removeEventListener('wheel', this.onWheel);
    c.removeEventListener('mousedown', this.onMouseDown);
    c.removeEventListener('mouseup', this.onMouseUp);
    c.removeEventListener('mouseleave', this.onMouseLeave);
    for (const d of this.provinceMap.values()) {
      d.fillMesh.geometry.dispose(); d.borderMesh.geometry.dispose();
      d.material.dispose(); d.borderMaterial.dispose();
    }
    this.provinceMap.clear(); this.meshToProvince.clear(); this.pickableMeshes = [];
    if (this.oceanPlane) { this.scene.remove(this.oceanPlane); this.oceanPlane.geometry.dispose(); (this.oceanPlane.material as THREE.Material).dispose(); }
    if (this.worldMapPlane) { this.scene.remove(this.worldMapPlane); this.worldMapPlane.geometry.dispose(); (this.worldMapPlane.material as THREE.Material).dispose(); }
    if (this.storeUnsub) this.storeUnsub();
    this.renderer.dispose();
  }
}
