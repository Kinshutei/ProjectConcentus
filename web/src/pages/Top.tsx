import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Db } from '../types'
import { Link } from '../router'
import './Top.css'

/** 所属の無いシンガーはここへ入れる */
const SOLO = '個人勢'
const ALL = 'ALL'
/** 横5枚×縦2列。埋まらないぶんは仮の空き枠で見せる */
const TAROT_SLOTS = 10

export default function Top({ db }: { db: Db }) {
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

      {/* タロット札の形をした箱を横5枚×縦2列。中身はまだ入れず、並びと形だけを見る。
          シンガーは6人なので、10枚の見え方が判るよう空き枠を仮で足している */}
      <main className="tarot-area">
        <ul className="tarot-grid">
          {shown.map((s) => (
            <li key={s.singer_id} className="tarot">
              <Link
                to={`/${s.url_path}`}
                className="tarot__link"
                style={
                  {
                    '--card': s.color ?? '#8e99b0',
                    ...(s.card_image ? { '--card-art': `url("${s.card_image}")` } : {}),
                    ...(s.card_zoom ? { '--card-zoom': String(s.card_zoom) } : {}),
                    ...(s.card_focus ? { '--card-focus': s.card_focus } : {}),
                  } as React.CSSProperties
                }
              >
                {/* 背景の層。画像が入るまでは固有色で塗っておく */}
                <span className="tarot__art" />
                <span className="tarot__body">
                  <span className="tarot__en">{s.name_en}</span>
                  <span className="tarot__name">{s.name}</span>
                  {/* 鉤括弧は付けない。要るかどうかは文面ごとに違うので、
                      singers.json の tagline に書いてあるとおりに出す */}
                  <span className="tarot__desc">
                    {s.tagline ?? <em className="tarot__todo">説明は未設定</em>}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          {Array.from({ length: Math.max(0, TAROT_SLOTS - shown.length) }, (_, i) => (
            <li key={`empty_${i}`} className="tarot tarot--empty" aria-hidden="true" />
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
