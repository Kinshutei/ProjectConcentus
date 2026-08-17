import { useEffect, useRef, useState } from 'react'
import './yearpicker.css'

const PER_PAGE = 9

/**
 * 年代の絞り込み。📅 を押すと吹き出しが開き、3×3の升目に年が並ぶ。
 * 9件を超える場合はページ送りにする。
 */
export default function YearPicker({
  years,
  value,
  onChange,
}: {
  /** 選べる年。新しい順に並べて渡す */
  years: string[]
  value: string | null
  onChange: (year: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(1)
  const boxRef = useRef<HTMLDivElement>(null)

  // 外側クリックと Esc で閉じる
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const totalPages = Math.max(1, Math.ceil(years.length / PER_PAGE))
  const current = Math.min(page, totalPages)
  const shown = years.slice((current - 1) * PER_PAGE, current * PER_PAGE)

  return (
    <div className="yearpick" ref={boxRef}>
      <button
        type="button"
        className={`yearpick__btn${value ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        年代選択：<span aria-hidden="true">📅</span>
        {value && <span className="yearpick__current">{value}年</span>}
      </button>

      {open && (
        <div className="yearpick__pop" role="dialog" aria-label="年代を選ぶ">
          <div className="yearpick__grid">
            {shown.map((y) => (
              <button
                key={y}
                type="button"
                className={`yearpick__cell${value === y ? ' is-on' : ''}`}
                onClick={() => {
                  onChange(value === y ? null : y)
                  setOpen(false)
                }}
              >
                {y}
              </button>
            ))}
            {/* 升目が欠けると格好が崩れるので空きを埋める */}
            {Array.from({ length: PER_PAGE - shown.length }, (_, i) => (
              <span key={`blank-${i}`} className="yearpick__cell yearpick__cell--empty" />
            ))}
          </div>

          <div className="yearpick__foot">
            <button
              type="button"
              className="yearpick__clear"
              onClick={() => {
                onChange(null)
                setOpen(false)
              }}
              disabled={!value}
            >
              すべて
            </button>
            {totalPages > 1 && (
              <span className="yearpick__pager">
                <button
                  type="button"
                  onClick={() => setPage(current - 1)}
                  disabled={current <= 1}
                  aria-label="前のページ"
                >
                  ◀
                </button>
                <span>
                  {current} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage(current + 1)}
                  disabled={current >= totalPages}
                  aria-label="次のページ"
                >
                  ▶
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
