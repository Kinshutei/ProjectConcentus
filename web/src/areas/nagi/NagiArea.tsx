import type { Db, Frame, Performance } from '../../types'
import YakoArea, { type AreaSite } from '../yako/YakoArea'

/**
 * 水凪音庫（水瀬凪）の領域。
 * 見た目と構成は夜紺火花と同じものを使い、固定情報だけ差し替える。
 */
const SITE: AreaSite = {
  nameParts: ['水瀬', '凪'],
  accentPart: 1,
  nameRomaji: 'MINASE NAGI',
  leadParts: ['ファンメイドの非公式データベース', '水瀬さんの歌枠のセトリ＆楽曲情報まとめ'],
  links: [
    { label: 'YouTube', url: 'https://www.youtube.com/channel/UCAplyWK80Y6_YTkb3CCDk1Q' },
  ],
  singerName: '水瀬凪',
  noteTitle: 'Unofficial - MINASE NAGI DB',
  // 街並みは夜紺と別のものが生成されるよう、シードだけ変える
  citySeed: 20260819,
}

export default function NagiArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  return <YakoArea db={db} frames={frames} perfs={perfs} site={SITE} />
}
