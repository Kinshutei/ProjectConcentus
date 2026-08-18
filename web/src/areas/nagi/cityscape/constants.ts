/** 地面線の Y 座標（viewBox 座標系）。主層の基準 */
export const GROUND_Y = 190

/** viewBox の高さ */
export const VIEW_H = 214

/** ストリップの最小幅 */
export const MIN_STRIP_WIDTH = 1800

/**
 * コンテナ幅に対して確保するストリップ幅の倍率。
 * 複製4枚に対し、等速ループで W、スクロール連動で最大 1.11W ずれるので
 * 必要量は 2.11W + ビューポート幅。W = ビューポート幅 とすれば 3.11W で、
 * 総幅 4W に対して 0.89W の余裕が残る。
 */
export const STRIP_WIDTH_FACTOR = 1.0

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
 * ストリップの複製枚数。
 * 3枚だと近景層（連動量1.11W）の余裕が 0.126W しかなく、スクロール末端で
 * 右側が尽きて街が途中で切れる。4枚にしたうえでストリップ幅を縮め、
 * 総ノード数はむしろ減らす。
 */
export const STRIP_COPIES = 4

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

/** 手前から奥へ描くと近景が遠景を隠すので、この順で重ねる */
export const LAYER_ORDER: LayerKey[] = ['far', 'main', 'near']

