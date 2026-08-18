/** 地面線の Y 座標（viewBox 座標系）。主層の基準 */
export const GROUND_Y = 190

/** viewBox の高さ */
export const VIEW_H = 214

/** ストリップの最小幅 */
export const MIN_STRIP_WIDTH = 1800

/** コンテナ幅に対して確保するストリップ幅の倍率 */
export const STRIP_WIDTH_FACTOR = 1.5

/** 輪郭パスの線幅（主層） */
export const STROKE_OUTLINE = 1.6

/** ディテールの既定線幅 */
export const STROKE_DETAIL = 1.3

/** 既定のスクロール速度（px/秒） */
export const DEFAULT_SPEED = 10

/** 既定のシード */
export const DEFAULT_SEED = 20260819

/** 階高と屋上パラペットの高さ。階数で高さを量子化するのに使う */
export const FLOOR_H = 9
export const PARAPET_H = 6

export type LayerKey = 'far' | 'main' | 'near'

export interface LayerSpec {
  /** 地面Yのずれ。負で奥（画面上方）へ */
  groundOffset: number
  /** 建物高さの倍率 */
  heightScale: number
  /** スクロール速度の倍率 */
  speedFactor: number
  /** 線の濃さ */
  opacity: number
  /** 輪郭の線幅 */
  stroke: number
  /** 0 のときディテールを描かない */
  detailLevel: 0 | 1
  /** 地区の長さ倍率への追加倍率 */
  districtScale: number
  /** ランドマークを置く層か */
  landmarks: boolean
  /** 線色に使う CSS 変数 */
  lineToken: string
}

/**
 * 3層構成。遠景ほど遅く淡く、小さく描いて奥行きを出す。
 * 遠景の地面Yは GROUND_Y - 16 = 174。最も高い landmarkSpine で 170 まで
 * 伸びるので、viewBox 上端に 4px 残る。
 */
export const LAYERS: Record<LayerKey, LayerSpec> = {
  far: {
    groundOffset: -16,
    heightScale: 0.74,
    speedFactor: 0.35,
    opacity: 0.42,
    stroke: 1.1,
    detailLevel: 0,
    districtScale: 1.7,
    landmarks: true,
    lineToken: 'var(--cty-line-far, var(--cty-line))',
  },
  main: {
    groundOffset: 0,
    heightScale: 1,
    speedFactor: 1,
    opacity: 1,
    stroke: STROKE_OUTLINE,
    detailLevel: 1,
    districtScale: 1,
    landmarks: false,
    lineToken: 'var(--cty-line)',
  },
  near: {
    groundOffset: 12,
    heightScale: 0.5,
    speedFactor: 1.75,
    opacity: 0.95,
    stroke: 1.9,
    detailLevel: 0,
    districtScale: 0.7,
    landmarks: false,
    lineToken: 'var(--cty-line)',
  },
}

/** 手前から奥へ描くと近景が遠景を隠すので、この順で重ねる */
export const LAYER_ORDER: LayerKey[] = ['far', 'main', 'near']
