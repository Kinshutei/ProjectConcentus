export type Rng = () => number

/** [モジュール原点からのX, 地面からの高さ] */
export type Point = [number, number]

export type Detail =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number; accent?: boolean; sw?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; accent?: boolean; sw?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; accent?: boolean; sw?: number }

/**
 * 輪郭点列の読み方。
 * top : 上辺のみを持つ。地面からの立ち上がりと降りは生成器が補う
 * full: 地面から地面までの全輪郭を持つ。生成器は補わない
 */
export type ProfileMode = 'top' | 'full'

export interface ModuleShape {
  /** モジュールの占有幅 */
  width: number
  /** 輪郭点列。空配列は輪郭を持たないモジュール */
  profile: Point[]
  /** 内部ディテール。Y は viewBox 絶対座標、X はモジュール原点からの相対 */
  details: Detail[]
  /** 既定は top */
  profileMode?: ProfileMode
  /** 真のとき高さ包絡線と層の高さ倍率を受けない */
  absoluteHeight?: boolean
  /** 偽のとき1階の表情を重ねない（添景・鉄塔・ランドマーク） */
  groundFloor?: boolean
  /** 電柱のとき、柱の高さを持つ。生成器が電線を張るのに使う */
  pole?: { top: number }
}

export type ModuleFn = (r: Rng, hMul: number) => ModuleShape

export type Weighted<T> = readonly [T, number]

export type DistrictId =
  | 'cbd' | 'office' | 'shopping' | 'residential' | 'park' | 'industrial'

/** 1階の表情 */
export type GroundFloor = 'glass' | 'entrance' | 'shutter' | 'none'

export interface DistrictConfig {
  label: string
  /** 高層テーブルを引く確率 0..1 */
  urbanRatio: number
  /** 建物間隔の基準値（px） */
  gap: number
  /** 添景（樹木・街灯・信号）の出現率 0..1 */
  fixtureRate: number
  /** 地区の幅レンジ */
  widthRange: readonly [number, number]
  /** 高さ包絡線への加算バイアス */
  heightBias: number
  /** 1階の表情 */
  groundFloor: GroundFloor
  /** 庇の出現率（商店街のみ使う） */
  awningRate?: number
  /** 袖看板の出現率（商店街のみ使う） */
  signRate?: number
  low: readonly Weighted<ModuleFn>[]
  high: readonly Weighted<ModuleFn>[]
  fixtures: readonly Weighted<ModuleFn>[]
}

export interface PlacedItem {
  x: number
  details: Detail[]
}

/** 生成された区画ひとつぶん。座標は区画内の相対値 */
export interface CityChunk {
  width: number
  /** 街の輪郭。単一パス */
  path: string
  /** 電線。空文字なら描画しない */
  wires: string
  items: PlacedItem[]
  buildingCount: number
}
