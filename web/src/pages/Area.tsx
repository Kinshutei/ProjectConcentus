import { useEffect, useState } from 'react'
import type { Db, Frame, Performance } from '../types'
import { loadPerformances, jstDate } from '../data'
import { Link } from '../router'
import MikageArea from '../areas/mikage/MikageArea'
import DiaArea from '../areas/dia/DiaArea'
import WoucaArea from '../areas/wouca/WoucaArea'
import YakoArea from '../areas/yako/YakoArea'

/**
 * 各シンガーの領域。デザインは領域ごとに持つ方針なので、
 * 実装済みのものは専用コンポーネントへ、未実装のものは暫定表示へ振り分ける。
 */
export default function Area({ db, path }: { db: Db; path: string }) {
  const singer = db.singers.find((s) => s.url_path === path)
  const singerId = singer?.singer_id ?? ''
  const [perfs, setPerfs] = useState<Performance[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!singer) return
    let alive = true
    setPerfs(null)
    loadPerformances(singerId)
      .then((p) => alive && setPerfs(p))
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
  if (!perfs) return <div className="state">読み込み中…</div>

  const frames = db.frames
    .filter((f) => f.singer_id === singerId)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))

  if (singerId === 'mikage') {
    return <MikageArea db={db} frames={frames} perfs={perfs} />
  }
  if (singerId === 'dia') {
    return <DiaArea db={db} frames={frames} perfs={perfs} />
  }
  if (singerId === 'wouca') {
    return <WoucaArea db={db} frames={frames} perfs={perfs} />
  }
  if (singerId === 'yako') {
    return <YakoArea db={db} frames={frames} perfs={perfs} />
  }
  return <Placeholder name={singer.name} frames={frames} perfs={perfs} />
}

function Placeholder({
  name,
  frames,
  perfs,
}: {
  name: string
  frames: Frame[]
  perfs: Performance[]
}) {
  return (
    <div className="wrap" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <p className="muted" style={{ fontSize: 12 }}>
        <Link to="/">uta-waku archive</Link> ／ {name}
      </p>
      <h1 style={{ marginTop: 8 }}>{name}</h1>
      <p className="muted">
        枠 {frames.length} ・ 歌唱 {perfs.length} ・ 楽曲{' '}
        {new Set(perfs.map((p) => p.song_id)).size}
      </p>
      <p className="muted" style={{ marginTop: 32, fontSize: 13 }}>
        この領域のデザインはこれから作ります。
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
