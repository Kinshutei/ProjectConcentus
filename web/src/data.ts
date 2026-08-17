import type { Contents, Db, Frame, Performance, Singer, Song, Talk, Tag } from './types'

const BASE = `${import.meta.env.BASE_URL}data`

async function load<T>(path: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${path}`)
  if (!res.ok) throw new Error(`${path} の取得に失敗しました（HTTP ${res.status}）`)
  const json = await res.json()
  return Array.isArray(json) ? (json as T[]) : []
}

/** TOPと全領域で共有する土台。歌唱や雑談は領域を開いたときに個別で取る */
export async function loadDb(): Promise<Db> {
  const [singers, songs, frames, tags] = await Promise.all([
    load<Singer>('singers.json'),
    load<Song>('songs.json'),
    load<Frame>('frames.json'),
    load<Tag>('tags.json'),
  ])
  return {
    singers,
    songs,
    frames,
    tags,
    songById: new Map(songs.map((s) => [s.song_id, s])),
    tagById: new Map(tags.map((t) => [t.tag_id, t])),
  }
}

export const loadPerformances = (singerId: string) =>
  load<Performance>(`performances/${singerId}.json`)

export const loadTalks = (singerId: string) => load<Talk>(`talks/${singerId}.json`)

const EMPTY_CONTENTS: Contents = { pickup: [], original: [], short: [], livestreaming: [] }

/** コンテンツ欄。持っていないシンガーもあるので、取れなければ空で返す */
export async function loadContents(singerId: string): Promise<Contents> {
  try {
    const res = await fetch(`${BASE}/contents/${singerId}.json`)
    if (!res.ok) return EMPTY_CONTENTS
    return { ...EMPTY_CONTENTS, ...(await res.json()) }
  } catch {
    return EMPTY_CONTENTS
  }
}

/** started_at は UTC。JSTへ直してから日付・時刻を組み立てる */
function toJst(iso: string): Date | null {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return new Date(d.getTime() + 9 * 60 * 60 * 1000)
}

export function jstDate(iso: string): string {
  const d = toJst(iso)
  return d ? d.toISOString().slice(0, 10) : iso.slice(0, 10)
}

export function jstDateTime(iso: string): string {
  const d = toJst(iso)
  if (!d) return iso
  const s = d.toISOString()
  return `${s.slice(0, 10)} ${s.slice(11, 16)}`
}

export function hms(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`
}

export const watchUrl = (videoId: string, sec?: number) =>
  `https://www.youtube.com/watch?v=${videoId}${sec ? `&t=${sec}` : ''}`

export const thumbUrl = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
