import { useEffect, useMemo, useRef, useState } from 'react'
import type { ContentVideo, Contents, Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, loadContents, watchUrl } from '../../data'
import { Link } from '../../router'
import RankCards, { HighlightNote, markTopHalf, type RankItem } from '../../components/RankCards'
import YearPicker from '../../components/YearPicker'
import AboutText from '../../components/AboutText'
import { SearchIcon } from '../../components/icons'
import './wouca.css'

const asset = (name: string) => `${import.meta.env.BASE_URL}wouca/${name}`
const LOGO = asset('uwo_ter_room_icon.png')
const VIDEOS = [
  asset('wouca_moviecard_04.mp4'),
  asset('wouca_moviecard_05.mp4'),
  asset('wouca_moviecard_06.mp4'),
]
const FADE_BEFORE = 1.2
const CONTACT = 'https://x.com/WL_GE_inn'

type Row = { no: number; song: Song | undefined; perf: Performance; isFirst: boolean }

/** サムネイルを押すまで iframe を作らない。一覧を軽く保つため */
function LiteYouTube({
  videoId,
  title,
  isShort = false,
}: {
  videoId: string
  title: string
  isShort?: boolean
}) {
  const [active, setActive] = useState(false)
  return (
    <div className={isShort ? 'short-embed-wrap' : 'pickup-embed-wrap'}>
      {active ? (
        <iframe
          className="pickup-embed"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          className="lite-yt-btn"
          onClick={() => setActive(true)}
          aria-label={title}
          style={{ backgroundImage: `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)` }}
        >
          <span className="lite-yt-play" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export default function WoucaArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  const [aboutOpen, setAboutOpen] = useState(false)
  const [contents, setContents] = useState<Contents>({
    pickup: [],
    original: [],
    short: [],
    livestreaming: [],
  })

  const videoARef = useRef<HTMLVideoElement>(null)
  const videoBRef = useRef<HTMLVideoElement>(null)
  const activeRef = useRef<'a' | 'b'>('a')
  const indexRef = useRef(0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    loadContents('wouca').then(setContents)
  }, [])

  /* 背景動画のクロスフェード */
  useEffect(() => {
    const a = videoARef.current
    const b = videoBRef.current
    if (!a || !b) return
    a.style.opacity = '1'
    b.style.opacity = '0'

    const onTime = (e: Event) => {
      const isA = e.target === a
      if ((activeRef.current === 'a') !== isA) return
      const cur = isA ? a : b
      const next = isA ? b : a
      if (!cur.duration || isNaN(cur.duration)) return
      if (cur.duration - cur.currentTime > FADE_BEFORE) return

      const nextIndex = (indexRef.current + 1) % VIDEOS.length
      next.src = VIDEOS[nextIndex]
      next.load()
      next.currentTime = 0
      next.play().catch(() => {})
      cur.style.opacity = '0'
      next.style.opacity = '1'
      setTimeout(() => {
        cur.pause()
        cur.currentTime = 0
        indexRef.current = nextIndex
        activeRef.current = isA ? 'b' : 'a'
      }, 1200)
    }

    a.addEventListener('timeupdate', onTime)
    b.addEventListener('timeupdate', onTime)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      b.removeEventListener('timeupdate', onTime)
    }
  }, [])

  /* マウス周りだけ映像を切り刻むグリッチ */
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const BOX = 120
    let frame = 0
    const draw = () => {
      frame++
      if (frame % 3 === 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const mouse = mouseRef.current
        const video = activeRef.current === 'a' ? videoARef.current : videoBRef.current
        if (mouse && video && video.readyState >= 2 && video.videoWidth > 0) {
          const rx = video.videoWidth / canvas.width
          const ry = video.videoHeight / canvas.height
          const count = 15 + Math.floor(Math.random() * 10)
          ctx.save()
          ctx.beginPath()
          ctx.rect(mouse.x - BOX, mouse.y - BOX, BOX * 2, BOX * 2)
          ctx.clip()
          for (let i = 0; i < count; i++) {
            const size = 20 + Math.random() * 80
            const dstX = mouse.x + (Math.random() - 0.5) * BOX * 1.5 - size / 2
            const dstY = mouse.y + (Math.random() - 0.5) * BOX * 1.5 - size / 2
            const srcX = Math.max(0, dstX * rx + (Math.random() - 0.5) * 60)
            const srcY = Math.max(0, dstY * ry)
            ctx.globalAlpha = 0.5 + Math.random() * 0.5
            ctx.drawImage(video, srcX, srcY, size * rx, size * ry, dstX, dstY, size, size)
          }
          ctx.restore()
        }
      }
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const rowsByFrame = useMemo(() => {
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

  /** 節の先頭が固定ヘッダーの真下に来るよう止める */
  const jumpTo = (id: string) => {
    const el = document.getElementById(id)
    if (!el) return
    const header = document.querySelector('.wouca-root .site-header')
    const headerH = header ? header.getBoundingClientRect().height : 0
    window.scrollTo({
      top: el.getBoundingClientRect().top + window.scrollY - headerH,
      behavior: 'smooth',
    })
  }

  return (
    <div className="wouca-root">
      <header className="site-header">
        <div
          className="header-logo"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{ cursor: 'pointer' }}
        >
          <div className="logo-img" style={{ backgroundImage: `url(${LOGO})` }} />
        </div>
        <nav className="header-nav">
          <Link to="/" className="header-nav-link">
            HOME
          </Link>
          <a href={CONTACT} target="_blank" rel="noopener noreferrer" className="header-nav-link">
            CONTACT
          </a>
          <button
            className={`header-nav-link header-nav-btn${aboutOpen ? ' active' : ''}`}
            onClick={() => setAboutOpen((v) => !v)}
          >
            About
          </button>
        </nav>
      </header>

      <>
          <section
            className="hero-section"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
            }}
            onMouseLeave={() => {
              mouseRef.current = null
            }}
          >
            <video ref={videoARef} className="hero-video" src={VIDEOS[0]} autoPlay muted playsInline />
            <video ref={videoBRef} className="hero-video" muted playsInline />
            <canvas ref={canvasRef} className="hero-glitch-canvas" />
            <span className="hero-catchcopy">We love wouca!!!</span>
          </section>

          <section className="filter-section">
            <div className="filter-left">
              <p className="filter-tagline">
                <span className="filter-tagline-prefix">
                  <span>+</span>
                  <span>++</span>
                </span>
                unofficial / uwo_ter&apos;s aquarium
              </p>
              <p className="filter-sub">We love wouca / everybody&apos;s crazy about her</p>
            </div>
            <div className="filter-right">
              <button className="filter-item" onClick={() => jumpTo('streams')}>
                <span className="filter-item-name">LiveStreaming Info</span>
              </button>
              <button className="filter-item" onClick={() => jumpTo('songs')}>
                <span className="filter-item-name">Sung Repertoire</span>
              </button>
            </div>
          </section>

          <section className="contents-section">
            <ContentGrid title="PICKUP contents" videos={contents.pickup} />
            <hr className="contents-divider" />
            <ContentGrid title="Original Song" videos={contents.original} />
            <hr className="contents-divider" />
            <ContentGrid title="Short" videos={contents.short} isShort />
            <hr className="contents-divider" />
            <ContentGrid title="LiveStreaming" videos={contents.livestreaming} />
          </section>

          <section className="main-content wc-section" id="streams">
            <h2 className="contents-heading">LiveStreaming Info</h2>
            <Streams db={db} frames={frames} rowsByFrame={rowsByFrame} />
          </section>

          <section className="main-content wc-section" id="songs">
            <h2 className="contents-heading">Sung Repertoire</h2>
            <Repertoire db={db} perfs={perfs} />
          </section>
      </>

      {aboutOpen && (
        <div className="modal-overlay" onClick={() => setAboutOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setAboutOpen(false)}>
              ✕
            </button>
            <div className="modal-body">
              <h2>About</h2>
              <AboutText singer="wouca" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ContentGrid({
  title,
  videos,
  isShort = false,
}: {
  title: string
  videos: ContentVideo[]
  isShort?: boolean
}) {
  if (videos.length === 0) return null
  return (
    <>
      <h2 className="contents-heading">{title}</h2>
      <div className={isShort ? 'short-grid' : 'pickup-grid'}>
        {videos.map((v) => (
          <div key={v.video_id} className={isShort ? 'short-card' : 'pickup-card'}>
            {v.note && <span className="new-release-badge">{v.note}</span>}
            <LiteYouTube videoId={v.video_id} title={v.title} isShort={isShort} />
            <p className="pickup-card-title">{v.title}</p>
          </div>
        ))}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────── LiveStreaming Info */

const hits = (r: Row, q: string) =>
  !!r.song && (r.song.title.toLowerCase().includes(q) || r.song.artist.toLowerCase().includes(q))

function Streams({
  db,
  frames,
  rowsByFrame,
}: {
  db: Db
  frames: Frame[]
  rowsByFrame: Map<string, Row[]>
}) {
  const [query, setQuery] = useState('')
  const [defaultOpen, setDefaultOpen] = useState(false)
  const [mountKey, setMountKey] = useState(0)
  const [page, setPage] = useState(1)

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const q = trimmed.toLowerCase()

  const matched = searching
    ? frames.filter((f) => (rowsByFrame.get(f.frame_id) ?? []).some((r) => hits(r, q)))
    : frames

  const PER_PAGE = 10
  const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE))
  const current = Math.min(page, totalPages)
  const shown = matched.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  return (
    <div>
      <div className="wc-toolbar">
        <div className="wc-search">
          <span className="wc-search__icon" aria-hidden>
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名・アーティストで検索"
            className={searching ? 'searching' : ''}
          />
          {searching && (
            <button className="wc-search__clear" onClick={() => setQuery('')} title="クリア">
              ✕
            </button>
          )}
        </div>
        {searching ? (
          <span className="wc-hits">{matched.length} 件の枠がヒット</span>
        ) : (
          <>
            <button
              className="btn-secondary"
              onClick={() => {
                setDefaultOpen(true)
                setMountKey((k) => k + 1)
              }}
            >
              ▼ OPEN
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setDefaultOpen(false)
                setMountKey((k) => k + 1)
              }}
            >
              ▲ CLOSE
            </button>
          </>
        )}
      </div>

      {searching && matched.length === 0 && (
        <p className="wc-hits">「{trimmed}」を含む枠が見つかりませんでした。</p>
      )}

      <div className="wc-expanders">
        {shown.map((f) => (
          <Expander
            key={`${f.frame_id}_${mountKey}`}
            db={db}
            frame={f}
            rows={(rowsByFrame.get(f.frame_id) ?? []).filter((r) => !searching || hits(r, q))}
            forceOpen={searching}
            defaultOpen={defaultOpen}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pager">
          <button
            type="button"
            className="pager__btn"
            onClick={() => setPage(current - 1)}
            disabled={current <= 1}
            aria-label="前のページ"
          >
            <span aria-hidden="true">◀</span>
          </button>
          <span className="pager__count">
            <strong>{current}</strong> / {totalPages}
          </span>
          <button
            type="button"
            className="pager__btn"
            onClick={() => setPage(current + 1)}
            disabled={current >= totalPages}
            aria-label="次のページ"
          >
            <span aria-hidden="true">▶</span>
          </button>
        </div>
      )}
    </div>
  )
}

function Expander({
  db,
  frame,
  rows,
  forceOpen,
  defaultOpen,
}: {
  db: Db
  frame: Frame
  rows: Row[]
  forceOpen: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  const showCollab = rows.some((r) => r.perf.collab.length > 0)

  return (
    <div className="expander">
      <button className="expander-header" onClick={() => setOpen((v) => !v)} aria-expanded={isOpen}>
        <span style={{ marginRight: 8 }}>{isOpen ? '✦' : '▶'}</span>
        <span>
          {jstDate(frame.started_at)}　{frame.title}
        </span>
      </button>

      {isOpen && (
        <div className="expander-body">
          <div className="wc-frame-grid">
            <div>
              <img
                src={`https://img.youtube.com/vi/${frame.video_id}/mqdefault.jpg`}
                alt=""
                loading="lazy"
                style={{ width: '100%', borderRadius: 6 }}
              />
              <a
                href={watchUrl(frame.video_id)}
                target="_blank"
                rel="noopener noreferrer"
                className="wc-frame-link"
              >
                ▶ YouTubeで開く
              </a>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="setlist-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>楽曲名</th>
                    <th>原曲アーティスト</th>
                    <th>タグ</th>
                    {showCollab && <th>コラボ</th>}
                    <th>再生</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.perf.start_sec}>
                      <td>{r.no}</td>
                      <td>
                        {r.isFirst && <span className="wc-first">初</span>}
                        {r.song?.title ?? ''}
                      </td>
                      <td>{r.song?.artist ?? ''}</td>
                      <td>
                        {r.perf.tags.map((id) => (
                          <span key={id} className="wc-tag">
                            {db.tagById.get(id)?.label ?? id}
                          </span>
                        ))}
                      </td>
                      {showCollab && <td>{r.perf.collab.join(' / ')}</td>}
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────── Sung Repertoire */

type SongSort = 'count-desc' | 'count-asc' | 'released-desc' | 'released-asc'

const SORT_LABELS: { value: SongSort; label: string }[] = [
  { value: 'count-desc', label: '回数が多い順' },
  { value: 'count-asc', label: '回数が少ない順' },
  { value: 'released-desc', label: 'リリースが新しい順' },
  { value: 'released-asc', label: 'リリースが古い順' },
]

/** リリース日が空の曲は、どちらの向きでも末尾へ送る */
function sortSongs(stats: { song: Song; count: number }[], sort: SongSort) {
  const byTitle = (a: { song: Song }, b: { song: Song }) =>
    a.song.title.localeCompare(b.song.title, 'ja')
  return [...stats].sort((a, b) => {
    if (sort === 'count-desc') return b.count - a.count || byTitle(a, b)
    if (sort === 'count-asc') return a.count - b.count || byTitle(a, b)
    const ra = a.song.released || ''
    const rb = b.song.released || ''
    if (!ra && !rb) return byTitle(a, b)
    if (!ra) return 1
    if (!rb) return -1
    return (sort === 'released-desc' ? rb.localeCompare(ra) : ra.localeCompare(rb)) || byTitle(a, b)
  })
}

function SortToggle({ value, onChange }: { value: SongSort; onChange: (v: SongSort) => void }) {
  const index = SORT_LABELS.findIndex((o) => o.value === value)
  const next = SORT_LABELS[(index + 1) % SORT_LABELS.length]
  return (
    <button
      type="button"
      className="sort-toggle"
      onClick={() => onChange(next.value)}
      title={`クリックで「${next.label}」に切り替え`}
      aria-label="並べ替えを切り替える"
    >
      <span className="sort-toggle__mark" aria-hidden="true">
        ⇅
      </span>
      {SORT_LABELS[index === -1 ? 0 : index].label}
    </button>
  )
}

/** 登録が無くても見出しの語は残し、カードの高さを揃える */
function creditLines(song: Song): string[] {
  return [
    ['作詞', song.lyricists],
    ['作曲', song.composers],
    ['編曲', song.arrangers],
  ].map(([label, names]) => `${label}　${(names as string[]).join(' / ')}`)
}

function Repertoire({ db, perfs }: { db: Db; perfs: Performance[] }) {
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SongSort>('count-desc')
  const [year, setYear] = useState<string | null>(null)

  const stats = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of perfs) counts.set(p.song_id, (counts.get(p.song_id) ?? 0) + 1)
    const list: { song: Song; count: number }[] = []
    for (const [id, count] of counts) {
      const song = db.songById.get(id)
      if (song) list.push({ song, count })
    }
    return list
  }, [perfs, db])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? stats.filter(
        (s) => s.song.title.toLowerCase().includes(q) || s.song.artist.toLowerCase().includes(q),
      )
    : stats

  const pickableYears = [
    ...new Set(
      filtered.map((s) => (s.song.released || '').slice(0, 4)).filter((y) => /^\d{4}$/.test(y)),
    ),
  ].sort((a, b) => b.localeCompare(a))

  const rankingSource = year
    ? filtered.filter((s) => (s.song.released || '').slice(0, 4) === year)
    : filtered

  const ranking: RankItem[] = sortSongs(rankingSource, sort).map((s, i) => ({
    key: s.song.song_id,
    rank: i + 1,
    title: s.song.title,
    titleRight: `リリース日：${s.song.released || ''}`,
    sub: s.song.artist,
    lines: creditLines(s.song),
    value: s.count,
    unit: '回',
  }))

  const yearMap = new Map<string, number>()
  for (const s of filtered) {
    const y = (s.song.released || '').slice(0, 4)
    if (/^\d{4}$/.test(y)) yearMap.set(y, (yearMap.get(y) ?? 0) + 1)
  }
  const yearTotal = [...yearMap.values()].reduce((a, b) => a + b, 0)
  const years: RankItem[] = [...yearMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([y, n], i) => ({
      key: y,
      rank: i + 1,
      title: `${y}年`,
      value: n,
      unit: '曲',
      ratio: yearTotal ? n / yearTotal : 0,
    }))

  const artistMap = new Map<string, number>()
  for (const s of filtered) {
    const a = s.song.artist?.trim()
    if (a) artistMap.set(a, (artistMap.get(a) ?? 0) + s.count)
  }
  const artistTotal = [...artistMap.values()].reduce((a, b) => a + b, 0)
  const artists: RankItem[] = [...artistMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
    .map(([name, n], i) => ({
      key: name,
      rank: i + 1,
      title: name,
      value: n,
      unit: '回',
      ratio: artistTotal ? n / artistTotal : 0,
    }))

  return (
    <div>
      <div className="wc-search wc-search--wide">
        <span className="wc-search__icon" aria-hidden>
          <SearchIcon />
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="曲名・アーティストで絞り込み"
          className={q ? 'searching' : ''}
        />
      </div>

      <div className="section-head">
        <h3 style={{ margin: 0 }}>歌唱回数</h3>
        <SortToggle value={sort} onChange={setSort} />
        <YearPicker years={pickableYears} value={year} onChange={setYear} />
      </div>
      <RankCards items={ranking} paged columns={2} rows={10} />

      <div className="section-head">
        <h3 style={{ margin: 0 }}>リリース年の分布</h3>
        <HighlightNote />
      </div>
      <RankCards items={markTopHalf(years)} paged columns={3} rows={10} />

      <div className="section-head">
        <h3 style={{ margin: 0 }}>原曲アーティスト分布</h3>
        <HighlightNote />
      </div>
      <RankCards items={markTopHalf(artists)} paged columns={3} rows={10} />
    </div>
  )
}
