import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChannelVideo, Db, Frame, Performance, Song } from '../../types'
import { hms, jstDate, loadVideos, watchUrl } from '../../data'
import { Link } from '../../router'
import { Reveal, SectionHead, useCountUp, useInView } from '../../components/Reveal'
import AboutText from '../../components/AboutText'
import { useSmoothScroll } from '../../components/useSmoothScroll'
import { NagiCityscape, VIEW_H } from './cityscape'
import { StarfieldSky } from './starfield'
import { ShootingStars } from './meteors'
import './nagi.css'

const ASSET = (name: string) => `${import.meta.env.BASE_URL}nagi/${name}`

const SITE = {
  nameRomaji: 'MINASE NAGI',
  leadParts: ['非公式データベース', 'セトリ＆楽曲情報まとめ'],
  links: [{ label: 'YouTube', url: 'https://www.youtube.com/channel/UCAplyWK80Y6_YTkb3CCDk1Q' }],
}

const NAV = [
  { id: 'latest', label: 'LATEST' },
  { id: 'numbers', label: 'NUMBERS' },
  { id: 'setlist', label: 'SETLIST' },
  { id: 'repertoire', label: 'REPERTOIRE' },
  { id: 'about', label: 'ABOUT' },
  { id: 'links', label: 'LINKS' },
]

/** 街並みの描画倍率。固定フッターの高さもこれで決まる */
const CITY_SCALE = 0.5
const FOOTER_H = Math.round(VIEW_H * CITY_SCALE)

type Row = { no: number; song: Song | undefined; perf: Performance; isFirst: boolean }
type Stream = { frame: Frame; rows: Row[] }
/** lastAt は直近に歌った枠の started_at。未設定の枠しか無ければ空 */
type SongStat = { song: Song; count: number; lastAt: string }

