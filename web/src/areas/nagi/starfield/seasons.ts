import { CONSTELLATIONS } from './constellations'
import type { Constellation, Season } from './types'

/** 月から季節を判定する。3〜5月＝春、6〜8月＝夏、9〜11月＝秋、12〜2月＝冬 */
export function currentSeason(d: Date = new Date()): Season {
  const m = d.getMonth() + 1
  if (m >= 3 && m <= 5) return 'spring'
  if (m >= 6 && m <= 8) return 'summer'
  if (m >= 9 && m <= 11) return 'autumn'
  return 'winter'
}

/** その季節に出せる星座を返す。周極星座と季節未指定のものは通年含める */
export function seasonPool(season: Season): Constellation[] {
  const pool = CONSTELLATIONS.filter(
    (c) => c.season === season || c.season === 'circumpolar' || c.season === undefined,
  )
  return pool.length > 0 ? pool : CONSTELLATIONS
}
