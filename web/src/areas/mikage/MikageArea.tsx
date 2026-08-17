import { useMemo, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, watchUrl } from '../../data'
import { Link } from '../../router'
import RankCards, { HighlightNote, markTopHalf, type RankItem } from '../../components/RankCards'
import YearPicker from '../../components/YearPicker'
import { Reveal, SectionHead, useCountUp, useInView } from '../../components/Reveal'
import { SearchIcon } from '../../components/icons'
import AboutText from '../../components/AboutText'
import { LANGS, storedLang, translator } from './i18n'
import '../../components/scroll.css'
import './mikage.css'

type T = ReturnType<typeof translator>

const BG = `${import.meta.env.BASE_URL}mikage/background_0.png`
const CHANNEL = 'https://www.youtube.com/channel/UC2daHxnuJJBM5NWci1RRkeA'
const ROMAJI = 'MIKAGE'

/** ヘッダーとサイドバーから飛べる節 */
const SECTIONS = [
  { id: 'numbers', label: 'Numbers' },
  { id: 'setlist', label: 'Setlist' },
  { id: 'repertoire', label: 'Repertoire' },
]

/** 節の先頭が上部バーの真下に来るよう止める。
 *  余白を足すと、その分だけ手前の節が上に覗いてしまう。 */
function scrollToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const bar = document.querySelector('.mk-topbar')
  const barH = bar ? bar.getBoundingClientRect().height : 0
  const top = el.getBoundingClientRect().top + window.scrollY - barH
  window.scrollTo({ top, behavior: 'smooth' })
}

/** 1歌唱ぶんを表示用に組み立てたもの */
type Row = {
  no: number
  song: Song | undefined
  perf: Performance
  isFirst: boolean
}

