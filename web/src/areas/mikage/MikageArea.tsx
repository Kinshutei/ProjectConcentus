import { useMemo, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, thumbUrl, watchUrl } from '../../data'
import { Link } from '../../router'
import './mikage.css'

type Tab = 'streams' | 'songs' | 'about'

/** 枠1件ぶんの歌唱を、表示に必要な形へ組み立てたもの */
export type Row = {
  no: number
  song: Song | undefined
  perf: Performance
  isFirst: boolean
}

type Props = {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}

export default function MikageArea({ db, frames, perfs }: Props) {
  const [tab, setTab] = useState<Tab>('streams')

  // 初披露の判定。枠の開始時刻→枠内の秒 の順に並べ、song_id の初出を拾う
  const firstAppearance = useMemo(() => {
    const at = new Map(frames.map((f) => [f.frame_id, f.started_at]))
    const seen = new Map<string, string>()
    const ordered = [...perfs].sort(
      (a, b) =>
        (at.get(a.frame_id) ?? '').localeCompare(at.get(b.frame_id) ?? '') ||
        a.start_sec - b.start_sec,
    )
    for (const p of ordered) {
      if (p.song_id && !seen.has(p.song_id)) seen.set(p.song_id, `${p.frame_id}|${p.start_sec}`)
    }
    return seen
  }, [frames, perfs])

  const byFrame = useMemo(() => {
    const map = new Map<string, Row[]>()
    for (const f of frames) {
      const rows = perfs
        .filter((p) => p.frame_id === f.frame_id)
        .sort((a, b) => a.start_sec - b.start_sec)
        .map((p, i) => ({
          no: i + 1,
          song: db.songById.get(p.song_id),
          perf: p,
          isFirst: firstAppearance.get(p.song_id) === `${p.frame_id}|${p.start_sec}`,
        }))
      map.set(f.frame_id, rows)
    }
    return map
  }, [frames, perfs, db, firstAppearance])

  return (
    <div className="mikage">
      <header className="mk-head">
        <div className="mk-head-inner">
          <p className="mk-crumb">
            <Link to="/">uta-waku archive</Link>
          </p>
          <h1>深影の非公式歌枠DB</h1>
          <p className="mk-sub">
            枠 {frames.length} ・ 歌唱 {perfs.length} ・ 楽曲{' '}
            {new Set(perfs.map((p) => p.song_id)).size}
          </p>
        </div>
      </header>

      <nav className="mk-tabs">
        <div className="mk-tabs-inner">
          {(
            [
              ['streams', '歌枠'],
              ['songs', '楽曲'],
              ['about', 'このサイトについて'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? 'on' : ''}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mk-main">
        {tab === 'streams' && <Streams db={db} frames={frames} byFrame={byFrame} />}
        {tab === 'songs' && <Songs db={db} perfs={perfs} />}
        {tab === 'about' && <About />}
      </main>

      <footer className="mk-foot">
        <p>
          当サイトは非公式のファンメイドです。深影さんおよびRK Musicとは関係ありません。
        </p>
      </footer>
    </div>
  )
}

/* ─────────────────────────────── 歌枠タブ */

function Streams({
  db,
  frames,
  byFrame,
}: {
  db: Db
  frames: Frame[]
  byFrame: Map<string, Row[]>
}) {
  const [query, setQuery] = useState('')
  const [allOpen, setAllOpen] = useState<boolean | null>(null)
  const [mountKey, setMountKey] = useState(0)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const shown = searching
    ? frames.filter((f) =>
        (byFrame.get(f.frame_id) ?? []).some((r) => matches(r, q)),
      )
    : frames

  return (
    <div className="mk-streams">
      <div className="mk-toolbar">
        <div className="mk-search">
          <span aria-hidden>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名・アーティストで検索"
          />
          {searching && (
            <button className="mk-search-clear" onClick={() => setQuery('')} title="クリア">
              ✕
            </button>
          )}
        </div>
        {searching ? (
          <span className="mk-hits">{shown.length}件の枠がヒット</span>
        ) : (
          <>
            <button
              className="mk-btn"
              onClick={() => {
                setAllOpen(true)
                setMountKey((k) => k + 1)
              }}
            >
              すべて開く
            </button>
            <button
              className="mk-btn"
              onClick={() => {
                setAllOpen(false)
                setMountKey((k) => k + 1)
              }}
            >
              すべて閉じる
            </button>
          </>
        )}
      </div>

      {searching && shown.length === 0 && (
        <p className="mk-empty">「{query.trim()}」に一致する枠はありませんでした。</p>
      )}

      <div className="mk-expanders">
        {shown.map((f) => (
          <FrameExpander
            key={`${f.frame_id}_${mountKey}`}
            db={db}
            frame={f}
            rows={(byFrame.get(f.frame_id) ?? []).filter((r) => !searching || matches(r, q))}
            forceOpen={searching}
            defaultOpen={allOpen ?? false}
            query={q}
          />
        ))}
      </div>
    </div>
  )
}

function matches(r: Row, q: string) {
  if (!r.song) return false
  return (
    r.song.title.toLowerCase().includes(q) || r.song.artist.toLowerCase().includes(q)
  )
}

function FrameExpander({
  db,
  frame,
  rows,
  forceOpen,
  defaultOpen,
  query,
}: {
  db: Db
  frame: Frame
  rows: Row[]
  forceOpen: boolean
  defaultOpen: boolean
  query: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  const showCollab = rows.some((r) => r.perf.collab.length > 0)

  return (
    <div className="mk-exp">
      <button className="mk-exp-head" onClick={() => setOpen((v) => !v)} aria-expanded={isOpen}>
        <span className="mk-exp-mark">{isOpen ? '⚜' : '▶'}</span>
        <span className="mk-exp-date">{jstDate(frame.started_at)}</span>
        <span className="mk-exp-title">{frame.title}</span>
        {frame.tags.length > 0 && (
          <span className="mk-exp-tags">
            {frame.tags.map((id) => (
              <span key={id} className="mk-tag">
                {db.tagById.get(id)?.label ?? id}
              </span>
            ))}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="mk-exp-body">
          <div className="mk-exp-thumb">
            <a href={watchUrl(frame.video_id)} target="_blank" rel="noopener noreferrer">
              <img src={thumbUrl(frame.video_id)} alt="" loading="lazy" />
            </a>
            <a
              className="mk-exp-link"
              href={watchUrl(frame.video_id)}
              target="_blank"
              rel="noopener noreferrer"
            >
              YouTubeで開く
            </a>
          </div>

          <div className="mk-table-wrap">
            <table className="mk-setlist">
              <thead>
                <tr>
                  <th>#</th>
                  <th>曲名</th>
                  <th>タグ</th>
                  <th>補足</th>
                  <th>アーティスト</th>
                  {showCollab && <th>コラボ</th>}
                  <th>再生</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const hitTitle = !!query && !!r.song?.title.toLowerCase().includes(query)
                  const hitArtist = !!query && !!r.song?.artist.toLowerCase().includes(query)
                  return (
                    <tr key={`${r.perf.start_sec}`} className={hitTitle || hitArtist ? 'hit' : ''}>
                      <td className="mk-no">{r.no}</td>
                      <td className={hitTitle ? 'mk-hit-text' : ''}>
                        {r.isFirst && <span className="mk-first">初</span>}
                        {r.song?.title ?? '（未登録）'}
                      </td>
                      <td className="mk-cell-tags">
                        {r.perf.tags.map((id) => (
                          <span key={id} className="mk-tag">
                            {db.tagById.get(id)?.label ?? id}
                          </span>
                        ))}
                      </td>
                      <td className="mk-cell-note">{r.perf.note}</td>
                      <td className={hitArtist ? 'mk-hit-text' : 'mk-cell-artist'}>
                        {r.song?.artist ?? ''}
                      </td>
                      {showCollab && <td className="mk-cell-artist">{r.perf.collab.join(' / ')}</td>}
                      <td>
                        <a
                          href={watchUrl(frame.video_id, r.perf.start_sec)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {hms(r.perf.start_sec)}
                        </a>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────── 楽曲タブ */

type Stat = { song: Song; count: number }
type SortKey = 'title' | 'artist' | 'released' | 'count'

function Songs({ db, perfs }: { db: Db; perfs: Performance[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [desc, setDesc] = useState(true)
  const [query, setQuery] = useState('')

  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of perfs) counts.set(p.song_id, (counts.get(p.song_id) ?? 0) + 1)
    const list: Stat[] = []
    for (const [id, count] of counts) {
      const song = db.songById.get(id)
      if (song) list.push({ song, count })
    }
    return list
  }, [perfs, db])

  const q = query.trim().toLowerCase()
  const rows = useMemo(() => {
    const filtered = q
      ? stats.filter(
          (s) =>
            s.song.title.toLowerCase().includes(q) || s.song.artist.toLowerCase().includes(q),
        )
      : stats
    const dir = desc ? -1 : 1
    return [...filtered].sort((a, b) => {
      if (sortKey === 'count') return (a.count - b.count) * dir
      const av = String(a.song[sortKey] ?? '')
      const bv = String(b.song[sortKey] ?? '')
      return av.localeCompare(bv, 'ja') * dir
    })
  }, [stats, q, sortKey, desc])

  const top = [...stats].sort((a, b) => b.count - a.count).slice(0, 20)
  const max = top[0]?.count ?? 1

  const head = (key: SortKey, label: string) => (
    <th
      className="mk-sortable"
      onClick={() => {
        if (sortKey === key) setDesc((d) => !d)
        else {
          setSortKey(key)
          setDesc(key === 'count')
        }
      }}
    >
      {label}
      <span className="mk-sort-mark">{sortKey === key ? (desc ? '▼' : '▲') : '⇅'}</span>
    </th>
  )

  return (
    <div className="mk-songs">
      <h2 className="mk-h2">よく歌われている曲 上位20</h2>
      <ul className="mk-bars">
        {top.map((s) => (
          <li key={s.song.song_id}>
            <span className="mk-bar-label">{s.song.title}</span>
            <span className="mk-bar-track">
              <span className="mk-bar-fill" style={{ width: `${(s.count / max) * 100}%` }} />
            </span>
            <span className="mk-bar-count">{s.count}</span>
          </li>
        ))}
      </ul>

      <h2 className="mk-h2">全楽曲 {stats.length}曲</h2>
      <div className="mk-search mk-search--wide">
        <span aria-hidden>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="曲名・アーティストで絞り込み"
        />
      </div>

      <div className="mk-table-wrap">
        <table className="mk-songs-table">
          <thead>
            <tr>
              {head('title', '曲名')}
              {head('artist', '原曲アーティスト')}
              <th>作詞</th>
              <th>作曲</th>
              <th>編曲</th>
              {head('released', 'リリース')}
              {head('count', '歌唱回数')}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.song.song_id}>
                <td>{s.song.title}</td>
                <td className="mk-cell-artist">{s.song.artist}</td>
                <td className="mk-cell-note">{s.song.lyricists.join(' / ')}</td>
                <td className="mk-cell-note">{s.song.composers.join(' / ')}</td>
                <td className="mk-cell-note">{s.song.arrangers.join(' / ')}</td>
                <td className="mk-cell-note">{s.song.released}</td>
                <td className="mk-no">{s.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ─────────────────────────────── About */

function About() {
  return (
    <div className="mk-about">
      <h2 className="mk-h2">このサイトについて</h2>
      <p>
        VSinger 深影さんの歌枠のセットリストを記録した、非公式のファンメイドデータベースです。
        公式のものではなく、深影さんおよびRK Musicとは関係ありません。
      </p>
      <p>
        データは <code>uta-waku archive</code> の統合データベースから読み込んでいます。
        誤りを見つけた場合はご連絡ください。
      </p>
      <h2 className="mk-h2">リンク</h2>
      <ul className="mk-links">
        <li>
          <a
            href="https://www.youtube.com/channel/UC2daHxnuJJBM5NWci1RRkeA"
            target="_blank"
            rel="noopener noreferrer"
          >
            YouTube チャンネル
          </a>
        </li>
      </ul>
    </div>
  )
}
