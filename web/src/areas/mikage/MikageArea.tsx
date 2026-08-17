import { useEffect, useMemo, useState } from 'react'
import type { Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, watchUrl } from '../../data'
import { Link } from '../../router'
import RankCards, { type RankItem } from '../../components/RankCards'
import { LANGS, storedLang, translator } from './i18n'
import './mikage.css'

type Tab = 'streams' | 'songs' | 'about' | 'changelog'
type T = ReturnType<typeof translator>

const BG = `${import.meta.env.BASE_URL}mikage/background_0.png`

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
  const [tab, setTab] = useState<Tab>('streams')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [lang, setLang] = useState(storedLang)
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

  const nav = (key: Tab) => {
    setTab(key)
    setSidebarOpen(false)
  }

  return (
    <div className="mikage-root" style={{ backgroundImage: `url(${BG})`, backgroundRepeat: 'repeat' }}>
      <div className="lang-selector-topright">
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
      </div>

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
          {(['streams', 'songs', 'about', 'changelog'] as Tab[]).map((key) => (
            <button
              key={key}
              className={`sidebar-nav-btn${tab === key ? ' active' : ''}`}
              onClick={() => nav(key)}
            >
              <span className="sidebar-nav-text">{t(`tab.${key}`)}</span>
            </button>
          ))}
          <Link to="/" className="sidebar-nav-btn">
            <span className="sidebar-nav-text">home</span>
          </Link>
        </nav>
      </aside>

      <div className={`main-wrapper${sidebarOpen ? ' sidebar-open' : ''}`}>
        <div className="content">
          {tab === 'streams' && <Streams db={db} frames={frames} rowsByFrame={rowsByFrame} t={t} />}
          {tab === 'songs' && <Songs db={db} perfs={perfs} t={t} />}
          {tab === 'about' && <About t={t} />}
          {tab === 'changelog' && <Changelog t={t} />}
        </div>
        <Footer />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── 歌枠 */

function Streams({
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

  const trimmed = query.trim()
  const searching = trimmed.length > 0
  const q = trimmed.toLowerCase()

  const shown = searching
    ? frames.filter((f) => (rowsByFrame.get(f.frame_id) ?? []).some((r) => hits(r, q)))
    : frames

  return (
    <div style={{ paddingTop: 35 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <div className="mk-search">
          <span aria-hidden>🔍</span>
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
            {t('streams.searchHits', { count: shown.length })}
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

      {searching && shown.length === 0 && (
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

      <div style={{ maxHeight: isOpen ? 1000 : 0, overflow: 'hidden', transition: 'max-height 0.35s ease' }}>
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

            <div className="setlist-card-list">
              {rows.map((r) => (
                <div key={r.perf.start_sec} className="setlist-card">
                  <div className="setlist-card-row1">
                    <span className="setlist-card-no">{r.no}</span>
                    <span className="setlist-card-title">
                      {r.isFirst && <span className="setlist-card-first-badge">{t('streams.firstBadge')}</span>}
                      {r.song?.title ?? ''}
                      {r.song?.artist && <span className="setlist-card-artist"> / {r.song.artist}</span>}
                    </span>
                    <a
                      href={watchUrl(frame.video_id, r.perf.start_sec)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="setlist-card-link"
                    >
                      ▶
                    </a>
                  </div>
                  {(r.perf.note || r.perf.tags.length > 0) && (
                    <div className="setlist-card-row2">
                      {r.perf.note && (
                        <span>
                          <span className="setlist-card-meta-label">{t('streams.colNote')}</span>
                          {r.perf.note}
                        </span>
                      )}
                      {r.perf.tags.map((id) => (
                        <span key={id}>{db.tagById.get(id)?.label ?? id}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── 楽曲 */

function Songs({ db, perfs, t }: { db: Db; perfs: Performance[]; t: T }) {
  const [query, setQuery] = useState('')

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

  return (
    <div style={{ paddingTop: 35 }}>
      <div className="mk-search mk-search--wide">
        <span aria-hidden>&#128269;</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="曲名・アーティストで絞り込み"
          className={q ? 'searching' : ''}
        />
      </div>

      <Charts
        stats={filtered}
        titles={{
          ranking: t('songs.rankingTitle'),
          year: t('songs.yearTitle'),
          artist: t('songs.artistTitle'),
        }}
      />
    </div>
  )
}

/* ─────────────────────────────────────────── About / Changelog */

function About({ t }: { t: T }) {
  return (
    <div style={{ paddingTop: 35, maxWidth: 760 }}>
      <h3>{t('tab.about')}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.9 }}>
        VSinger 深影さんの歌枠のセットリストを記録した、非公式のファンメイドデータベースです。
        公式のものではなく、深影さんおよびRK Musicとは関係ありません。
      </p>
      <p style={{ fontSize: 15, lineHeight: 1.9 }}>
        データは <code>uta-waku archive</code> の統合データベースから読み込んでいます。
      </p>
    </div>
  )
}

function Changelog({ t }: { t: T }) {
  return (
    <div style={{ paddingTop: 35, maxWidth: 760 }}>
      <h3>{t('tab.changelog')}</h3>
      <p style={{ fontSize: 15, lineHeight: 1.9 }}>
        統合データベース <code>uta-waku archive</code> へ移行しました。
      </p>
    </div>
  )
}

function Footer() {
  useEffect(() => {}, [])
  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#acd0d1',
        borderTop: '1px solid #8ab8b9',
        fontSize: 13,
        color: 'rgb(40, 40, 40)',
        letterSpacing: '0.06em',
        fontFamily: '"Noto Sans JP", sans-serif',
        zIndex: 200,
      }}
    >
      <span className="footer-full">
        © 2026{' '}
        <a
          href="https://x.com/WL_GE_inn"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgb(40, 40, 40)', textDecoration: 'none' }}
        >
          金鷲亭
        </a>
        　|　非公式ファンサイト — 深影（Mikage / RK Music）　|　掲載情報の誤りは{' '}
        <a
          href="https://x.com/WL_GE_inn"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'rgb(40, 40, 40)', textDecoration: 'none' }}
        >
          @WL_GE_inn
        </a>{' '}
        までお気軽にどうぞ
      </span>
      <span className="footer-short">© 2026 金鷲亭　|　深影（Mikage / RK Music）非公式ファンサイト</span>

      <div className="footer-icons">
        <a
          href="https://www.youtube.com/@Mikage_RKMusic"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-icon-link"
          aria-label="YouTube"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.55 3.5 12 3.5 12 3.5s-7.55 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.03 0 12 0 12s0 3.97.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.45 20.5 12 20.5 12 20.5s7.55 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.97 24 12 24 12s0-3.97-.5-5.81zM9.75 15.52V8.48L15.5 12l-5.75 3.52z" />
          </svg>
        </a>
        <a
          href="https://x.com/Mikage_0916"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-icon-link"
          aria-label="X (Twitter)"
        >
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
          </svg>
        </a>
      </div>
    </footer>
  )
}

/* 現行サイトと同じ3つのグラフ。集計は歌唱データから作る。 */
/* 現行サイトのグラフに相当する集計。Plotlyを使わず順位カードで出す。 */
function Charts({
  stats,
  titles,
}: {
  stats: { song: Song; count: number }[]
  titles: { ranking: string; year: string; artist: string }
}) {
  const [sort, setSort] = useState<SongSort>('count-desc')

  const ranking: RankItem[] = sortSongs(stats, sort).map((s, i) => ({
    key: s.song.song_id,
    rank: i + 1,
    title: s.song.title,
    sub: s.song.artist,
    meta: songMeta(s.song),
    value: s.count,
    unit: '回',
  }))

  const yearMap = new Map<string, number>()
  for (const s of stats) {
    const year = (s.song.released || '').slice(0, 4)
    if (/^\d{4}$/.test(year)) yearMap.set(year, (yearMap.get(year) ?? 0) + 1)
  }
  const yearTotal = [...yearMap.values()].reduce((a, b) => a + b, 0)
  const years: RankItem[] = [...yearMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([year, n], i) => ({
      key: year,
      rank: i + 1,
      title: year + '年',
      value: n,
      unit: '曲',
      ratio: yearTotal ? n / yearTotal : 0,
    }))

  const artistMap = new Map<string, number>()
  for (const s of stats) {
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
    <>
      <div className="section-head">
        <h3 style={{ margin: 0 }}>{titles.ranking}</h3>
        <SortSelect value={sort} onChange={setSort} />
      </div>
      <RankCards items={ranking} paged />

      <h3 style={{ margin: '24px 0 8px' }}>{titles.year}</h3>
      <RankCards items={years} paged />

      <h3 style={{ margin: '24px 0 8px' }}>{titles.artist}</h3>
      <RankCards items={artists} paged />
    </>
  )
}

/** カード3行目の補足。作詞・作曲・編曲とリリース日をまとめる */
function songMeta(song: Song): string {
  const credit = (label: string, names: string[]) =>
    names.length ? `${label} ${names.join(' / ')}` : ''
  const parts = [
    credit('作詞', song.lyricists),
    credit('作曲', song.composers),
    credit('編曲', song.arrangers),
  ].filter(Boolean)
  if (song.released) parts.push(song.released)
  return parts.join('　')
}

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

function SortSelect({ value, onChange }: { value: SongSort; onChange: (v: SongSort) => void }) {
  return (
    <select
      className="sort-select"
      value={value}
      onChange={(e) => onChange(e.target.value as SongSort)}
      aria-label="並べ替え"
    >
      {SORT_LABELS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
