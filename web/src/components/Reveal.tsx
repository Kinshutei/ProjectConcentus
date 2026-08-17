import { useEffect, useRef, useState, type ReactNode } from 'react'

/** 画面に入ったかどうか。一度入ったら戻さない（出入りでちらつかせない） */
export function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, inView }
}

/** 0 から目標値まで数える。画面に入ってから動かす */
export function useCountUp(target: number, start: boolean, duration = 900) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!start) return
    if (target <= 0) {
      setN(0)
      return
    }
    let raf = 0
    const begun = performance.now()
    const tick = (now: number) => {
      const p = Math.min(1, (now - begun) / duration)
      // 終わりに向かって緩める
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, start, duration])

  return n
}

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const { ref, inView } = useInView<HTMLDivElement>()
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

export function SectionHead({ title, sub }: { title: string; sub: string }) {
  return (
    <Reveal className="section__head">
      <h2 className="section__title">{title}</h2>
      <p className="section__sub">{sub}</p>
    </Reveal>
  )
}
