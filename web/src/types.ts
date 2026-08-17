export type Singer = {
  singer_id: string
  /** 公開URLのパス。旧DBのリポジトリ名を引き継ぐ */
  url_path: string
  name: string
  name_en: string
  channel_id: string
  affiliation: string | null
  color: string | null
  active: boolean
}

export type Song = {
  song_id: string
  title: string
  artist: string
  lyricists: string[]
  composers: string[]
  arrangers: string[]
  released: string
  song_tags: string[]
  norm_key: string
}

export type Frame = {
  frame_id: string
  singer_id: string
  video_id: string
  title: string
  /** UTC の ISO8601。表示は JST に直す */
  started_at: string
  day_order: number
  type: string | null
  duration_sec: number | null
  tags: string[]
}

export type Performance = {
  frame_id: string
  song_id: string
  /** 枠の先頭からの秒数。この昇順が歌唱順になる */
  start_sec: number
  tags: string[]
  collab: string[]
  note: string
}

export type Talk = {
  frame_id: string
  start_sec: number
  theme: string
}

export type ContentVideo = {
  video_id: string
  title: string
  /** 「NEW」などの短い添え字。無いこともある */
  note?: string
}

/** サイトの PICKUP / Original / Short / LiveStreaming に出す動画 */
export type Contents = {
  pickup: ContentVideo[]
  original: ContentVideo[]
  short: ContentVideo[]
  livestreaming: ContentVideo[]
}

export type Tag = {
  tag_id: string
  label: string
  scope: 'song' | 'frame' | 'performance'
  group: string
  exclusive: boolean
  order: number
  active: boolean
  note: string
}

/** TOPと各領域が共有する、読み込み済みのデータ一式 */
export type Db = {
  singers: Singer[]
  songs: Song[]
  frames: Frame[]
  tags: Tag[]
  songById: Map<string, Song>
  tagById: Map<string, Tag>
}
