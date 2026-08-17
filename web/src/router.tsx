import { useEffect, useState } from 'react'

/**
 * 依存を増やさないための最小ルーター。
 * Cloudflare Workers 側で SPA フォールバックを有効にする前提で、
 * ハッシュではなく通常のパスを使う。
 */
const base = import.meta.env.BASE_URL.replace(/\/$/, '')

function currentPath(): string {
  const p = location.pathname
  const stripped = base && p.startsWith(base) ? p.slice(base.length) : p
  return stripped.replace(/\/+$/, '') || '/'
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath)
  useEffect(() => {
    const onPop = () => setPath(currentPath())
    window.addEventListener('popstate', onPop)
    window.addEventListener('concentus:navigate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('concentus:navigate', onPop)
    }
  }, [])
  return path
}

export function navigate(to: string) {
  const target = `${base}${to === '/' ? '/' : to}`
  if (location.pathname !== target) {
    history.pushState({}, '', target)
    window.dispatchEvent(new Event('concentus:navigate'))
  }
  window.scrollTo(0, 0)
}

type LinkProps = {
  to: string
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

export function Link({ to, className, style, children }: LinkProps) {
  return (
    <a
      href={`${base}${to}`}
      className={className}
      style={style}
      onClick={(e) => {
        // 修飾キー付きや中クリックは、別タブで開きたい意図なのでブラウザに任せる
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        e.preventDefault()
        navigate(to)
      }}
    >
      {children}
    </a>
  )
}
