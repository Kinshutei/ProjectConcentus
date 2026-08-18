/** 地面線の Y 座標（viewBox 座標系）。主層の基準 */
export const GROUND_Y = 190

/** viewBox の高さ */
export const VIEW_H = 214

/** ディテールの既定線幅 */
export const STROKE_DETAIL = 1.3

/** 既定のスクロール速度（px/秒） */
export const DEFAULT_SPEED = 10

/** 既定のシード */
export const DEFAULT_SEED = 20260819

/** 階高（建物高さをこの倍数に量子化する） */
export const FLOOR_H = 11

/** パラペット（陸屋根の立ち上がり）の高さ */
export const PARAPET_H = 3

/**
 * 区画ひとつの幅は「画面幅＋この余白」（描画単位）。
 * 画面の右外に必ず次の区画があり、区画が画面の左外へ出てから捨てるので、
 * 生成も破棄も視界に入らない。
 */
export const CHUNK_MARGIN = 600

/** ラインドローイングの尺（秒） */
export const DRAW_DURATION = 2.4


export type LayerKey = 'far' | 'main' | 'near'

export interface LayerSpec {
  speedFactor: number
  /** 地面Yのずれ。負で奥（画面上方） */
  groundOffset: number
  heightScale: number
  strokeWidth: number
  opacity: number
  seedOffset: number
  /** 0=輪郭のみ / 1=街路設備のみ / 2=全ディテール */
  detailLevel: 0 | 1 | 2
  /** 建物を置くか。false なら街路設備のみ */
  buildings: boolean
  /** 地区の長さ倍率への追加倍率 */
  districtScale: number
  /** 建物・添景の間隔倍率。大きいほど疎になる */
  spacing: number
  /** ランドマークを置く層か */
  landmarks: boolean
}

/**
 * 3層構成。遠景の地面Yは GROUND_Y - 16 = 174。
 * 遠景層は不透明度 0.42 で減衰させる（専用の線色トークンは取らない）。
 * 近景層は建物を置かない。画面下端で切れる建物は不自然になるため。
 */
export const LAYERS: Record<LayerKey, LayerSpec> = {
  far: {
    speedFactor: 0.35, groundOffset: -16, heightScale: 0.62, strokeWidth: 1.0,
    opacity: 0.42, seedOffset: 1013, detailLevel: 0, buildings: true,
    districtScale: 1.7, spacing: 1, landmarks: true,
  },
  main: {
    speedFactor: 1.0, groundOffset: 0, heightScale: 1.0, strokeWidth: 1.6,
    opacity: 1.0, seedOffset: 0, detailLevel: 2, buildings: true,
    districtScale: 1, spacing: 1, landmarks: false,
  },
  // 近景層は街路設備だけを疎に置く。等間隔に詰めると手前が騒がしくなる
  near: {
    speedFactor: 1.85, groundOffset: 12, heightScale: 0.42, strokeWidth: 1.9,
    opacity: 1.0, seedOffset: 7717, detailLevel: 1, buildings: false,
    districtScale: 0.7, spacing: 4, landmarks: false,
  },
}

/** ラインドローイングの層別遅延（秒）。奥から順に描かれる */
export const DRAW_DELAY: Record<LayerKey, number> = { far: 0, main: 0.25, near: 0.5 }

/** 手前から奥へ描くと近景が遠景を隠すので、この順で重ねる */
export const LAYER_ORDER: LayerKey[] = ['far', 'main', 'near']