export default function NagiArea({
  db,
  frames,
  perfs,
}: {
  db: Db
  frames: Frame[]
  perfs: Performance[]
}) {
  // 流星群は既定でOFF。ヘッダーのトグルで切り替える
  const [meteorsOn, setMeteorsOn] = useState(false)
  const [videos, setVideos] = useState<ChannelVideo[]>([])

  useEffect(() => {
    loadVideos('nagi').then(setVideos)
  }, [])

  useSmoothScroll(62)

  const streams: Stream[] = useMemo(() => {
    const at = new Map(frames.map((f) => [f.frame_id, f.started_at]))
    const first = new Map<string, string>()
    for (const p of [...perfs].sort(
      (a, b) =>
        (at.get(a.frame_id) ?? '').localeCompare(at.get(b.frame_id) ?? '') ||
        a.start_sec - b.start_sec,
    )) {
      if (p.song_id && !first.has(p.song_id)) first.set(p.song_id, `${p.frame_id}|${p.start_sec}`)
    }
    return frames.map((f) => ({
      frame: f,
      rows: perfs
        .filter((p) => p.frame_id === f.frame_id)
        .sort((a, b) => a.start_sec - b.start_sec)
        .map((p, i) => ({
          no: i + 1,
          song: db.songById.get(p.song_id),
          perf: p,
          isFirst: first.get(p.song_id) === `${p.frame_id}|${p.start_sec}`,
        })),
    }))
  }, [db, frames, perfs])

  const stats = useMemo(() => {
    const at = new Map(frames.map((f) => [f.frame_id, f.started_at ?? '']))
    const counts = new Map<string, number>()
    // 直近に歌った日。楽曲一覧を新しい順に並べるために持つ
    const last = new Map<string, string>()
    for (const p of perfs) {
      counts.set(p.song_id, (counts.get(p.song_id) ?? 0) + 1)
      const t = at.get(p.frame_id) ?? ''
      if (t > (last.get(p.song_id) ?? '')) last.set(p.song_id, t)
    }
    const list: SongStat[] = []
    for (const [id, count] of counts) {
      const song = db.songById.get(id)
      if (song) list.push({ song, count, lastAt: last.get(id) ?? '' })
    }
    return list.sort((a, b) => b.count - a.count || a.song.title.localeCompare(b.song.title, 'ja'))
  }, [perfs, frames, db])

  const artistCount = new Set(
    perfs
      .map((p) => db.songById.get(p.song_id)?.artist?.trim())
      .filter((a): a is string => !!a),
  ).size
  const streamByVideoId = new Map(streams.map((s) => [s.frame.video_id, s]))

  return (
    <div className="nagi-root">
      <div className="page-sky">
        <StarfieldSky seed={20260819} speed={6} angle={34} />
      </div>
      {meteorsOn && <ShootingStars />}

      <header className="site-header">
        {/* 狭い画面では2段に折る。姓と名で割り、DBは下段の末尾へ付ける */}
        <a className="site-header__logo" href="#top">
          <span>{SITE.nameRomaji.split(' ')[0]}</span>
          <span>
            {SITE.nameRomaji.split(' ').slice(1).join(' ')} <em>DB</em>
          </span>
        </a>
        <HeaderNav />
        <button
          type="button"
          className={`meteor-toggle ${meteorsOn ? 'is-on' : ''}`}
          onClick={() => setMeteorsOn((v) => !v)}
          aria-pressed={meteorsOn}
        >
          流星群
          <span className="meteor-toggle__state">{meteorsOn ? 'ON' : 'OFF'}</span>
        </button>
      </header>

      <div className="page">
        <Hero />
        <LatestStreams videos={videos} streams={streams} streamByVideoId={streamByVideoId} />
        <PickUp streams={streams} />
        <Numbers
          streamCount={streams.length}
          perfCount={perfs.length}
          repertoire={stats.length}
          artistCount={artistCount}
        />
        <Setlist streams={streams} db={db} />
        <Repertoire stats={stats} />
        <About />
        <Links />

        <div className="site-note">
          <strong>Unofficial - MINASE NAGI DB</strong>
          <span>ただのファンによる非公式DBであり、ご本人とは一切関係ありません。</span>
        </div>
      </div>

      <div className="city-fixed" style={{ height: FOOTER_H }}>
        <NagiCityscape scale={CITY_SCALE} speed={10} districtScale={0.8} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────── ヘッダーの導線 */

/**
 * 画面が狭いと項目が収まりきらず横へ送ることになる。
 * 送り先にまだ項目があることが判るよう、隠れている側へ矢印を出す。
 */
function HeaderNav() {
  const ref = useRef<HTMLElement>(null)
  const [more, setMore] = useState({ left: false, right: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      // 端の判定は小数の誤差が出るので1pxの余裕を持たせる
      const left = el.scrollLeft > 1
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      setMore((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    // 書体が届くと項目の幅が変わる
    document.fonts?.ready.then(update).catch(() => {})
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="site-header__navwrap">
      <nav className="site-header__nav" ref={ref}>
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`}>
            {n.label}
          </a>
        ))}
        <Link to="/">HOME</Link>
      </nav>
      {more.left && (
        <span className="site-header__more site-header__more--left" aria-hidden="true">
          ◀
        </span>
      )}
      {more.right && (
        <span className="site-header__more site-header__more--right" aria-hidden="true">
          ▶
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────── Hero */

function Hero() {
  const romaji = SITE.nameRomaji
  return (
    <section className="hero" id="top">
      <div className="hero__inner">
        <p className="hero__unofficial">UNOFFICIAL SETLIST DATABASE</p>

        {/* 日本語名の2×2ブロック幅に、ローマ字を均等割り付けする */}
        <div className="hero__name-block">
          <h1 className="hero__name">
            <span>水瀬</span>
            <span>
              <em>凪</em>
            </span>
            <img
              className="hero__dbname hero__dbname--img"
              src={ASSET('mizunagi_onko_mini.png')}
              alt="水凪音庫"
            />
          </h1>
          <p className="hero__romaji" aria-label={romaji}>
            {romaji.split('').map((ch, i) =>
              ch === ' ' ? (
                <span key={i} className="hero__romaji-gap" aria-hidden="true" />
              ) : (
                <span key={i} aria-hidden="true">
                  {ch}
                </span>
              ),
            )}
          </p>
        </div>

        <p className="hero__lead">
          <span>{SITE.leadParts[0]}</span>
          <span className="hero__lead-sep">、</span>
          <span>{SITE.leadParts[1]}</span>
        </p>
        <p className="hero__scroll">SCROLL</p>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── 動画カード */

const TYPE_LABEL: Record<string, string> = {
  LiveArchive: 'LIVE',
  Movie: 'VIDEO',
  Short: 'SHORT',
}

function VideoCard({
  title,
  date,
  url,
  thumbnail,
  songCount,
  firstCount,
  type,
}: {
  title: string
  date: string
  url: string
  thumbnail: string | null
  /** セトリ登録済みの枠のみ渡す。未登録の動画では出さない */
  songCount?: number
  firstCount?: number
  type?: string
}) {
  const inner = (
    <div className="card stream-card">
      <div className="thumb-wrap">
        {thumbnail ? (
          <img className="thumb" src={thumbnail} alt="" loading="lazy" />
        ) : (
          <div className="thumb thumb--empty">NO THUMBNAIL</div>
        )}
        {url && (
          <span className="play-badge" aria-hidden="true">
            <span className="play-badge__icon" />
          </span>
        )}
        {type && TYPE_LABEL[type] && <span className="type-tag">{TYPE_LABEL[type]}</span>}
      </div>
      <div className="stream-card__body">
        <div className="stream-card__date">{date}</div>
        <div className="stream-card__title">{title}</div>
        <div className="stream-card__meta">
          {songCount === undefined ? (
            <span className="stream-card__unlisted">セトリ未登録</span>
          ) : (
            <>
              {songCount} 曲
              {!!firstCount && (
                <>
                  {' ・ '}
                  <span className="badge">初歌唱 {firstCount}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
  if (!url) return inner
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      {inner}
    </a>
  )
}

/* ─────────────────────────────────────────── Latest */

function LatestStreams({
  videos,
  streams,
  streamByVideoId,
}: {
  videos: ChannelVideo[]
  streams: Stream[]
  streamByVideoId: Map<string, Stream>
}) {
  const hasVideos = videos.length > 0
  const items = hasVideos
    ? videos.slice(0, 12).map((v) => {
        const s = streamByVideoId.get(v.video_id)
        return {
          key: v.video_id,
          title: v.title,
          date: jstDate(v.published_at),
          url: watchUrl(v.video_id),
          thumbnail: `https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`,
          type: v.type,
          songCount: s ? s.rows.length : undefined,
          firstCount: s ? s.rows.filter((r) => r.isFirst).length : undefined,
        }
      })
    : streams.slice(0, 12).map((s) => ({
        key: s.frame.frame_id,
        title: s.frame.title,
        date: jstDate(s.frame.started_at),
        url: watchUrl(s.frame.video_id),
        thumbnail: `https://i.ytimg.com/vi/${s.frame.video_id}/hqdefault.jpg`,
        type: s.frame.type ?? undefined,
        songCount: s.rows.length,
        firstCount: s.rows.filter((r) => r.isFirst).length,
      }))

  return (
    <section className="section" id="latest">
      <div className="section__inner">
        <SectionHead title="Latest" sub={hasVideos ? 'チャンネルの最新投稿' : '直近の歌枠'} />
        {items.length === 0 ? (
          <Reveal>
            <div className="empty-note">まだデータが登録されていません。</div>
          </Reveal>
        ) : (
          <Reveal>
            <div className="rail fancy-scroll">
              {items.map(({ key, ...card }) => (
                <VideoCard key={key} {...card} />
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── Pick Up */

/** 初歌唱を多く含む枠を「見どころ」として3件拾う */
function PickUp({ streams }: { streams: Stream[] }) {
  const picks = [...streams]
    .map((s) => ({ s, n: s.rows.filter((r) => r.isFirst).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n || b.s.frame.started_at.localeCompare(a.s.frame.started_at))
    .slice(0, 3)

  if (picks.length === 0) return null

  return (
    <section className="section" id="pickup">
      <div className="section__inner">
        <SectionHead title="Pick Up" sub="初歌唱が多く収録された枠" />
        <div className="grid-3">
          {picks.map(({ s, n }, i) => (
            <Reveal key={s.frame.frame_id} delay={i * 90}>
              <VideoCard
                title={s.frame.title}
                date={jstDate(s.frame.started_at)}
                url={watchUrl(s.frame.video_id)}
                thumbnail={`https://i.ytimg.com/vi/${s.frame.video_id}/hqdefault.jpg`}
                songCount={s.rows.length}
                firstCount={n}
              />
            </Reveal>
          ))}
        </div>
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
  streamCount,
  perfCount,
  repertoire,
  artistCount,
}: {
  streamCount: number
  perfCount: number
  repertoire: number
  artistCount: number
}) {
  return (
    <section className="section" id="numbers">
      <div className="section__inner">
        <SectionHead title="Numbers" sub="収録データの規模" />
        <div className="numbers">
          <NumberCell value={streamCount} label="STREAMS" unit="枠" delay={0} />
          <NumberCell value={perfCount} label="PERFORMANCES" unit="回" delay={80} />
          <NumberCell value={repertoire} label="REPERTOIRE" unit="曲" delay={160} />
          <NumberCell value={artistCount} label="ARTISTS" unit="" delay={240} />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── Setlist */

/** 1ページに載せる曲数。表示領域の高さもこの曲数に合わせている */
const SETLIST_PER_PAGE = 7

function Pager({
  page,
  total,
  onChange,
}: {
  page: number
  total: number
  onChange: (p: number) => void
}) {
  if (total <= 1) return null
  return (
    <div className="pager">
      <button
        type="button"
        className="pager__btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="前のページ"
      >
        <span aria-hidden="true">◀</span>
      </button>
      <span className="pager__count">
        <strong>{page}</strong> / {total}
      </span>
      <button
        type="button"
        className="pager__btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= total}
        aria-label="次のページ"
      >
        <span aria-hidden="true">▶</span>
      </button>
    </div>
  )
}

function Setlist({ streams, db }: { streams: Stream[]; db: Db }) {
  const [selected, setSelected] = useState(0)
  const [page, setPage] = useState(1)
  const current = streams[selected]

  // 枠を切り替えたら1ページ目に戻す
  const selectStream = (i: number) => {
    setSelected(i)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil((current?.rows.length ?? 0) / SETLIST_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * SETLIST_PER_PAGE
  const shown = current ? current.rows.slice(start, start + SETLIST_PER_PAGE) : []

  return (
    <section className="section" id="setlist">
      <div className="section__inner">
        <SectionHead title="Setlist" sub="枠ごとの歌唱記録" />

        {streams.length === 0 ? (
          <Reveal>
            <div className="empty-note">歌枠データはまだ登録されていません。</div>
          </Reveal>
        ) : (
          <Reveal>
            <div className="setlist">
              {/* 枠の一覧は右の曲表と同じ高さに収める。溢れたぶんは中で送る。
                  外枠を基準にして中身を絶対配置しないと、件数だけ縦に伸びてしまう */}
              <div className="setlist__list-frame">
                <div className="setlist__list fancy-scroll">
                  {streams.map((s, i) => (
                    <button
                      key={s.frame.frame_id}
                      className={`setlist__item ${i === selected ? 'is-active' : ''}`}
                      onClick={() => selectStream(i)}
                    >
                      <div className="setlist__item-date">
                        {jstDate(s.frame.started_at)} ・ {s.rows.length}曲
                      </div>
                      <div className="setlist__item-title">{s.frame.title}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="setlist__detail">
                {current && (
                  <>
                    <div className="setlist__detail-head">
                      <img
                        className="thumb"
                        src={`https://i.ytimg.com/vi/${current.frame.video_id}/hqdefault.jpg`}
                        alt=""
                        loading="lazy"
                      />
                      <div>
                        <h3 className="setlist__detail-title">{current.frame.title}</h3>
                        <div className="stream-card__meta">
                          {jstDate(current.frame.started_at)} ・ {current.rows.length}曲
                        </div>
                        <a
                          className="songs__link"
                          href={watchUrl(current.frame.video_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          YouTube で開く →
                        </a>
                      </div>
                    </div>

                    <div className="songs-wrap">
                      <table className="songs">
                        <thead>
                          <tr>
                            <th className="songs__no">NO</th>
                            <th>SONG</th>
                            <th className="songs__time">TIME</th>
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((r) => (
                            <tr key={r.perf.start_sec}>
                              <td className="songs__no">{r.no}</td>
                              <td>
                                <div className="songs__title">
                                  {r.song?.title ?? ''}{' '}
                                  {r.isFirst && <span className="badge">初歌唱</span>}
                                  {r.perf.tags.map((id) => (
                                    <span key={id} className="badge">
                                      {db.tagById.get(id)?.label ?? id}
                                    </span>
                                  ))}
                                </div>
                                <div className="songs__artist">
                                  {r.song?.artist ?? ''}
                                  {r.perf.note && ` ／ ${r.perf.note}`}
                                </div>
                              </td>
                              <td className="songs__time">
                                {/* 時間と▶をひとつのリンクにまとめ、どちらを押しても頭出しできるようにする */}
                                <a
                                  className="songs__play"
                                  href={watchUrl(current.frame.video_id, r.perf.start_sec)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <span className="songs__play-time">{hms(r.perf.start_sec)}</span>
                                  <span className="songs__play-btn" aria-hidden="true" />
                                </a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* 狭幅ではカード表示に切り替わる。1曲1行に収め、行ごと押せるようにする */}
                      <div className="songs-cards">
                        {shown.map((r) => (
                          <a
                            className="song-card"
                            key={`c_${r.perf.start_sec}`}
                            href={watchUrl(current.frame.video_id, r.perf.start_sec)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <span className="song-card__no">{r.no}</span>
                            <span className="song-card__body">
                              <span className="song-card__title">{r.song?.title ?? ''}</span>
                              <span className="song-card__meta">{r.song?.artist ?? ''}</span>
                            </span>
                            {r.isFirst && <span className="badge badge--tiny">初</span>}
                            <span className="song-card__time">{hms(r.perf.start_sec)}</span>
                          </a>
                        ))}
                      </div>
                    </div>

                    <Pager page={safePage} total={totalPages} onChange={setPage} />
                  </>
                )}
              </div>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────── Repertoire */

// 外側のタブで「何を数えるか」を選び、右のボタンで「どう束ねるか」を選ぶ
type Tab = 'list' | 'ranking' | 'count'

const TABS: { id: Tab; label: string }[] = [
  { id: 'list', label: '楽曲一覧' },
  { id: 'ranking', label: '歌唱回数' },
  { id: 'count', label: '曲数' },
]

/** 歌唱回数タブの束ね方 */
type RankBy = 'song' | 'artist' | 'year'

const RANK_BYS: { id: RankBy; label: string }[] = [
  { id: 'song', label: '楽曲' },
  { id: 'artist', label: '原曲アーティスト' },
  { id: 'year', label: 'リリース年' },
]

/** 曲数タブの束ね方。楽曲で束ねても常に1曲なので、この2つだけ */
type CountBy = 'artist' | 'year'

const COUNT_BYS: { id: CountBy; label: string }[] = [
  { id: 'artist', label: '原曲アーティスト' },
  { id: 'year', label: 'リリース年' },
]

const REP_PER_PAGE = 10

type CardItem = {
  key: string
  /** 省略すると順位バッジを出さない */
  rank?: number
  title: string
  /** 曲名の右へ添える一言。省略すると出さない */
  titleNote?: string
  sub?: string
  value: number
  unit: string
  /** 全体に占める割合。省略すると出さない */
  share?: number
  /** 上位の常連として目立たせるか */
  core?: boolean
}

/**
 * まとめたグループに、全体に占める割合と「上から半数ぶん」の印を付ける。
 * 上から曲数を足していき、半数に届くまでを常連とみなす。届かせた1組も含める。
 * 同数が続く位置に境目が来ると、並び順で分かれる。
 */
function withShare<T extends { songs: string[] }>(
  groups: T[],
): (T & { share: number; core: boolean })[] {
  const total = groups.reduce((n, g) => n + g.songs.length, 0)
  let stacked = 0
  return groups.map((g) => {
    const core = stacked < total / 2
    stacked += g.songs.length
    return { ...g, share: total ? (g.songs.length / total) * 100 : 0, core }
  })
}

/** plays はそのまとまりを歌った延べ回数。songs は曲の種類 */
type Group = { label: string; songs: string[]; plays: number }

/** キーごとに楽曲をまとめ、曲数の多い順に返す。同数のときは第2キーで安定させる */
function groupSongs(
  stats: { song: Song; count: number }[],
  key: (s: Song) => string,
  tieBreak: (a: string, b: string) => number,
): Group[] {
  const map = new Map<string, Group>()
  for (const s of stats) {
    const k = key(s.song)
    if (!k) continue
    const g = map.get(k)
    if (g) {
      g.songs.push(s.song.title)
      g.plays += s.count
    } else {
      map.set(k, { label: k, songs: [s.song.title], plays: s.count })
    }
  }
  return [...map.values()].sort(
    (a, b) => b.songs.length - a.songs.length || tieBreak(a.label, b.label),
  )
}

/** 歌った回数の多い順に並べ替える。同数のときは曲数の多いほうを先に */
function byPlays(groups: Group[], tieBreak: (a: string, b: string) => number): Group[] {
  return [...groups].sort(
    (a, b) => b.plays - a.plays || b.songs.length - a.songs.length || tieBreak(a.label, b.label),
  )
}

/** カード2行目に載せる曲名。多いときは先頭3曲＋残数 */
function summarize(songs: string[]): string {
  return songs.length <= 3
    ? songs.join(' ・ ')
    : `${songs.slice(0, 3).join(' ・ ')} 他${songs.length - 3}曲`
}

function Cards({ items }: { items: CardItem[] }) {
  if (items.length === 0) {
    return <div className="empty-note">該当するデータがありません。</div>
  }
  return (
    <div className="rank-grid">
      {items.map((item) => (
        <div
          className={[
            'rank-card',
            item.rank !== undefined && item.rank <= 3 ? 'rank-card--top' : '',
            item.core ? 'rank-card--core' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          key={item.key}
        >
          {item.rank !== undefined && <span className="rank-card__no">{item.rank}</span>}
          <div className="rank-card__body">
            <div className="rank-card__title">
              {item.title}
              {item.titleNote && (
                <span className="rank-card__note">{item.titleNote}</span>
              )}
            </div>
            {item.sub && <div className="rank-card__sub">{item.sub}</div>}
          </div>
          <div className="rank-card__value">
            {item.value}
            <span>{item.unit}</span>
            {item.share !== undefined && (
              <span className="rank-card__share">（{item.share.toFixed(1)}%）</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function Repertoire({ stats }: { stats: SongStat[] }) {
  const [tab, setTab] = useState<Tab>('list')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  // 楽曲一覧は歌唱回数のタブと役割を分ける。歌った日の新しい順が既定
  const [order, setOrder] = useState<'new' | 'old'>('new')
  // 歌唱回数は同じ「回数」を、楽曲・原曲アーティスト・リリース年のどれで束ねるか選ぶ
  const [rankBy, setRankBy] = useState<RankBy>('song')
  const [countBy, setCountBy] = useState<CountBy>('artist')

  const changeTab = (t: Tab) => {
    setTab(t)
    setPage(1)
  }
  const changeQuery = (q: string) => {
    setQuery(q)
    setPage(1)
  }
  const changeOrder = (o: 'new' | 'old') => {
    setOrder(o)
    setPage(1)
  }
  const changeRankBy = (b: RankBy) => {
    setRankBy(b)
    setPage(1)
  }
  const changeCountBy = (b: CountBy) => {
    setCountBy(b)
    setPage(1)
  }

  const songList = useMemo<CardItem[]>(() => {
    const q = query.trim().toLowerCase()
    const rows = q
      ? stats.filter(
          (s) =>
            s.song.title.toLowerCase().includes(q) || s.song.artist.toLowerCase().includes(q),
        )
      : stats
    // 歌った日が判らない曲は、どちらの向きでも最後に置く
    const dir = order === 'new' ? -1 : 1
    const sorted = [...rows].sort((a, b) => {
      if (!a.lastAt !== !b.lastAt) return a.lastAt ? -1 : 1
      return (
        a.lastAt.localeCompare(b.lastAt) * dir ||
        a.song.title.localeCompare(b.song.title, 'ja')
      )
    })
    return sorted.map((s) => ({
      key: s.song.song_id,
      title: s.song.title,
      // 並びの基準になる日。曲名のすぐ右に出す
      titleNote: s.lastAt ? `配信日：${jstDate(s.lastAt)}` : '配信日：不明',
      sub: [s.song.artist, s.song.released && `${s.song.released.slice(0, 4)}年`]
        .filter(Boolean)
        .join(' ・ '),
      value: s.count,
      unit: '回',
    }))
  }, [stats, query, order])

  // 歌唱回数。数えるものは常に延べ回数で、束ね方だけを切り替える
  const ranking = useMemo<CardItem[]>(() => {
    if (rankBy === 'song') {
      return stats.map((s, i) => ({
        key: s.song.song_id,
        rank: i + 1,
        title: s.song.title,
        sub: s.song.artist,
        value: s.count,
        unit: '回',
      }))
    }
    const groups =
      rankBy === 'artist'
        ? byPlays(
            groupSongs(stats, (s) => s.artist, (a, b) => a.localeCompare(b, 'ja')),
            (a, b) => a.localeCompare(b, 'ja'),
          )
        : byPlays(
            groupSongs(stats, (s) => s.released.slice(0, 4), (a, b) => b.localeCompare(a)),
            (a, b) => b.localeCompare(a),
          )
    return groups.map((g, i) => ({
      key: g.label,
      rank: i + 1,
      title: rankBy === 'year' ? `${g.label}年` : g.label,
      titleNote: `${g.songs.length}曲`,
      sub: summarize(g.songs),
      value: g.plays,
      unit: '回',
    }))
  }, [stats, rankBy])

  // 曲数。数えるものは常に曲の種類で、束ね方だけを切り替える。
  // 分母は束ねる値の判っている曲だけなので、割合の合計は100%になる
  const counting = useMemo<CardItem[]>(() => {
    const groups =
      countBy === 'artist'
        ? groupSongs(stats, (s) => s.artist, (a, b) => a.localeCompare(b, 'ja'))
        : // 曲数の多い年から並べる。同数なら新しい年を先に
          groupSongs(stats, (s) => s.released.slice(0, 4), (a, b) => b.localeCompare(a))
    return withShare(groups).map((g, i) => ({
      key: g.label,
      rank: i + 1,
      title: countBy === 'year' ? `${g.label}年` : g.label,
      titleNote: `${g.plays}回`,
      sub: summarize(g.songs),
      value: g.songs.length,
      unit: '曲',
      share: g.share,
      core: g.core,
    }))
  }, [stats, countBy])

  const items = tab === 'list' ? songList : tab === 'ranking' ? ranking : counting

  const totalPages = Math.max(1, Math.ceil(items.length / REP_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const shown = items.slice((safePage - 1) * REP_PER_PAGE, safePage * REP_PER_PAGE)

  return (
    <section className="section" id="repertoire">
      <div className="section__inner">
        <SectionHead title="Repertoire" sub="歌唱楽曲の統計" />

        {stats.length === 0 ? (
          <Reveal>
            <div className="empty-note">歌枠データはまだ登録されていません。</div>
          </Reveal>
        ) : (
          <Reveal>
            {/* タブを先に置き、検索フォームは右端。タブの位置がタブ切替で動かないようにする */}
            <div className="rep__bar">
              <div className="tabs">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    className={`tab-btn ${tab === t.id ? 'is-active' : ''}`}
                    onClick={() => changeTab(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {tab === 'ranking' && (
                <div className="rep__order">
                  {RANK_BYS.map((b) => (
                    <button
                      key={b.id}
                      className={`rep__order-btn ${rankBy === b.id ? 'is-active' : ''}`}
                      onClick={() => changeRankBy(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
              {tab === 'count' && (
                <div className="rep__order">
                  {COUNT_BYS.map((b) => (
                    <button
                      key={b.id}
                      className={`rep__order-btn ${countBy === b.id ? 'is-active' : ''}`}
                      onClick={() => changeCountBy(b.id)}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              )}
              {tab === 'list' && (
                <>
                  {/* 並び順は2つだけ。畳まずそのまま出す */}
                  <div className="rep__order">
                    {(
                      [
                        { id: 'new', label: '新しい順' },
                        { id: 'old', label: '古い順' },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.id}
                        className={`rep__order-btn ${order === o.id ? 'is-active' : ''}`}
                        onClick={() => changeOrder(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <input
                    className="rep__search"
                    type="search"
                    placeholder="楽曲名・原曲アーティストで検索"
                    value={query}
                    onChange={(e) => changeQuery(e.target.value)}
                  />
                </>
              )}
            </div>

            <Cards items={shown} />
            <Pager page={safePage} total={totalPages} onChange={setPage} />
          </Reveal>
        )}
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
        <div className="about">
          <Reveal className="about__text">
            <AboutText singer="水瀬凪" />
          </Reveal>
          <Reveal className="about__visual" delay={120}>
            <img
              className="about__logo"
              src={ASSET('viju.png')}
              alt="「戦史」同人サークル 白百合と金鷲亭の紋章"
              loading="lazy"
            />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Links() {
  return (
    <section className="section" id="links">
      <div className="section__inner">
        <SectionHead title="Official Links" sub="ご本人の公式アカウント" />
        <Reveal>
          <div className="links">
            {SITE.links.map((l) => (
              <a
                key={l.label}
                className="link-btn"
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {l.label}
              </a>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
