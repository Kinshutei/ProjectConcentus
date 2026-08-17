import { useEffect, useState } from 'react'
import type { Db, Performance, Talk } from '../types'
import { loadPerformances, loadTalks, jstDate } from '../data'
import { Link } from '../router'

/**
 * 各シンガーの領域。現行の個別サイトをここへ移す。
 * デザインは領域ごとに持つ方針なので、この土台の上に順次差し替えていく。
 */
export default function Area({ db, singerId }: { db: Db; singerId: string }) {
  const singer = db.singers.find((s) => s.singer_id === singerId)
  const [perfs, setPerfs] = useState<Performance[] | null>(null)
  const [talks, setTalks] = useState<Talk[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!singer) return
    let alive = true
    Promise.all([loadPerformances(singerId), loadTalks(singerId)])
      .then(([p, t]) => {
        if (!alive) return
        setPerfs(p)
        setTalks(t)
      })
      .catch((e: Error) => alive && setError(e.message))
    return () => {
      alive = false
    }
  }, [singerId, singer])

  if (!singer) {
    return (
      <div className="state">
        <p>その領域は見つかりませんでした。</p>
        <p>
          <Link to="/">TOPへ戻る</Link>
        </p>
      </div>
    )
  }
  if (error) return <div className="state">{error}</div>
  if (!perfs || !talks) return <div className="state">読み込み中…</div>

  const frames = db.frames
    .filter((f) => f.singer_id === singerId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
  const uniqueSongs = new Set(perfs.map((p) => p.song_id)).size

  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <p className="muted" style={{ fontSize: 12 }}>
        <Link to="/">uta-waku archive</Link> ／ {singer.name}
      </p>
      <h1 style={{ marginTop: 8 }}>{singer.name}</h1>
      <p className="muted">
        枠 {frames.length} ・ 歌唱 {perfs.length} ・ 楽曲 {uniqueSongs} ・ 雑談 {talks.length}
      </p>

      <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
        この領域のデザインはこれから作ります。現行サイトの構成をここへ移します。
      </p>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: 24 }}>
        {frames.slice(0, 20).map((f) => (
          <li key={f.frame_id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
            <span className="mono muted" style={{ fontSize: 12, marginRight: 10 }}>
              {jstDate(f.started_at)}
            </span>
            {f.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