export default function MikageArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  const [lang, setLang] = useState(storedLang)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const t = useMemo(() => translator(lang), [lang])

  // 初披露は枠の開始時刻→枠内の秒 の順で song_id の初出を拾う
  const rowsByFrame = useMemo(() => {
    const at = new Map(frames.map((f) => [f.frame_id, f.started_at]))
    const first = new Map<string, string>()
    for (const p of [...perfs].sort(
      (a, b) =>
        (at.get(a.frame_id) ?? '').localeCompare(at.get(b.frame_id) ?? '') ||
        a.start_sec - b.start_sec,
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
  }, [frames, perfs, db])

  return (
    <div
      className="mikage-root mikage-scroll"
      style={{ backgroundImage: `url(${BG})`, backgroundRepeat: 'repeat' }}
    >
      <header className="mk-topbar">
        <nav className="mk-jump">
          {SECTIONS.map((sec) => (
            <button key={sec.id} type="button" onClick={() => scrollToSection(sec.id)}>
              {sec.label}
            </button>
          ))}
        </nav>
        <div className="lang-selector">
          <select
            value={lang}
            onChange={(e) => {
              setLang(e.target.value)
              localStorage.setItem('lang', e.target.value)
            }}
            aria-label="Language"
          >
            {LANGS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen((o) => !o)}
          aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
        >
          <span>ME</span>
          <span>NU</span>
        </button>
        <nav className="sidebar-nav">
          {[...SECTIONS, { id: 'about', label: 'About' }, { id: 'links', label: 'Links' }].map(
            (sec) => (
              <button
                key={sec.id}
                className="sidebar-nav-btn"
                onClick={() => {
                  scrollToSection(sec.id)
                  setSidebarOpen(false)
                }}
              >
                <span className="sidebar-nav-text">{sec.label}</span>
              </button>
            ),
          )}
          <Link to="/" className="sidebar-nav-btn">
            <span className="sidebar-nav-text">home</span>
          </Link>
        </nav>
      </aside>

      <div className="page main-wrapper">
        <Hero />
        <Numbers
          frames={frames.length}
          perfs={perfs.length}
          repertoire={new Set(perfs.map((p) => p.song_id)).size}
          artists={
            new Set(
              perfs
                .map((p) => db.songById.get(p.song_id)?.artist?.trim())
                .filter((a): a is string => !!a),
            ).size
          }
        />
        <Setlist db={db} frames={frames} rowsByFrame={rowsByFrame} t={t} />
        <Repertoire db={db} perfs={perfs} t={t} />
        <About />
        <Links />

        <div className="site-note">
          <strong>Unofficial - MIKAGE DB</strong>
          <span>
            ただのファンによる非公式DBであり、深影さんおよびRK Musicとは一切関係ありません。
          </span>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── Hero */

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__inner">
        <p className="hero__unofficial">UNOFFICIAL SETLIST DATABASE</p>
        <h1 className="hero__name">深影</h1>
        <p className="hero__romaji" aria-label={ROMAJI}>
          {ROMAJI.split('').map((ch, i) => (
            <span key={i} aria-hidden="true">
              {ch}
            </span>
          ))}
        </p>
        <p className="hero__lead">
          歌枠のセットリストを記録しています。曲名やアーティストから、いつ何を歌ったのかを辿れます。
        </p>
        <p className="hero__scroll">SCROLL</p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── Numbers */

function NumberCell({
  value,
  label,
  unit,
  delay,
}: {
  value: number
  label: string
  unit: string
  delay: number
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  const n = useCountUp(value, inView)
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      <div className="number__value">
        {n.toLocaleString('ja-JP')}
        <em>{unit}</em>
      </div>
      <div className="number__label">{label}</div>
    </div>
  )
}

function Numbers({
  frames,
  perfs,
  repertoire,
  artists,
}: {
  frames: number
  perfs: number
  repertoire: number
  artists: number
}) {
  return (
    <section className="section" id="numbers">
      <div className="section__inner">
        <SectionHead title="Numbers" sub="収録データの規模" />
        <div className="numbers">
          <NumberCell value={frames} label="STREAMS" unit="枠" delay={0} />
          <NumberCell value={perfs} label="PERFORMANCES" unit="回" delay={80} />
          <NumberCell value={repertoire} label="REPERTOIRE" unit="曲" delay={160} />
          <NumberCell value={artists} label="ARTISTS" unit="" delay={240} />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── Setlist */

const PER_PAGE = 10

const hits = (r: Row, q: string) =>
  !!r.song && (r.song.title.toLowerCase().includes(q) || r.song.artist.toLowerCase().includes(q))

function Setlist({
  db,
  frames,
  rowsByFrame,
  t,
}: {
  db: Db
  frames: Frame[]
  rowsByFrame: Map<string, Row[]>
  t: T
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

  // 一度に出すのは10枠まで。多いとページが長くなりすぎる
  const totalPages = Math.max(1, Math.ceil(matched.length / PER_PAGE))
  const current = Math.min(page, totalPages)
  const shown = matched.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  return (
    <section className="section" id="setlist">
      <div className="section__inner">
        <SectionHead title="Setlist" sub={t('tab.streams')} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <div className="mk-search">
            <span className="mk-search__icon" aria-hidden>
              <SearchIcon />
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('streams.searchPlaceholder')}
              className={searching ? 'searching' : ''}
            />
            {searching && (
              <button className="mk-search-clear" onClick={() => setQuery('')} title="クリア">
                ✕
              </button>
            )}
          </div>
          {searching ? (
            <span style={{ fontSize: 13, color: '#606060' }}>
              {t('streams.searchHits', { count: matched.length })}
            </span>
          ) : (
            <>
              <button
                className="btn-secondary"
                onClick={() => {
                  setDefaultOpen(true)
                  setMountKey((k) => k + 1)
                }}
              >
                {t('streams.expandAll')}
              </button>
              <button
                className="btn-secondary"
                onClick={() => {
                  setDefaultOpen(false)
                  setMountKey((k) => k + 1)
                }}
              >
                {t('streams.collapseAll')}
              </button>
            </>
          )}
        </div>

        {searching && matched.length === 0 && (
          <p style={{ color: '#606060', fontSize: 14 }}>
            {t('streams.searchNoResults', { query: trimmed })}
          </p>
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
              t={t}
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
    </section>
  )
}

function Expander({
  db,
  frame,
  rows,
  forceOpen,
  defaultOpen,
  query,
  t,
}: {
  db: Db
  frame: Frame
  rows: Row[]
  forceOpen: boolean
  defaultOpen: boolean
  query: string
  t: T
}) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = forceOpen || open
  const showCollab = rows.some((r) => r.perf.collab.length > 0)
  const thumb = `https://img.youtube.com/vi/${frame.video_id}/mqdefault.jpg`

  return (
    <div className="expander">
      <button className="expander-header" onClick={() => setOpen((v) => !v)} aria-expanded={isOpen}>
        <span style={{ marginRight: 8 }}>{isOpen ? '⚜' : '▶'}</span>
        <span>
          {jstDate(frame.started_at)}　{frame.title}
        </span>
      </button>

      <div style={{ maxHeight: isOpen ? 1200 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
        <div className="expander-body">
          <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
            <div>
              <div
                style={{
                  width: '100%',
                  paddingTop: '56.25%',
                  borderRadius: 6,
                  backgroundImage: `url(${thumb})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <a
                href={watchUrl(frame.video_id)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, display: 'block', marginTop: 4 }}
              >
                {t('streams.openYouTube')}
              </a>
            </div>

            <div style={{ overflowX: 'auto' }} className="setlist-table-wrap">
              <table className="setlist-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('streams.colSong')}</th>
                    <th>{t('streams.colNote')}</th>
                    <th>タグ</th>
                    <th>{t('streams.colArtist')}</th>
                    {showCollab && <th>{t('streams.colCollab')}</th>}
                    <th>{t('streams.colUrl')}</th>
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
                        style={hitTitle || hitArtist ? { backgroundColor: 'rgba(172,208,209,0.18)' } : undefined}
                      >
                        <td>{r.no}</td>
                        <td style={hitTitle ? { fontWeight: 600, color: '#3a7a7b' } : undefined}>
                          {r.isFirst && <span className="mk-first">{t('streams.firstBadge')}</span>}
                          {title}
                        </td>
                        <td style={{ color: '#aaaaaa', fontSize: 12 }}>{r.perf.note}</td>
                        <td style={{ fontSize: 12 }}>
                          {r.perf.tags.map((id) => (
                            <span key={id} className="mk-tag">
                              {db.tagById.get(id)?.label ?? id}
                            </span>
                          ))}
                        </td>
                        <td style={{ color: hitArtist ? '#3a7a7b' : '#888888', fontWeight: hitArtist ? 600 : undefined }}>
                          {artist}
                        </td>
                        {showCollab && <td style={{ color: '#888888' }}>{r.perf.collab.join(' / ')}</td>}
                        <td>
                          <a
                            href={watchUrl(frame.video_id, r.perf.start_sec)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#5a7fa8' }}
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
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── Repertoire */

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

/** カードの3行目以降。登録が無くても見出しの語は残し、カードの高さを揃える */
function creditLines(song: Song): string[] {
  return [
    ['作詞', song.lyricists],
    ['作曲', song.composers],
    ['編曲', song.arrangers],
  ].map(([label, names]) => `${label}　${(names as string[]).join(' / ')}`)
}

function Repertoire({ db, perfs, t }: { db: Db; perfs: Performance[]; t: T }) {
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
    <section className="section" id="repertoire">
      <div className="section__inner">
        <SectionHead title="Repertoire" sub={`${stats.length}曲`} />

        <div className="mk-search mk-search--wide">
          <span className="mk-search__icon" aria-hidden>
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
          <h3 style={{ margin: 0 }}>{t('songs.rankingTitle')}</h3>
          <SortToggle value={sort} onChange={setSort} />
          <YearPicker years={pickableYears} value={year} onChange={setYear} />
        </div>
        <RankCards items={ranking} paged columns={2} rows={5} />

        <div className="section-head">
          <h3 style={{ margin: 0 }}>{t('songs.yearTitle')}</h3>
          <HighlightNote />
        </div>
        <RankCards items={markTopHalf(years)} paged columns={3} rows={10} />

        <div className="section-head">
          <h3 style={{ margin: 0 }}>{t('songs.artistTitle')}</h3>
          <HighlightNote />
        </div>
        <RankCards items={markTopHalf(artists)} paged columns={3} rows={10} />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── About / Links */

function About() {
  return (
    <section className="section" id="about">
      <div className="section__inner">
        <SectionHead title="About" sub="このサイトについて" />
        <Reveal>
          <AboutText singer="深影" />
        </Reveal>
      </div>
    </section>
  )
}

function Links() {
  return (
    <section className="section" id="links">
      <div className="section__inner">
        <SectionHead title="Links" sub="公式リンク" />
        <Reveal>
          <ul className="link-list">
            <li>
              <a href={CHANNEL} target="_blank" rel="noopener noreferrer">
                YouTube
                <small>@Mikage_RKMusic</small>
              </a>
            </li>
            <li>
              <a href="https://x.com/Mikage_0916" target="_blank" rel="noopener noreferrer">
                X
                <small>@Mikage_0916</small>
              </a>
            </li>
          </ul>
        </Reveal>
      </div>
    </section>
  )
}
