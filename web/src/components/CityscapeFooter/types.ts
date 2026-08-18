export type Rng = () => number

/** [モジュール原点からのX, 地面からの高さ] */
export type Point = [number, number]

export type Detail =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx?: number; accent?: boolean; sw?: number }
  | { kind: 'line'; x1: number; y1: number; x2: number; y2: number; accent?: boolean; sw?: number }
  | { kind: 'circle'; cx: number; cy: number; r: number; accent?: boolean; sw?: number }

export interface ModuleShape {
  /** モジュールの占有幅 */
  width: number
  /** 輪郭点列。空配列は輪郭を持たないモジュール */
  profile: Point[]
  /** 内部ディテール。Y は viewBox 絶対座標、X はモジュール原点からの相対 */
  details: Detail[]
}

export type ModuleFn = (r: Rng, hMul: number) => ModuleShape

export type Weighted<T> = readonly [T, number]

export type DistrictId =
  | 'cbd' | 'office' | 'shopping' | 'residential' | 'park' | 'industrial'

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
  low: readonly Weighted<ModuleFn>[]
  high: readonly Weighted<ModuleFn>[]
  fixtures: readonly Weighted<ModuleFn>[]
}

export interface PlacedItem {
  x: number
  details: Detail[]
}

export interface ZoneSpan {
  id: DistrictId
  x: number
  width: number
}

export interface CityStrip {
  width: number
  path: string
  items: PlacedItem[]
  zones: ZoneSpan[]
  buildingCount: number
}
