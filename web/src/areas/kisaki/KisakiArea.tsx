import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, watchUrl } from '../../data'
import { Link } from '../../router'
import RankCards, { HighlightNote, markTopHalf, type RankItem } from '../../components/RankCards'
import YearPicker from '../../components/YearPicker'
import AboutText from '../../components/AboutText'
import { SearchIcon } from '../../components/icons'
import TerminalMessage from './TerminalMessage'
import './kisaki.css'

const asset = (name: string) => `${import.meta.env.BASE_URL}kisaki/${name}`

const IMAGES = [
  asset('kisaki_imagecard_01.jpg'),
  asset('kisaki_imagecard_02.jpg'),
  asset('kisaki_imagecard_03.jpg'),
]

const FADE_MS = 1500
/** 背景画像の自動送り。元サイトと同じ間隔 */
const ADVANCE_MS = 15000

type Tab = 'streams' | 'songs' | 'about' | null

const NAV_ITEMS: { tab: Exclude<Tab, null>; label: string }[] = [
  { tab: 'streams', label: 'LiveStreaming INFO' },
  { tab: 'songs', label: 'Sung Repertoire' },
  { tab: 'about', label: 'About' },
]

type Row = { no: number; song: Song | undefined; perf: Performance; isFirst: boolean }

export default function KisakiArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  const [tab, setTab] = useState<Tab>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [terminalKey, setTerminalKey] = useState(0)
  const [imageIndex, setImageIndex] = useState(0)

  const imgARef = useRef<HTMLImageElement>(null)
  const imgBRef = useRef<HTMLImageElement>(null)
  const activeRef = useRef<'a' | 'b'>('a')
  const movingRef = useRef(false)
  const indexRef = useRef(0)
  const grainRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  /* 背景画像のクロスフェード。一定間隔で送る */
  useEffect(() => {
    const a = imgARef.current
    const b = imgBRef.current
    if (!a || !b) return
    a.style.opacity = '1'
    b.style.opacity = '0'

    const advance = () => {
      if (movingRef.current) return
      movingRef.current = true
      const isA = activeRef.current === 'a'
      const cur = isA ? a : b
      const next = isA ? b : a
      const nextIndex = (indexRef.current + 1) % IMAGES.length

      next.src = IMAGES[nextIndex]
      cur.style.opacity = '0'
      next.style.opacity = '1'

      setTimeout(() => {
        indexRef.current = nextIndex
        setImageIndex(nextIndex)
        activeRef.current = isA ? 'b' : 'a'
        movingRef.current = false
      }, FADE_MS)
    }

    const timer = setInterval(advance, ADVANCE_MS)
    return () => clearInterval(timer)
  }, [])

  /* 粒状ノイズ */
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
    const a = imgARef.current
    const b = imgBRef.current
    if (!a || !b) return

    movingRef.current = true
    const isA = activeRef.current === 'a'
    const cur = isA ? a : b
    const next = isA ? b : a

    next.src = IMAGES[index]
    cur.style.opacity = '0'
    next.style.opacity = '1'

    setTimeout(() => {
      indexRef.current = index
      setImageIndex(index)
      activeRef.current = isA ? 'b' : 'a'
      movingRef.current = false
    }, FADE_MS)
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

  const toHome = () => {
    setTab(null)
    setTerminalKey((k) => k + 1)
    setSidebarOpen(false)
  }

  return (
    <div className="kisaki-root">
      <div className="layout">
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        <aside className={`sidebar${sidebarOpen ? ' sidebar--open' : ''}`}>
          <div className="sidebar-top" onClick={toHome}>
            <span className="sidebar-tagline">CasaCasa....MozoMozo...</span>
            <span className="sidebar-title">芋虫羽虫㌠の部屋</span>
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
              <img ref={imgARef} className="hero-video" src={IMAGES[0]} alt="" />
              <img ref={imgBRef} className="hero-video" alt="" />
              <canvas ref={grainRef} className="hero-grain" />
              <div className="hero-overlay" />
              <div className="hero-video-indicators">
                {IMAGES.map((_, i) => (
                  <div
                    key={i}
                    className={`hero-video-indicator${imageIndex === i ? ' active' : ''}`}
                    onClick={() => skipTo(i)}
                  >
                    {i + 1}
                  </div>
                ))}
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
                    <h2 className="section-title">About</h2>
                    <AboutText singer="妃玖" />
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

          {tab === 'songs' && (
            <main className="content-area">
              <button className="back-btn" onClick={toHome}>
                ← BACK TO HOME
              </button>
              <Repertoire db={db} perfs={perfs} />
            </main>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── LiveStreaming INFO */

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
          <span
            style={{ position: 'absolute', left: 10, color: '#8a8a8a', display: 'inline-flex', pointerEvents: 'none' }}
            aria-hidden
          >
            <SearchIcon />
          </span>
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
              border: searching ? '1px solid #3a8f55' : '1px solid #2e2e2e',
              boxShadow: searching ? '0 0 0 2px rgba(58,143,85,0.25)' : undefined,
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}
          />
          {searching && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute',
                right: 10,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#aaa',
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
              title="クリア"
            >
              ✕
            </button>
          )}
        </div>
        {searching ? (
          <span style={{ fontSize: 13, color: '#606060' }}>{shown.length} 件の枠がヒット</span>
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
              ▼ CLOSE
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
            key={`${f.frame_id}_${mountKey}`}
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
        <span style={{ marginRight: 8 }}>{isOpen ? '⚜' : '▶'}</span>
        <span>
          {jstDate(frame.started_at)}　{frame.title}
        </span>
      </button>

      <div style={{ maxHeight: isOpen ? 1200 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
        <div className="expander-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            <div>
              <img
                src={`https://img.youtube.com/vi/${frame.video_id}/mqdefault.jpg`}
                alt="サムネイル"
                style={{ width: '100%', borderRadius: 6 }}
                loading="lazy"
              />
              <a
                href={watchUrl(frame.video_id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#3a8f55', display: 'block', marginTop: 4 }}
              >
                ▶ YouTubeで開く
              </a>
            </div>

            <div>
              {rows.map((r) => {
                const title = r.song?.title ?? ''
                const artist = r.song?.artist ?? ''
                const hitTitle = !!query && title.toLowerCase().includes(query)
                const hitArtist = !!query && artist.toLowerCase().includes(query)
                return (
                  <div
                    key={r.perf.start_sec}
                    className={`setlist-card${hitTitle || hitArtist ? ' setlist-card--hit' : ''}`}
                  >
                    <span className="setlist-card-num">{r.no}</span>
                    <div className="setlist-card-body">
                      <div className="setlist-card-title">
                        {r.isFirst && <span className="setlist-card-badge">初</span>}
                        <span className={hitTitle ? 'setlist-card-title--hit' : ''}>{title}</span>
                        {r.perf.tags.map((id) => (
                          <span key={id} className="setlist-card-badge">
                            {db.tagById.get(id)?.label ?? id}
                          </span>
                        ))}
                      </div>
                      <div className={`setlist-card-artist${hitArtist ? ' setlist-card-artist--hit' : ''}`}>
                        {artist}
                      </div>
                      {showCollab && r.perf.collab.length > 0 && (
                        <div className="setlist-card-collab">w/ {r.perf.collab.join(' / ')}</div>
                      )}
                    </div>
                    <a
                      href={watchUrl(frame.video_id, r.perf.start_sec)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="setlist-card-link"
                    >
                      ▶ {hms(r.perf.start_sec)}
                    </a>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
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

/** 押すたびに 回数多い→回数少ない→新しい→古い の順で切り替わる */
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
      <div className="section__head">
        <h2 className="section__title">Sung Repertoire</h2>
        <p className="section__sub">{stats.length}曲</p>
      </div>

      <div className="section-head">
        <h3 style={{ margin: 0 }}>歌唱回数</h3>
        <SortToggle value={sort} onChange={setSort} />
        <YearPicker years={pickableYears} value={year} onChange={setYear} />
        <div
          className="section-head__search"
          style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', maxWidth: 360 }}
        >
          <span
            style={{ position: 'absolute', left: 10, color: '#8a8a8a', display: 'inline-flex', pointerEvents: 'none' }}
            aria-hidden
          >
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="曲名・アーティストで絞り込み"
            style={{
              width: '100%',
              padding: '7px 36px 7px 32px',
              borderRadius: 20,
              fontFamily: 'inherit',
              fontSize: 15,
              outline: 'none',
              background: '#1c1c1c',
              color: '#e8e8e8',
              border: q ? '1px solid #3a8f55' : '1px solid #2e2e2e',
            }}
          />
        </div>
      </div>
      <RankCards items={ranking} paged columns={2} rows={5} />

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
