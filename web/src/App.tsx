import { useEffect, useState } from 'react'
import type { Db } from './types'
import { loadDb } from './data'
import { usePath } from './router'
import Top from './pages/Top'
import Area from './pages/Area'

export default function App() {
  const path = usePath()
  const [db, setDb] = useState<Db | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDb().then(setDb).catch((e: Error) => setError(e.message))
  }, [])

  if (error) return <div className="state">{error}</div>
  if (!db) return <div className="state">読み込み中…</div>

  if (path === '/') return <Top db={db} />

  const slug = path.split('/').filter(Boolean)[0]
  return <Area db={db} path={slug} />
}
