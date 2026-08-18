import { useEffect } from 'react'

/**
 * 節へのスムーススクロールを有効にする。
 *
 * 元サイトはいずれも html に scroll-behavior を指定していたが、領域ごとに
 * CSSをスコープした際に .xxx-root へ移り、効かなくなっていた。実際に
 * スクロールするのは html なので、内側の要素に指定しても意味がない。
 * そこで、その領域を開いている間だけ html へ付け直す。
 *
 * @param headerHeight 固定ヘッダーの高さ。節の先頭が隠れないよう手前で止める
 */
export function useSmoothScroll(headerHeight: number) {
  useEffect(() => {
    const root = document.documentElement
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      root.style.scrollBehavior = reduce.matches ? 'auto' : 'smooth'
      root.style.scrollPaddingTop = `${headerHeight + 12}px`
    }
    apply()
    reduce.addEventListener('change', apply)
    return () => {
      reduce.removeEventListener('change', apply)
      root.style.scrollBehavior = ''
      root.style.scrollPaddingTop = ''
    }
  }, [headerHeight])
}
