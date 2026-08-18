/** 星の流れる角度（度）。天文的正確さを取るなら 54.6 だが、絵柄として 34 を採る */
export const SKY_ANGLE = 34

/** ストリップ幅を回転フレーム幅の何倍取るか */
export const SKY_WIDTH_FACTOR = 1.6

/** ストリップの最小幅 */
export const SKY_MIN_WIDTH = 2400

/** 背景星の面密度（1星あたりの平方ピクセル） */
export const STAR_AREA_PER_STAR = 11000

/** またたきを付ける等級の上限（明るく見える星のみ） */
export const TWINKLE_MAG = 2.6

/** またたきを付ける星の最大数（負荷の上限） */
export const TWINKLE_MAX = 40

/** 星座の最小間隔（px） */
export const CONSTELLATION_GAP = 520

/** 星座の表示サイズ範囲（px） */
export const CONSTELLATION_SIZE: [number, number] = [130, 210]

/** 既定のスクロール速度（px/秒） */
export const SKY_SPEED = 6

/** 星座は正立を保つか */
export const UPRIGHT_CONSTELLATIONS = true

/** 天の川を描くか */
export const MILKY_WAY = true

export const SKY_SEED = 20260819
