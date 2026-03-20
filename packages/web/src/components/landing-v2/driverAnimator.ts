import type { Map as MapLibreMap } from 'maplibre-gl';

interface DriverDot {
  path: [number, number][]; // pixel coords
  totalLength: number; // cached path length
  progress: number; // 0–1
  speed: number; // progress per frame
  color: string;
  radius: number;
}

const AMBER = '#F59E0B';
const GREEN = '#10B981';
const DOT_COUNT = 10;
const AMBER_COUNT = 7;

export class DriverAnimator {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private dots: DriverDot[] = [];
  private rafId: number | null = null;
  private map: MapLibreMap;
  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(map: MapLibreMap, container: HTMLElement) {
    this.map = map;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'hero-driver-canvas';
    this.canvas.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;';
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', this.debouncedResize);
  }

  private resize = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = parent.getBoundingClientRect();
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private debouncedResize = () => {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(this.resize, 100);
  };

  start() {
    const paths = this.extractRoads();
    if (paths.length === 0) return;

    this.dots = [];
    for (let i = 0; i < DOT_COUNT; i++) {
      const path = paths[i % paths.length];
      this.dots.push({
        path,
        totalLength: pathLength(path),
        progress: Math.random(),
        speed: 0.0004 + Math.random() * 0.0006,
        color: i < AMBER_COUNT ? AMBER : GREEN,
        radius: 3.5 + Math.random() * 1.5,
      });
    }

    this.animate();
  }

  private extractRoads(): [number, number][][] {
    let features;
    try {
      features = this.map.queryRenderedFeatures(undefined, {
        layers: ['road-primary'],
      });
    } catch {
      features = [];
    }

    const paths: [number, number][][] = [];
    for (const f of features) {
      if (f.geometry.type === 'LineString') {
        const coords = (f.geometry as GeoJSON.LineString).coordinates;
        if (coords.length >= 10) {
          const px = coords.map((c) => {
            const p = this.map.project([c[0], c[1]]);
            return [p.x, p.y] as [number, number];
          });
          paths.push(px);
        }
      } else if (f.geometry.type === 'MultiLineString') {
        for (const line of (f.geometry as GeoJSON.MultiLineString).coordinates) {
          if (line.length >= 10) {
            const px = line.map((c) => {
              const p = this.map.project([c[0], c[1]]);
              return [p.x, p.y] as [number, number];
            });
            paths.push(px);
          }
        }
      }
    }

    // Sort by path length (longest first), take top 15
    paths.sort((a, b) => pathLength(b) - pathLength(a));
    const result = paths.slice(0, 15);

    // If too few real roads, generate synthetic bezier curves
    if (result.length < 3) {
      const parent = this.canvas.parentElement;
      if (parent) {
        const { width, height } = parent.getBoundingClientRect();
        for (let i = result.length; i < 8; i++) {
          result.push(generateSyntheticPath(width, height));
        }
      }
    }

    return result;
  }

  private animate = () => {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const { width, height } = parent.getBoundingClientRect();
    this.ctx.clearRect(0, 0, width, height);

    for (const dot of this.dots) {
      dot.progress += dot.speed;
      if (dot.progress >= 1) dot.progress -= 1;

      const pos = interpolatePath(dot.path, dot.progress, dot.totalLength);
      const trailPos = interpolatePath(dot.path, Math.max(0, dot.progress - 0.03), dot.totalLength);

      // Glow
      this.ctx.beginPath();
      this.ctx.arc(pos[0], pos[1], dot.radius * 3, 0, Math.PI * 2);
      this.ctx.fillStyle = dot.color + '15'; // 8% opacity
      this.ctx.fill();

      // Trail
      this.ctx.beginPath();
      this.ctx.moveTo(trailPos[0], trailPos[1]);
      this.ctx.lineTo(pos[0], pos[1]);
      this.ctx.strokeStyle = dot.color + '40'; // 25% opacity
      this.ctx.lineWidth = dot.radius * 0.8;
      this.ctx.lineCap = 'round';
      this.ctx.stroke();

      // Main dot
      this.ctx.beginPath();
      this.ctx.arc(pos[0], pos[1], dot.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = dot.color + 'E6'; // 90% opacity
      this.ctx.fill();
    }

    this.rafId = requestAnimationFrame(this.animate);
  };

  destroy() {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    window.removeEventListener('resize', this.debouncedResize);
    this.canvas.remove();
  }
}

export function pathLength(pts: [number, number][]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

export function interpolatePath(pts: [number, number][], t: number, totalLen?: number): [number, number] {
  if (pts.length === 0) return [0, 0];
  if (pts.length === 1) return pts[0];

  const total = totalLen ?? pathLength(pts);
  const targetDist = t * total;
  let accumulated = 0;

  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    const segLen = Math.sqrt(dx * dx + dy * dy);

    if (accumulated + segLen >= targetDist) {
      const frac = segLen > 0 ? (targetDist - accumulated) / segLen : 0;
      return [
        pts[i - 1][0] + dx * frac,
        pts[i - 1][1] + dy * frac,
      ];
    }
    accumulated += segLen;
  }

  return pts[pts.length - 1];
}

export function generateSyntheticPath(w: number, h: number): [number, number][] {
  const margin = 0.1;
  const x0 = w * (margin + Math.random() * (1 - 2 * margin));
  const y0 = h * (margin + Math.random() * (1 - 2 * margin));
  const x3 = w * (margin + Math.random() * (1 - 2 * margin));
  const y3 = h * (margin + Math.random() * (1 - 2 * margin));
  const x1 = x0 + (Math.random() - 0.5) * w * 0.5;
  const y1 = y0 + (Math.random() - 0.5) * h * 0.5;
  const x2 = x3 + (Math.random() - 0.5) * w * 0.5;
  const y2 = y3 + (Math.random() - 0.5) * h * 0.5;

  const pts: [number, number][] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    const u = 1 - t;
    pts.push([
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
    ]);
  }
  return pts;
}
