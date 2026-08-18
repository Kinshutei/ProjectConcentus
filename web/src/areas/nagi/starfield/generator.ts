import { createRng } from '../cityscape/rng'
import { CONSTELLATIONS } from './constellations'
import {
  CONSTELLATION_GAP, CONSTELLATION_SIZE, MILKY_WAY,
  STAR_AREA_PER_STAR, TWINKLE_MAG, TWINKLE_MAX,
} from './constants'
import type { PlacedConstellation, PlacedStar, SkyStrip, StarDust } from './types'

/** 等級から半径を求める */
function magRadius(mag: number): number {
  return Math.max(0.4, Math.min(2.0, 1.95 - mag * 0.3))
}

/** 等級から不透明度を求める */
function magOpacity(mag: number): number {
  return Math.max(0.3, Math.min(1, 1.05 - mag * 0.12))
}

/** 天の川の帯の中心線（低周波の正弦波2本の重ね合わせ） */
function milkyWayY(x: number, w: number, h: number): number {
  const a = Math.sin((x / w) * Math.PI * 2) * h * 0.16
  const b = Math.sin((x / w) * Math.PI * 6 + 1.1) * h * 0.06
  return h * 0.5 + a + b
}

export interface GenerateSkyOptions {
  seed: number
  width: number
  height: number
}

export function generateSky({ seed, width, height }: GenerateSkyOptions): SkyStrip {
  const rng = createRng(seed)
  const stars: PlacedStar[] = []
  const buckets = new Map<string, StarDust>()

  // ── 背景星 ──
  const count = Math.round((width * height) / STAR_AREA_PER_STAR)
  let twinkled = 0

  for (let i = 0; i < count; i++) {
    const x = rng() * width
    const y = rng() * height

    // 等級は指数分布。暗い星ほど多い
    let mag = 1.2 + -Math.log(1 - rng() * 0.98) * 1.6

    if (MILKY_WAY) {
      // 帯に近いほど明るい側へ補正し、そこに微光星が増える
      const d = Math.abs(y - milkyWayY(x, width, height)) / (height * 0.22)
      if (d < 1) mag -= (1 - d) * 1.1
    }
    mag = Math.min(6.2, Math.max(0, mag))

    const star: PlacedStar = { x, y, r: magRadius(mag), o: magOpacity(mag) }
    if (mag < TWINKLE_MAG && twinkled < TWINKLE_MAX && rng() < 0.55) {
      star.tw = { dur: 2.4 + rng() * 3.2, delay: -rng() * 6 }
      twinkled++
      stars.push(star)
    } else {
      // またたかない星は半径と不透明度で束ね、1本のパスにまとめる。
      // ウルトラワイドでは背景星が900個を超えるため、節点数をここで抑える
      const rq = Math.round(star.r / 0.25) * 0.25
      const oq = Math.round(star.o / 0.2) * 0.2
      const key = `${rq}_${oq}`
      let b = buckets.get(key)
      if (!b) {
        b = { r: rq, o: oq, d: '' }
        buckets.set(key, b)
      }
      const rr = rq.toFixed(2)
      b.d += `M${x.toFixed(1)} ${y.toFixed(1)}m-${rr} 0a${rr} ${rr} 0 1 0 ${(rq * 2).toFixed(2)} 0` +
        `a${rr} ${rr} 0 1 0 -${(rq * 2).toFixed(2)} 0`
    }
  }

  // ── 星座 ──
  const constellations: PlacedConstellation[] = []
  const pool = [...CONSTELLATIONS]
  let cx = CONSTELLATION_GAP * 0.5

  while (cx < width - CONSTELLATION_GAP * 0.8 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length)
    const c = pool.splice(idx, 1)[0]

    const [minS, maxS] = CONSTELLATION_SIZE
    const size = (minS + rng() * (maxS - minS)) * c.scale
    const x = cx + rng() * CONSTELLATION_GAP * 0.3
    const y = height * 0.12 + rng() * height * 0.58

    const pts = c.stars.map((s) => ({
      px: x + s.x * size,
      py: y + s.y * size,
      mag: s.mag,
    }))

    constellations.push({
      id: c.id,
      name: c.name,
      x, y, w: size, h: size,
      stars: pts.map((p) => ({ x: p.px, y: p.py, r: magRadius(p.mag) * 1.25, o: 1 })),
      path: c.lines
        .map(([a, b]) =>
          `M${pts[a].px.toFixed(1)} ${pts[a].py.toFixed(1)} L${pts[b].px.toFixed(1)} ${pts[b].py.toFixed(1)}`,
        )
        .join(' '),
    })

    cx += CONSTELLATION_GAP + rng() * CONSTELLATION_GAP * 0.4
  }

  return { width, height, stars, dust: [...buckets.values()], constellations }
}
