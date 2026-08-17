import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, watchUrl } from '../../data'
import { Link } from '../../router'
import TerminalMessage from './TerminalMessage'
import Chart from '../../components/Chart'
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
  const [defaultOpen, setDefaultOpen] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [query, setQuery] = useState('')

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const q = trimmed.toLowerCase()

  const shown = searching
    ? frames.filter((f) => (rowsByFrame.get(f.frame_id) ?? []).some((r) => hits(r, q)))
    : frames

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', maxWidth: 360 }}>
          <span style={{ position: 'absolute', left: 10, color: '#606060', fontSize: 14, pointerEvents: 'none' }}>&#128269;</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名で検索..."
            style={{
              width: '100%',
              padding: '7px 36px 7px 32px',
              borderRadius: 20,
              fontFamily: 'inherit',
              fontSize: 15,
              outline: 'none',
              background: '#1c1c1c',
              color: '#e8e8e8',
              border: searching ? '1px solid #b32e46' : '1px solid #2e2e2e',
              boxShadow: searching ? '0 0 0 2px rgba(179,46,70,0.25)' : undefined,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {searching && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: 14, lineHeight: 1, padding: 0 }}
              title="クリア"
            >
              &#10005;
            </button>
          )}
        </div>
        {searching ? (
          <span style={{ fontSize: 13, color: '#606060' }}>{shown.length} 件の枠がヒット</span>
        ) : (
          <>
            <button className="btn-secondary" onClick={() => { setDefaultOpen(true); setMountKey((k) => k + 1) }}>
              &#9660; OPEN
            </button>
            <button className="btn-secondary" onClick={() => { setDefaultOpen(false); setMountKey((k) => k + 1) }}>
              &#9660; CLOSE
            </button>
          </>
        )}
      </div>

      {searching && shown.length === 0 && (
        <p style={{ color: '#606060', fontSize: 14 }}>「{trimmed}」を含む枠が見つかりませんでした。</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {shown.map((f) => (
          <Expander
            key={f.frame_id + '_' + mountKey}
            db={db}
            frame={f}
            rows={(rowsByFrame.get(f.frame_id) ?? []).filter((r) => !searching || hits(r, q))}
            forceOpen={searching}
            defaultOpen={defaultOpen}
            query={q}
          />
        ))}
      </div>
    </div>
  )
}

const hits = (r: Row, q: string) =>
  !!r.song && (r.song.title.toLowerCase().includes(q) || r.song.artist.toLowerCase().includes(q))

