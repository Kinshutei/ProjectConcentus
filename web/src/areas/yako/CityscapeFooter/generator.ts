import { GROUND_Y } from './constants'
import { DISTRICTS, START_DISTRICT, TRANSITIONS } from './districts'
import { createRng, pickWeighted, randInt } from './rng'
import type { CityStrip, DistrictId, ModuleFn, PlacedItem, ZoneSpan } from './types'

const GY = GROUND_Y
const TAU = Math.PI * 2

interface BuildOptions {
  seed: number
  minWidth: number
  districtScale: number
  /** 0 のとき包絡線を適用しない（1パス目） */
  envelopeWidth: number
  phase1: number
  phase2: number
}

function buildOnce(o: BuildOptions): CityStrip {
  const r = createRng(o.seed)
  const items: PlacedItem[] = []
  const zones: ZoneSpan[] = []
  let x = 0
  let d = `M0 ${GY}`
  let buildingCount = 0
  let prev: ModuleFn | null = null
  let current: DistrictId = START_DISTRICT
  let remaining = 0

  const gapOf = (g: number) => randInt(r, Math.max(2, g - 3), g + 5)

  const openZone = () => {
    const cfg = DISTRICTS[current]
    remaining = Math.round(randInt(r, cfg.widthRange[0], cfg.widthRange[1]) * o.districtScale)
    zones.push({ id: current, x, width: remaining })
    return cfg
  }

  let cfg = openZone()
  x += gapOf(cfg.gap)
  d += `L${x} ${GY}`

  while (x < o.minWidth) {
    if (remaining <= 0) {
      current = pickWeighted(r, TRANSITIONS[current])
      cfg = openZone()
      prev = null
    }

    // 高さ包絡線。周期を W の整数分周にすることでループ端の位相が一致する
    const hMul = o.envelopeWidth
      ? Math.min(1.18, Math.max(0.80,
          1
          + 0.10 * Math.sin((TAU * 3 * x) / o.envelopeWidth + o.phase1)
          + 0.05 * Math.sin((TAU * 7 * x) / o.envelopeWidth + o.phase2)
          + cfg.heightBias))
      : 1

    const startX = x
    let fn: ModuleFn

    if (r() < cfg.fixtureRate) {
      fn = pickWeighted(r, cfg.fixtures)
    } else {
      const table = r() < cfg.urbanRatio ? cfg.high : cfg.low
      fn = pickWeighted(r, table)
      // 同一モジュールの連続を70%の確率で引き直す
      if (fn === prev && r() < 0.7) fn = pickWeighted(r, table)
      prev = fn
      buildingCount++
    }

    const m = fn(r, hMul)

    for (const [px, py] of m.profile) {
      d += `L${round1(x + px)} ${round1(GY - py)}`
    }
    d += `L${x + m.width} ${GY}`

    if (m.details.length) items.push({ x, details: m.details })

    x += m.width + gapOf(cfg.gap)
    d += `L${x} ${GY}`
    remaining -= x - startX
  }

  return { width: Math.round(x), path: d, items, zones, buildingCount }
}

const round1 = (v: number) => Math.round(v * 10) / 10

export interface GenerateOptions {
  seed: number
  minWidth: number
  districtScale?: number
}

/**
 * 2パス生成。
 * 1パス目で幅を確定し、2パス目で包絡線を適用する。
 * 包絡線の適用は乱数を消費しないため、両パスで建物の並びは一致する。
 */
export function generateCity(o: GenerateOptions): CityStrip {
  const districtScale = o.districtScale ?? 1
  const phase1 = ((o.seed % 997) / 997) * TAU
  const phase2 = ((o.seed % 613) / 613) * TAU

  const pass1 = buildOnce({
    seed: o.seed, minWidth: o.minWidth, districtScale,
    envelopeWidth: 0, phase1: 0, phase2: 0,
  })

  return buildOnce({
    seed: o.seed, minWidth: o.minWidth, districtScale,
    envelopeWidth: pass1.width, phase1, phase2,
  })
}
