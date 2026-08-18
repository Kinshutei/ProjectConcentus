export interface ConstellationStar {
  /** 星座の外接矩形内での正規化座標（0〜1、y は下向き） */
  x: number
  y: number
  /** 実視等級。半径の算出にのみ使う */
  mag: number
}

export interface Constellation {
  id: string
  /** 日本語名。表示するかは props で切り替える */
  name: string
  stars: ConstellationStar[]
  /** stars のインデックス対で表す星座線 */
  lines: [number, number][]
  /** 星座ごとの見かけの大きさ倍率 */
  scale: number
}

export interface PlacedStar {
  x: number
  y: number
  r: number
  o: number
  /** またたき。undefined なら静止 */
  tw?: { dur: number; delay: number }
}

export interface PlacedConstellation {
  id: string
  name: string
  /** ストリップ内での外接矩形 */
  x: number
  y: number
  w: number
  h: number
  stars: PlacedStar[]
  /** 星座線の d 属性（単一パス） */
  path: string
}

/** 半径と不透明度が同じ星をまとめた1本のパス */
export interface StarDust {
  r: number
  o: number
  d: string
}

export interface SkyStrip {
  width: number
  height: number
  /** またたく星だけを個別の circle として持つ */
  stars: PlacedStar[]
  /** それ以外の星。半径と不透明度で束ねてパス化する */
  dust: StarDust[]
  constellations: PlacedConstellation[]
}