function Expander({
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
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  const isOpen = forceOpen || localOpen
  const showCollab = rows.some((r) => r.perf.collab.length > 0)

  return (
    <div className="expander">
      <button className="expander-header" onClick={() => setLocalOpen((v) => !v)} aria-expanded={isOpen}>
        <span style={{ marginRight: 8 }}>{isOpen ? '\u269c' : '\u25b6'}</span>
        <span>
          {jstDate(frame.started_at)}　{frame.title}
        </span>
      </button>

      <div style={{ height: isOpen ? 'auto' : 0, overflow: 'hidden' }}>
        <div className="expander-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            <div>
              <img
                src={'https://img.youtube.com/vi/' + frame.video_id + '/mqdefault.jpg'}
                alt="サムネイル"
                style={{ width: '100%', borderRadius: 6 }}
                loading="lazy"
              />
              <a
                href={watchUrl(frame.video_id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#b32e46', display: 'block', marginTop: 4 }}
              >
                &#9654; YouTubeで開く
              </a>
            </div>

            <div style={{ overflowX: 'auto' }} className="setlist-table-wrap">
              <table className="setlist-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>楽曲名</th>
                    <th>原曲アーティスト</th>
                    <th>URL</th>
                    <th>タグ</th>
                    {showCollab && <th>コラボ相手様</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const title = r.song?.title ?? ''
                    const artist = r.song?.artist ?? ''
                    const hitTitle = !!query && title.toLowerCase().includes(query)
                    const hitArtist = !!query && artist.toLowerCase().includes(query)
                    return (
                      <tr
                        key={r.perf.start_sec}
                        style={hitTitle || hitArtist ? { backgroundColor: 'rgba(107,159,212,0.12)' } : undefined}
                      >
                        <td>{r.no}</td>
                        <td style={hitTitle ? { fontWeight: 600, color: '#b32e46' } : undefined}>
                          {r.isFirst && <span className="first-badge">初</span>}
                          {title}
                        </td>
                        <td style={hitArtist ? { fontWeight: 600, color: '#b32e46' } : undefined}>{artist}</td>
                        <td>
                          <a href={watchUrl(frame.video_id, r.perf.start_sec)} target="_blank" rel="noopener noreferrer">
                            {hms(r.perf.start_sec)}
                          </a>
                        </td>
                        <td>
                          {r.perf.tags.map((id) => (
                            <span key={id} className="tag-chip">
                              {db.tagById.get(id)?.label ?? id}
                            </span>
                          ))}
                        </td>
                        {showCollab && <td>{r.perf.collab.join(' / ')}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
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
    <div>
      <Charts
        stats={stats}
        titles={{ ranking: 'よく歌われている曲 TOP20', year: 'リリース年の分布', artist: 'アーティスト別' }}
        colors={{
          font: '#8a8a8a',
          axis: '#6a6a6a',
          grid: 'rgba(255,255,255,0.08)',
          bar: (r) => `rgba(179,46,70,${0.3 + 0.7 * r})`,
          scale: [
            [0.0, '#2a0d13'],
            [0.4, '#6b1b29'],
            [0.7, '#b32e46'],
            [1.0, '#e0748a'],
          ],
          treeLine: '#0e0e0e',
          treeFont: '#e8e8e8',
        }}
      />
      <h2 className="section-title">Sung Repertoire — {stats.length}</h2>
      <div className="songs-table-wrap">
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

/* 現行サイトと同じ3つのグラフ。集計は歌唱データから作る。 */
function Charts({
  stats,
  colors,
  titles,
}: {
  stats: { song: Song; count: number }[]
  titles: { ranking: string; year: string; artist: string }
  colors: {
    font: string
    axis: string
    grid: string
    bar: (ratio: number) => string
    scale: [number, string][]
    treeLine: string
    treeFont: string
  }
}) {
  const top20 = [...stats].sort((a, b) => b.count - a.count).slice(0, 20)
  const maxCount = top20[0]?.count ?? 1

  const yearMap = new Map<string, number>()
  for (const s of stats) {
    const year = (s.song.released || '').slice(0, 4)
    if (/^\d{4}$/.test(year)) yearMap.set(year, (yearMap.get(year) ?? 0) + 1)
  }
  const years = [...yearMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  const artistMap = new Map<string, number>()
  for (const s of stats) {
    const a = s.song.artist?.trim()
    if (a) artistMap.set(a, (artistMap.get(a) ?? 0) + s.count)
  }
  const artists = [...artistMap.entries()].sort((a, b) => b[1] - a[1])
  const artistTotal = artists.reduce((sum, a) => sum + a[1], 0)

  const common = {
    config: { displayModeBar: false, responsive: true, scrollZoom: false },
    style: { width: '100%' },
    useResizeHandler: true,
  } as const

  return (
    <>
      <h3 style={{ margin: '24px 0 8px' }}>{titles.ranking}</h3>
      <Chart
        {...common}
        data={[
          {
            type: 'bar',
            orientation: 'h',
            x: top20.map((s) => s.count),
            y: top20.map((s) => s.song.title),
            text: top20.map((s) => String(s.count)),
            textposition: 'outside',
            marker: { color: top20.map((s) => colors.bar(s.count / maxCount)), line: { width: 0 } },
            customdata: top20.map((s) => [s.song.artist]),
            hovertemplate: '<b>%{y}</b><br>%{x}<br>Artist: %{customdata[0]}<extra></extra>',
          },
        ]}
        layout={{
          paper_bgcolor: 'rgba(0,0,0,0)',
          plot_bgcolor: 'rgba(0,0,0,0)',
          font: { family: 'Noto Sans JP', color: colors.font, size: 12 },
          yaxis: { autorange: 'reversed', showgrid: false, tickfont: { size: 11 }, color: colors.font },
          xaxis: { showgrid: true, gridcolor: colors.grid, zeroline: false, color: colors.axis },
          margin: { l: 160, r: 55, t: 16, b: 10 },
          height: Math.max(380, top20.length * 26),
          dragmode: false,
        }}
      />

      {years.length > 0 && (
        <>
          <h3 style={{ margin: '24px 0 8px' }}>{titles.year}</h3>
          <Chart
            {...common}
            data={[
              {
                type: 'bar',
                x: years.map(([y]) => y),
                y: years.map(([, v]) => v),
                text: years.map(([, v]) => String(v)),
                textposition: 'outside',
                marker: { color: years.map(([, v]) => v), colorscale: colors.scale, line: { width: 0 } },
                hovertemplate: '<b>%{x}</b><br>%{y}<extra></extra>',
              },
            ]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Noto Sans JP', color: colors.font, size: 12 },
              xaxis: { showgrid: false, color: colors.axis, tickangle: -45, tickfont: { size: 11 } },
              yaxis: { showgrid: true, gridcolor: colors.grid, zeroline: false, color: colors.axis },
              margin: { l: 40, r: 20, t: 24, b: 60 },
              height: 320,
              dragmode: false,
            }}
          />
        </>
      )}

      {artists.length > 0 && (
        <>
          <h3 style={{ margin: '24px 0 8px' }}>{titles.artist}</h3>
          <Chart
            {...common}
            data={[
              {
                type: 'treemap',
                labels: artists.map(([name]) => name),
                parents: artists.map(() => ''),
                values: artists.map(([, v]) => v),
                text: artists.map(([, v]) => ((v / artistTotal) * 100).toFixed(1) + '%'),
                texttemplate: '<b>%{label}</b><br>%{value}<br>%{text}',
                hovertemplate: '<b>%{label}</b><br>%{value} (%{text})<extra></extra>',
                marker: {
                  colors: artists.map(([, v]) => v),
                  colorscale: colors.scale,
                  line: { width: 2, color: colors.treeLine },
                  pad: { t: 22, l: 4, r: 4, b: 4 },
                },
              },
            ]}
            layout={{
              paper_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Noto Sans JP', color: colors.treeFont },
              margin: { t: 4, l: 0, r: 0, b: 0 },
              height: 420,
              dragmode: false,
            }}
          />
        </>
      )}
    </>
  )
}
