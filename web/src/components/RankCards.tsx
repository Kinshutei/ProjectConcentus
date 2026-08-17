import { useState } from 'react'
import './rankcards.css'

export type RankItem = {
  key: string
  /** 省略すると順位バッジを出さない */
  rank?: number
  title: string
  /** 曲名の右に出す。リリース日など */
  titleRight?: string
  /** 2行目。アーティスト名など */
  sub?: string
  /** 3行目以降。作詞・作曲・編曲など1行ずつ */
  lines?: string[]
  value: number
  unit: string
  /** 全体に占める割合。指定すると値の右に % を出す */
  ratio?: number
  /** 累計で上位50%に入るもの。背景を淡く敷いて範囲を示す */
  highlight?: boolean
}

/**
 * 値の大きい順に足していき、合計の半分に達するまでを highlight にする。
 * 「どこまでで半分を占めるのか」を一目で分かるようにするための印。
 */
export function markTopHalf(items: RankItem[]): RankItem[] {
  const total = items.reduce((sum, i) => sum + i.value, 0)
  if (total <= 0) return items
  let acc = 0
  let reached = false
  return items.map((item) => {
    if (reached) return item
    acc += item.value
    if (acc >= total / 2) reached = true
    return { ...item, highlight: true }
  })
}


/** ◀ 現在 / 総数 ▶ の送り。1ページに収まるときは出さない */
function Pager({ page, total, onChange }: { page: number; total: number; onChange: (p: number) => void }) {
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

/** ハイライトの凡例。色見本は薄めず、文字だけ落とす */
export function HighlightNote({ label = '上位50%' }: { label?: string }) {
  return (
    <span className="hl-note">
      <span className="hl-note__swatch" aria-hidden="true" />
      <span className="hl-note__text">{label}</span>
    </span>
  )
}

/**
 * 順位つきのカード一覧。10件を超えるものはページ送りにする。
 * Plotly を使うと 1.4MB(gzip) 増えるため、集計表示はこちらで賄う。
 */
export default function RankCards({
  items,
  paged = false,
  columns = 1,
  rows = 10,
}: {
  items: RankItem[]
  /** true ならページ送り、false なら先頭1ページ分のみ */
  paged?: boolean
  /** 横に並べる列数 */
  columns?: 1 | 2 | 3
  /** 縦に並べる最大数。1ページの件数は columns × rows */
  rows?: number
}) {
  const [page, setPage] = useState(1)
  if (items.length === 0) return <div className="empty-note">該当するデータがありません。</div>

  const perPage = columns * rows
  const totalPages = paged ? Math.max(1, Math.ceil(items.length / perPage)) : 1
  const current = Math.min(page, totalPages)
  const shown = paged
    ? items.slice((current - 1) * perPage, current * perPage)
    : items.slice(0, perPage)

  return (
    <>
      <div className={`rank-grid rank-grid--col${columns}`}>
        {shown.map((item) => (
          <div
            key={item.key}
            className={
              'rank-card' +
              (item.rank !== undefined && item.rank <= 3 ? ' rank-card--top' : '') +
              (item.highlight ? ' rank-card--hl' : '')
            }
          >
            {item.rank !== undefined && <span className="rank-card__no">{item.rank}</span>}
            <div className="rank-card__body">
              <div className="rank-card__head">
                <span className="rank-card__title">{item.title}</span>
                {item.titleRight && <span className="rank-card__right">{item.titleRight}</span>}
              </div>
              {item.sub && <div className="rank-card__sub">{item.sub}</div>}
              {item.lines?.map((line) => (
                <div key={line} className="rank-card__line">
                  {line}
                </div>
              ))}
            </div>
            <div className="rank-card__value">
              <strong>{item.value}</strong>
              <span className="rank-card__unit">{item.unit}</span>
              {item.ratio !== undefined && (
                <span className="rank-card__ratio">{(item.ratio * 100).toFixed(1)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {paged && <Pager page={current} total={totalPages} onChange={setPage} />}
    </>
  )
}
