import type { Db } from '../types'
import { Link } from '../router'
import './Top.css'

export default function Top({ db }: { db: Db }) {
  const counts = new Map<string, number>()
  for (const f of db.frames) counts.set(f.singer_id, (counts.get(f.singer_id) ?? 0) + 1)

  return (
    <div className="top">
      {/* 更新履歴と About me のページはまだ無い。デザインが決まるまで飛び先は付けない */}
      <div className="top-header">
        <div className="wrap top-header__inner">
          <span className="top-header__name">uta-waku Archive</span>
          <nav className="top-header__nav">
            <span className="top-header__link">更新履歴</span>
            <span className="top-header__link">About me</span>
          </nav>
        </div>
      </div>

      <main className="wrap">
        <ul className="singer-grid">
          {db.singers.map((s) => (
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

      <footer className="top-foot wrap muted">
        <p>
          当サイトは非公式のファンメイドであり、各シンガーおよび所属団体とは関係ありません。
        </p>
      </footer>
    </div>
  )
}
