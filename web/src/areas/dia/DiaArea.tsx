import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, watchUrl } from '../../data'
import { Link } from '../../router'
import TerminalMessage from './TerminalMessage'
import './dia.css'

const asset = (name: string) => `${import.meta.env.BASE_URL}dia/${name}`

const VIDEOS = [
  { src: asset('dia_moviecard_01.mp4'), grayscale: false, rate: 0.6 },
  { src: asset('dia_moviecard_02.mp4'), grayscale: true, rate: 1.0 },
  { src: asset('dia_moviecard_03.mp4'), grayscale: true, rate: 1.0 },
  { src: asset('dia_moviecard_04.mp4'), grayscale: true, rate: 0.6 },
]

type Tab = 'streams' | 'songs' | 'about' | 'changelog'

const NAV_ITEMS: { tab: Tab; label: string }[] = [
  { tab: 'streams', label: 'LiveStreaming INFO' },
  { tab: 'songs', label: 'Sung Repertoire' },
  { tab: 'about', label: 'About' },
  { tab: 'changelog', label: '更新履歴' },
]

const FADE_BEFORE = 1.5
const FADE_MS = 1500

type Row = { no: number; song: Song | undefined; perf: Performance; isFirst: boolean }

export default function DiaArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  const [tab, setTab] = useState<Tab | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [terminalKey, setTerminalKey] = useState(0)
  const [videoIndex, setVideoIndex] = useState(0)

  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const activeRef = useRef<'a' | 'b'>('a')
  const movingRef = useRef(false)
  const indexRef = useRef(0)
  const grainRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)
  const barRef = useRef<HTMLDivElement>(null)

  /* 背景動画のクロスフェード */
  useEffect(() => {
    const a = videoARef.current
    const b = videoBRef.current
    if (!a || !b) return
    a.style.filter = 'none'
    a.playbackRate = VIDEOS[0].rate
    a.style.opacity = '1'
    b.style.opacity = '0'

    const onTime = (e: Event) => {
      if (movingRef.current) return
      const isA = e.target === a
      if ((activeRef.current === 'a') !== isA) return
      const cur = isA ? a : b
      const next = isA ? b : a
      if (!cur.duration || isNaN(cur.duration)) return
      if (cur.duration - cur.currentTime > FADE_BEFORE) return

      movingRef.current = true
      const nextIndex = (indexRef.current + 1) % VIDEOS.length
      const cfg = VIDEOS[nextIndex]
      next.src = cfg.src
      next.style.filter = cfg.grayscale ? 'grayscale(1)' : 'none'
      next.load()
      next.currentTime = 0
      next.playbackRate = cfg.rate
      next.play().catch(() => {})
      cur.style.opacity = '0'
      next.style.opacity = '1'
      setTimeout(() => {
        cur.pause()
        cur.currentTime = 0
        indexRef.current = nextIndex
        setVideoIndex(nextIndex)
        activeRef.current = isA ? 'b' : 'a'
        movingRef.current = false
      }, FADE_MS)
    }

    a.addEventListener('timeupdate', onTime)
    b.addEventListener('timeupdate', onTime)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      b.removeEventListener('timeupdate', onTime)
    }
  }, [])

  /* グレインノイズとプログレスバー */
  useEffect(() => {
    const canvas = grainRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const SCALE = 2
    let image: ImageData | null = null
    let data: Uint8ClampedArray | null = null

    const resize = () => {
      canvas.width = Math.ceil(canvas.offsetWidth / SCALE)
      canvas.height = Math.ceil(canvas.offsetHeight / SCALE)
      image = ctx.createImageData(canvas.width, canvas.height)
      data = image.data
    }
    resize()
    window.addEventListener('resize', resize)

    let frame = 0
    const loop = () => {
      frame++
      const bar = barRef.current
      const a = videoARef.current
      const b = videoBRef.current
      if (bar && a && b) {
        const active = activeRef.current === 'a' ? a : b
        bar.style.width = `${(active.duration ? active.currentTime / active.duration : 0) * 100}%`
      }
      if (frame % 4 === 0 && image && data) {
        data.fill(0)
        for (let i = 0; i < data.length; i += 4) {
          if (Math.random() > 0.22) continue
          const v = Math.floor(Math.random() * 40)
          data[i] = v
          data[i + 1] = v
          data[i + 2] = v
          data[i + 3] = Math.floor(Math.random() * 80 + 20)
        }
        ctx.putImageData(image, 0, 0)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const skipTo = useCallback((index: number) => {
    if (movingRef.current || indexRef.current === index) return
    const a = videoARef.current
    const b = videoBRef.current
    if (!a || !b) return
    movingRef.current = true
    const cur = activeRef.current === 'a' ? a : b
    const next = activeRef.current === 'a' ? b : a
    const cfg = VIDEOS[index]
    next.src = cfg.src
    next.style.filter = cfg.grayscale ? 'grayscale(1)' : 'none'
    next.load()
    next.currentTime = 0
    next.playbackRate = cfg.rate
    next.play().catch(() => {})
    cur.style.opacity = '0'
    next.style.opacity = '1'
    setTimeout(() => {
      cur.pause()
      cur.currentTime = 0
      indexRef.current = index
      setVideoIndex(index)
      activeRef.current = activeRef.current === 'a' ? 'b' : 'a'
      movingRef.current = false
    }, FADE_MS)
  }, [])

  const rowsByFrame = useRows(db, frames, perfs)

  const toHome = () => {
    setTab(null)
    setTerminalKey((k) => k + 1)
    setSidebarOpen(false)
  }

  return (
    <div className="dia-root">
      <div className="layout">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
          <div className="sidebar-top" onClick={toHome}>
            <span className="sidebar-tagline">
              Resounding---
              <br />
              with the truth of this world.
            </span>
            <span className="sidebar-title">狭間の場所</span>
          </div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ tab: key, label }) => (
              <button
                key={key}
                className={`sidebar-nav-item${tab === key ? ' active' : ''}`}
                onClick={() => {
                  setTab(key)
                  setSidebarOpen(false)
                }}
              >
                {label}
              </button>
            ))}
            <Link to="/" className="sidebar-nav-item">
              HOME
            </Link>
          </nav>
        </aside>

        <div className="main-area">
          <button
            className={`hamburger${sidebarOpen ? ' hamburger--open' : ''}`}
            onClick={() => setSidebarOpen((s) => !s)}
            aria-label="メニュー"
          >
            <span />
            <span />
            <span />
          </button>

          {(tab === null || tab === 'about' || tab === 'streams') && (
            <section className="hero-section">
              <video ref={videoARef} className="hero-video" src={VIDEOS[0].src} autoPlay muted playsInline />
              <video ref={videoBRef} className="hero-video" muted playsInline />
              <canvas ref={grainRef} className="hero-grain" />
              <div className="hero-overlay" />
              <div className="hero-video-indicators">
                {VIDEOS.map((_, i) => (
                  <div
                    key={i}
                    className={`hero-video-indicator${videoIndex === i ? ' active' : ''}`}
                    onClick={() => skipTo(i)}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div className="hero-progress-track">
                <div ref={barRef} className="hero-progress-bar" />
              </div>
              <div className="hero-terminal">
                <TerminalMessage key={terminalKey} />
              </div>

              {tab === 'about' && (
                <div className="hero-about">
                  <button className="hero-about-close" onClick={toHome}>
                    × CLOSE
                  </button>
                  <div className="hero-about-body">
                    <About />
                  </div>
                </div>
              )}

              {tab === 'streams' && (
                <div className="hero-streams">
                  <button className="hero-about-close" onClick={toHome}>
                    × CLOSE
                  </button>
                  <div className="hero-streams-body">
                    <Streams db={db} frames={frames} rowsByFrame={rowsByFrame} />
                  </div>
                </div>
              )}
            </section>
          )}

          {(tab === 'songs' || tab === 'changelog') && (
            <main className="content-area">
              <button className="back-btn" onClick={toHome}>
                ← BACK TO HOME
              </button>
              {tab === 'songs' && <Songs db={db} perfs={perfs} />}
              {tab === 'changelog' && <Changelog />}
            </main>
          )}
        </div>
      </div>
    </div>
  )
}

/* 初披露つきの行を枠ごとに組み立てる */
function useRows(db: Db, frames: Frame[], perfs: Performance[]) {
  return useMemo(() => {
    const at = new Map(frames.map((f) => [f.frame_id, f.started_at]))
    const first = new Map<string, string>()
    for (const p of [...perfs].sort(
      (a, b) =>
        (at.get(a.frame_id) ?? '').localeCompare(at.get(b.frame_id) ?? '') || a.start_sec - b.start_sec,
    )) {
      if (p.song_id && !first.has(p.song_id)) first.set(p.song_id, `${p.frame_id}|${p.start_sec}`)
    }
    const map = new Map<string, Row[]>()
    for (const f of frames) {
      map.set(
        f.frame_id,
        perfs
          .filter((p) => p.frame_id === f.frame_id)
          .sort((a, b) => a.start_sec - b.start_sec)
          .map((p, i) => ({
            no: i + 1,
            song: db.songById.get(p.song_id),
            perf: p,
            isFirst: first.get(p.song_id) === `${p.frame_id}|${p.start_sec}`,
          })),
      )
    }
    return map
  }, [db, frames, perfs])
}

function Streams({
  db,
  frames,
  rowsByFrame,
}: {
  db: Db
  frames: Frame[]
  rowsByFrame: Map<string, Row[]>
}) {
  const [open, setOpen] = useState<string | null>(frames[0]?.frame_id ?? null)

  return (
    <div className="stream-list">
      {frames.map((f) => {
        const rows = rowsByFrame.get(f.frame_id) ?? []
        const isOpen = open === f.frame_id
        return (
          <div key={f.frame_id} className={`stream-item${isOpen ? ' open' : ''}`}>
            <button className="stream-head" onClick={() => setOpen(isOpen ? null : f.frame_id)}>
              <span className="stream-date">{jstDate(f.started_at)}</span>
              <span className="stream-title">{f.title}</span>
              <span className="stream-count">{rows.length}</span>
            </button>
            {isOpen && (
              <div className="stream-body">
                <a
                  className="stream-link"
                  href={watchUrl(f.video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ▶ YouTubeで開く
                </a>
                <table className="setlist-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>曲名</th>
                      <th>アーティスト</th>
                      <th>タグ</th>
                      <th>再生</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.perf.start_sec}>
                        <td>{r.no}</td>
                        <td>
                          {r.isFirst && <span className="first-badge">初</span>}
                          {r.song?.title ?? ''}
                        </td>
                        <td>{r.song?.artist ?? ''}</td>
                        <td>
                          {r.perf.tags.map((id) => (
                            <span key={id} className="tag-chip">
                              {db.tagById.get(id)?.label ?? id}
                            </span>
                          ))}
                        </td>
                        <td>
                          <a
                            href={watchUrl(f.video_id, r.perf.start_sec)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {hms(r.perf.start_sec)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

type SortKey = 'title' | 'artist' | 'released' | 'count'

function Songs({ db, perfs }: { db: Db; perfs: Performance[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [desc, setDesc] = useState(true)

  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of perfs) counts.set(p.song_id, (counts.get(p.song_id) ?? 0) + 1)
    const list: { song: Song; count: number }[] = []
    for (const [id, count] of counts) {
      const song = db.songById.get(id)
      if (song) list.push({ song, count })
    }
    const dir = desc ? -1 : 1
    return list.sort((a, b) =>
      sortKey === 'count'
        ? (a.count - b.count) * dir
        : String(a.song[sortKey] ?? '').localeCompare(String(b.song[sortKey] ?? ''), 'ja') * dir,
    )
  }, [perfs, db, sortKey, desc])

  const th = (key: SortKey, label: string) => (
    <th
      onClick={() => {
        if (sortKey === key) setDesc((d) => !d)
        else {
          setSortKey(key)
          setDesc(key === 'count')
        }
      }}
      style={{ cursor: 'pointer' }}
    >
      {label} {sortKey === key ? (desc ? '▼' : '▲') : '⇅'}
    </th>
  )

  return (
    <div className="songs-wrap">
      <h2 className="section-title">Sung Repertoire — {stats.length}</h2>
      <table className="songs-table">
        <thead>
          <tr>
            {th('title', '曲名')}
            {th('artist', 'アーティスト')}
            {th('released', 'リリース')}
            {th('count', '歌唱回数')}
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => (
            <tr key={s.song.song_id}>
              <td>{s.song.title}</td>
              <td>{s.song.artist}</td>
              <td>{s.song.released}</td>
              <td>{s.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function About() {
  return (
    <div className="about-body">
      <h2 className="section-title">About</h2>
      <p>
        VSinger Diαさんの歌枠のセットリストを記録した、非公式のファンメイドデータベースです。
        公式のものではなく、DiαさんおよびRK Musicとは関係ありません。
      </p>
      <p>データは uta-waku archive の統合データベースから読み込んでいます。</p>
    </div>
  )
}

function Changelog() {
  return (
    <div className="about-body">
      <h2 className="section-title">更新履歴</h2>
      <p>統合データベース uta-waku archive へ移行しました。</p>
    </div>
  )
}
