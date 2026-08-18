import { GROUND_Y, LAYERS, type LayerKey } from './constants'
import { DISTRICTS, POLE_DISTRICTS, START_DISTRICT, TRANSITIONS } from './districts'
import {
  buildWirePath, groundFloorDetails, landmarkSpine, landmarkTower,
  landmarkTwinTower, shopFixtures, type Pole,
} from './modules'
import { createRng, pickWeighted, randInt } from './rng'
import type {
  CityChunk, Detail, DistrictId, ModuleFn, ModuleShape, PlacedItem, Rng,
} from './types'

const GY = GROUND_Y
const TAU = Math.PI * 2
const round1 = (v: number) => Math.round(v * 10) / 10

/** 高さ包絡線の周期（描画単位）。ループしないので絶対座標の関数で足りる */
const ENVELOPE_PERIOD = 2600

/** ランドマークを置く間隔の目安（描画単位） */
const LANDMARK_INTERVAL = 2400

const LANDMARK_POOL = [landmarkTower, landmarkSpine, landmarkTwinTower]

/** ランドマークを置ける地区。この地区に入るまで待つ */
const LANDMARK_DISTRICTS = new Set<DistrictId>(['cbd', 'office'])

/**
 * 生成の途中状態。区画をまたいで引き継ぐ。
 * これを持ち回ることで、地区の遷移・電線・ランドマークの間隔が
 * 継ぎ目で途切れずにつながる。
 */
export interface CityState {
  rng: Rng
  layer: LayerKey
  districtScale: number
  phase1: number
  phase2: number
  /** 生成済みの総幅（描画単位）。包絡線の位相に使う */
  absX: number
  district: DistrictId
  /** 現在の地区の残り幅 */
  remaining: number
  prev: ModuleFn | null
  /** 直近のランドマークからの距離 */
  sinceLandmark: number
  /** 前の区画の最後の電柱。次の区画では負のxとして持ち込む */
  lastPole: Pole | null
  /** ランドマークの抽選プール。空になったら詰め直す */
  pool: ((r: Rng) => ModuleShape)[]
}

export function createCityState(
  seed: number, layer: LayerKey, districtScale = 1,
): CityState {
  const spec = LAYERS[layer]
  return {
    rng: createRng(seed + spec.seedOffset),
    layer,
    districtScale: districtScale * spec.districtScale,
    phase1: ((seed % 997) / 997) * TAU,
    phase2: ((seed % 613) / 613) * TAU,
    absX: 0,
    district: START_DISTRICT,
    remaining: 0,
    prev: null,
    sinceLandmark: LANDMARK_INTERVAL * 0.5,
    lastPole: null,
    pool: [...LANDMARK_POOL],
  }
}

/**
 * 区画をひとつ生成する。
 * 幅は minWidth を超えた最初の建物の切れ目までで、返り値の width が実寸。
 * 座標は区画内の相対値なので、数値が大きくならず、捨てるのも足すのも軽い。
 */
