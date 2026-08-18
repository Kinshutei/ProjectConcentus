import { GROUND_Y, LAYERS, type LayerKey } from './constants'
import { DISTRICTS, START_DISTRICT, TRANSITIONS } from './districts'
import { landmarkSpine, landmarkTower, landmarkTwinTower } from './modules'
import { createRng, pickWeighted, randInt } from './rng'
import type {
  CityStrip, DistrictId, ModuleFn, ModuleShape, PlacedItem, Rng, ZoneSpan,
} from './types'

const GY = GROUND_Y
const TAU = Math.PI * 2
const round1 = (v: number) => Math.round(v * 10) / 10

/** 1ストリップに置くランドマークの本数 */
export const LANDMARK_COUNT = 2

const LANDMARK_POOL = [landmarkTower, landmarkSpine, landmarkTwinTower]

/** ランドマークを置ける地区。この地区に入るまで待つ */
const LANDMARK_DISTRICTS = new Set<DistrictId>(['cbd', 'office'])

interface LandmarkPlan {
  /** この x を越えたら配置を試みる */
  at: number
  /** この x を越えたら地区を問わず強制配置 */
  limit: number
  make: (r: Rng) => ModuleShape
}

/**
 * ランドマークの抽選は本体とは別の乱数列で行う。
 * 2パス生成の1パス目が終わるまで確定しない W に依存させると、
 * 両パスで並びがずれるため、両パスで同一の minWidth を基準にする。
 */
function planLandmarks(seed: number, minWidth: number, count: number): LandmarkPlan[] {
  const r = createRng(seed ^ 0x9e3779b9)
  const usable = minWidth * 0.72 // 10%〜82% の範囲に収める
  const slot = usable / count
  const pool = [...LANDMARK_POOL]
  const plans: LandmarkPlan[] = []

  for (let i = 0; i < count; i++) {
    const at = minWidth * 0.1 + slot * i + r() * slot * 0.45
    const idx = Math.floor(r() * pool.length)
    const make = pool.splice(idx, 1)[0] ?? LANDMARK_POOL[0]
    plans.push({ at, limit: at + slot * 0.5, make })
  }
  return plans
}

interface BuildOptions {
  seed: number
  minWidth: number
  districtScale: number
  layer: LayerKey
  /** 0 のとき包絡線を適用しない（1パス目） */
  envelopeWidth: number
  phase1: number
  phase2: number
}

function buildOnce(o: BuildOptions): CityStrip {
  const spec = LAYERS[o.layer]
  const r = createRng(o.seed)
  const items: PlacedItem[] = []
  const zones: ZoneSpan[] = []
  let x = 0
  let d = `M0 ${GY}`
  let buildingCount = 0
  let prev: ModuleFn | null = null
  let current: DistrictId = START_DISTRICT
  let remaining = 0

  const plans = planLandmarks(o.seed, o.minWidth, spec.landmarks ? LANDMARK_COUNT : 0)
  let planIdx = 0

  const gapOf = (g: number) => randInt(r, Math.max(2, g - 3), g + 5)

  const openZone = () => {
    const cfg = DISTRICTS[current]
    remaining = Math.round(randInt(r, cfg.widthRange[0], cfg.widthRange[1]) * o.districtScale)
    zones.push({ id: current, x, width: remaining })
    return cfg
  }

  /** 輪郭を書き出す。full は地面からの全周を持つので生成器は補わない */
  const emit = (m: ModuleShape, at: number) => {
    for (const [px, py] of m.profile) {
      d += `L${round1(at + px)} ${round1(GY - py)}`
    }
    if (m.profileMode !== 'full') d += `L${round1(at + m.width)} ${GY}`
    if (spec.detailLevel > 0 && m.details.length) items.push({ x: at, details: m.details })
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

    const startX = x

    // ランドマーク。高さ倍率を受けないので包絡線も層の縮小も掛けない
    const plan = plans[planIdx]
    if (plan && x >= plan.at && (LANDMARK_DISTRICTS.has(current) || x >= plan.limit)) {
      x += 8
      d += `L${round1(x)} ${GY}`
      const m = plan.make(r)
      emit(m, x)
      x += m.width + 10
      d += `L${round1(x)} ${GY}`
      planIdx++
      buildingCount++
      remaining -= x - startX
      continue
    }

    // 高さ包絡線。周期を W の整数分周にすることでループ端の位相が一致する
    const envelope = o.envelopeWidth
      ? Math.min(1.18, Math.max(0.80,
          1
          + 0.10 * Math.sin((TAU * 3 * x) / o.envelopeWidth + o.phase1)
          + 0.05 * Math.sin((TAU * 7 * x) / o.envelopeWidth + o.phase2)
          + cfg.heightBias))
      : 1
    const hMul = envelope * spec.heightScale

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
    emit(m, x)

    x += m.width + gapOf(cfg.gap)
    d += `L${round1(x)} ${GY}`
    remaining -= x - startX
  }

  return { width: Math.round(x), path: d, items, zones, buildingCount }
}

export interface GenerateOptions {
  seed: number
  minWidth: number
  districtScale?: number
  layer: LayerKey
}

/**
 * 2パス生成。
 * 1パス目で幅を確定し、2パス目で包絡線を適用する。
 * 包絡線の適用は乱数を消費しないため、両パスで建物の並びは一致する。
 */
export function generateCity(o: GenerateOptions): CityStrip {
  const districtScale = (o.districtScale ?? 1) * LAYERS[o.layer].districtScale
  const phase1 = ((o.seed % 997) / 997) * TAU
  const phase2 = ((o.seed % 613) / 613) * TAU

  const pass1 = buildOnce({
    seed: o.seed, minWidth: o.minWidth, districtScale, layer: o.layer,
    envelopeWidth: 0, phase1: 0, phase2: 0,
  })

  return buildOnce({
    seed: o.seed, minWidth: o.minWidth, districtScale, layer: o.layer,
    envelopeWidth: pass1.width, phase1, phase2,
  })
}
