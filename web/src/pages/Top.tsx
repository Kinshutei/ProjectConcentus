import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Db } from '../types'
import { Link } from '../router'
import './Top.css'

/** 所属の無いシンガーはここへ入れる */
const SOLO = '個人勢'
const ALL = 'ALL'

export default function Top({ db }: { db: Db }) {
  const counts = new Map<string, number>()
  for (const f of db.frames) counts.set(f.singer_id, (counts.get(f.singer_id) ?? 0) + 1)

  // 事務所はデータから拾う。個人勢だけは末尾へ回す
  const offices = useMemo(() => {
    const seen: string[] = []
    for (const s of db.singers) {
      const a = s.affiliation ?? SOLO
      if (!seen.includes(a)) seen.push(a)
    }
    const solo = seen.includes(SOLO) ? [SOLO] : []
    return [ALL, ...seen.filter((a) => a !== SOLO), ...solo]
  }, [db.singers])

  const [office, setOffice] = useState(ALL)
  const shown = db.singers.filter((s) => office === ALL || (s.affiliation ?? SOLO) === office)

  // 選択中の項目の位置を測って、下線をそこへ滑らせる
  const navRef = useRef<HTMLElement>(null)
  const [bar, setBar] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = navRef.current?.querySelector<HTMLElement>('.is-active')
    if (!el) return
    const move = () => setBar({ left: el.offsetLeft, width: el.offsetWidth })
    move()
    // 書体が届くと幅が変わるので、届いた時点で測り直す
    document.fonts?.ready.then(move).catch(() => {})
    window.addEventListener('resize', move)
    return () => window.removeEventListener('resize', move)
  }, [office, offices])

  return (
    <div className="top">
      {/* 更新履歴と About me のページはまだ無い。デザインが決まるまで飛び先は付けない */}
      <div className="top-header">
        <div className="wrap top-header__inner">
          <span className="top-header__name">uta-waku Archive</span>

          <nav className="top-office" ref={navRef}>
            {offices.map((o) => (
              <button
                key={o}
                type="button"
                className={`top-office__btn ${office === o ? 'is-active' : ''}`}
                onClick={() => setOffice(o)}
              >
                {o}
              </button>
            ))}
            <span
              className="top-office__bar"
              style={{ transform: `translateX(${bar.left}px)`, width: bar.width }}
            />
          </nav>

          <nav className="top-header__nav">
            <span className="top-header__link">更新履歴</span>
            <span className="top-header__link">About me</span>
          </nav>
        </div>
      </div>

      <main className="wrap">
        <ul className="singer-grid">
          {shown.map((s) => (
            <li key={s.singer_id}>
              <Link
                to={`/${s.url_path}`}
                className="singer-card"
                style={{ '--card': s.color ?? 'var(--accent)' } as React.CSSProperties}
              >
                <span className="singer-en">{s.name_en}</span>
                <span className="singer-name">{s.name}</span>
                <span className="singer-meta muted">
                  {s.affiliation ?? '個人勢'} ・ 枠 {counts.get(s.singer_id) ?? 0}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>

      <footer className="top-foot">
        <div className="wrap top-foot__inner">
          <span>非公式ファンサイト</span>
          <span className="top-foot__sep">-</span>
          <span>Produced by 金鷲亭</span>
          <span className="top-foot__sep">-</span>
          <span>
            当サイトは非公式のファンメイドであり、各シンガーおよび所属団体とは関係ありません。
          </span>
        </div>
      </footer>
    </div>
  )
}