export function generateChunk(st: CityState, minWidth: number): CityChunk {
  const spec = LAYERS[st.layer]
  const r = st.rng
  const items: PlacedItem[] = []
  const poles: Pole[] = []
  let x = 0
  let d = `M0 ${GY}`
  let buildingCount = 0

  // 前の区画から電線を引き継ぐ。負のxに置いて張り渡す
  if (st.lastPole) poles.push(st.lastPole)

  const gapOf = (g: number) => randInt(r, Math.max(2, g - 3), g + 5) * spec.spacing

  const openZone = () => {
    const cfg = DISTRICTS[st.district]
    st.remaining = Math.round(
      randInt(r, cfg.widthRange[0], cfg.widthRange[1]) * st.districtScale,
    )
    return cfg
  }

  /** 輪郭を書き出す。full は地面からの全周を持つので生成器は補わない */
  const emit = (m: ModuleShape, at: number, extra: Detail[] = [], keepDetails = true) => {
    for (const [px, py] of m.profile) {
      d += `L${round1(at + px)} ${round1(GY - py)}`
    }
    if (m.profileMode !== 'full') d += `L${round1(at + m.width)} ${GY}`

    if (keepDetails) {
      const all = extra.length ? [...m.details, ...extra] : m.details
      if (all.length) items.push({ x: at, details: all })
    }
    if (m.pole && POLE_DISTRICTS.has(st.district)) {
      poles.push({ x: at + m.width / 2, top: m.pole.top })
    }
  }

  let cfg = st.remaining > 0 ? DISTRICTS[st.district] : openZone()

  while (x < minWidth) {
    if (st.remaining <= 0) {
      st.district = pickWeighted(r, TRANSITIONS[st.district])
      cfg = openZone()
      st.prev = null
    }

    const startX = x

    // ランドマーク。高さ倍率を受けないので包絡線も層の縮小も掛けない
    if (
      spec.landmarks &&
      st.sinceLandmark > LANDMARK_INTERVAL &&
      (LANDMARK_DISTRICTS.has(st.district) || st.sinceLandmark > LANDMARK_INTERVAL * 1.6)
    ) {
      if (st.pool.length === 0) st.pool = [...LANDMARK_POOL]
      const idx = Math.floor(r() * st.pool.length)
      const make = st.pool.splice(idx, 1)[0]
      x += 8
      d += `L${round1(x)} ${GY}`
      const m = make(r)
      emit(m, x, [], spec.detailLevel === 2)
      x += m.width + 10
      d += `L${round1(x)} ${GY}`
      st.sinceLandmark = 0
      buildingCount++
      st.remaining -= x - startX
      continue
    }

    // 高さ包絡線。ループしないので絶対座標をそのまま使う
    const ax = st.absX + x
    const envelope = Math.min(1.18, Math.max(0.80,
      1
      + 0.10 * Math.sin((TAU * ax) / ENVELOPE_PERIOD + st.phase1)
      + 0.05 * Math.sin((TAU * ax) / (ENVELOPE_PERIOD / 2.33) + st.phase2)
      + cfg.heightBias))
    const hMul = envelope * spec.heightScale

    // 近景層は建物を置かない。画面下端で切れる建物は不自然になるため
    const isFixture = !spec.buildings || r() < cfg.fixtureRate
    let fn: ModuleFn
    if (isFixture) {
      fn = pickWeighted(r, cfg.fixtures)
    } else {
      const table = r() < cfg.urbanRatio ? cfg.high : cfg.low
      fn = pickWeighted(r, table)
      // 同一モジュールの連続を70%の確率で引き直す
      if (fn === st.prev && r() < 0.7) fn = pickWeighted(r, table)
      st.prev = fn
      buildingCount++
    }

    const m = fn(r, hMul)

    // 1階の表情。建物にだけ重ねる
    const extra: Detail[] = []
    if (!isFixture && m.groundFloor !== false && cfg.groundFloor !== 'none') {
      extra.push(...groundFloorDetails(r, cfg.groundFloor, m.width))
      if (cfg.awningRate !== undefined) {
        extra.push(...shopFixtures(r, m.width, cfg.awningRate, cfg.signRate ?? 0))
      }
    }

    const keep = spec.detailLevel === 2 || (spec.detailLevel === 1 && isFixture)
    emit(m, x, extra, keep)

    x += m.width + gapOf(cfg.gap)
    d += `L${round1(x)} ${GY}`
    st.remaining -= x - startX
    st.sinceLandmark += x - startX
  }

  const width = Math.round(x)
  st.absX += width
  // 次の区画へ引き継ぐ電柱は、その区画から見て負のxになる
  const tail = poles.length ? poles[poles.length - 1] : null
  st.lastPole = tail && tail.x >= 0 ? { x: tail.x - width, top: tail.top } : null

  return {
    width,
    path: d,
    wires: spec.detailLevel === 0 ? '' : buildWirePath(poles),
    items,
    buildingCount,
  }
}
