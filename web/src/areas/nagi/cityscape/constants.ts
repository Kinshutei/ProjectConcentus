/** 地面線の Y 座標（viewBox 座標系）。主層の基準 */
export const GROUND_Y = 190

/** viewBox の高さ */
export const VIEW_H = 214

/** ストリップの最小幅 */
export const MIN_STRIP_WIDTH = 1800

/**
 * コンテナ幅に対して確保するストリップ幅の倍率。
 * 複製3枚（総幅3W）に対し、等速ループで W、スクロール連動で最大 1.11W ずれる。
 * 3W ≥ 2.11W + ビューポート幅 を満たす下限が約 1.13 なので 1.25 を取る。
 */
export const STRIP_WIDTH_FACTOR = 1.25

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

/** ストリップの複製枚数。スクロール連動を使うので 3 */
export const STRIP_COPIES = 3

/** 初回描画アニメの尺（秒） */
export const DRAW_DURATION = 2.4

/** スクロール連動の強さ（ページ全体スクロールで W の何割ぶん流すか） */
export const SCROLL_GAIN = 0.6

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
    districtScale: 1.7, landmarks: true,
  },
  main: {
    speedFactor: 1.0, groundOffset: 0, heightScale: 1.0, strokeWidth: 1.6,
    opacity: 1.0, seedOffset: 0, detailLevel: 2, buildings: true,
    districtScale: 1, landmarks: false,
  },
  near: {
    speedFactor: 1.85, groundOffset: 12, heightScale: 0.42, strokeWidth: 1.9,
    opacity: 1.0, seedOffset: 7717, detailLevel: 1, buildings: false,
    districtScale: 0.7, landmarks: false,
  },
}

/** 手前から奥へ描くと近景が遠景を隠すので、この順で重ねる */
export const LAYER_ORDER: LayerKey[] = ['far', 'main', 'near']

/** 描画アニメの層別遅延（秒） */
export const DRAW_DELAY: Record<LayerKey, number> = { far: 0, main: 0.25, near: 0.5 }
