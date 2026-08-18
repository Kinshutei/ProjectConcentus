import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './CityscapeFooter.css'
import {
  DEFAULT_SEED, DEFAULT_SPEED, MIN_STRIP_WIDTH,
  STRIP_WIDTH_FACTOR, STROKE_DETAIL, STROKE_OUTLINE, VIEW_H,
} from './constants'
import { generateCity } from './generator'
import type { Detail } from './types'

export interface CityscapeFooterProps {
  /** 街並みを決めるシード。同じ値なら常に同じ街になる */
  seed?: number
  /** スクロール速度（px/秒）。8〜15 を推奨 */
  speed?: number
  /** 地区の長さ倍率。0.5 で雑多、1.8 で整然とした都市になる */
  districtScale?: number
  /**
   * 描画倍率。0.5 で街並み全体が半分の大きさになる。
   * 線幅も一緒に縮むため、下げすぎると輪郭が薄くなる。
   */
  scale?: number
  /** フレームの表示高さ（px）。既定は VIEW_H × scale でぴったり収まる */
  height?: number
  /** 外部から停止させたい場合に true */
  paused?: boolean
  className?: string
}

function DetailNode({ d }: { d: Detail }) {
  const stroke = d.accent ? 'var(--cty-accent)' : 'var(--cty-line)'
  const sw = d.sw ?? STROKE_DETAIL
  switch (d.kind) {
    case 'rect':
      return <rect x={d.x} y={d.y} width={d.w} height={d.h} rx={d.rx} fill="none" stroke={stroke} strokeWidth={sw} />
    case 'line':
      return <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke={stroke} strokeWidth={sw} />
    case 'circle':
      return <circle cx={d.cx} cy={d.cy} r={d.r} fill="none" stroke={stroke} strokeWidth={sw} />
  }
}

export function CityscapeFooter({
  seed = DEFAULT_SEED,
  speed = DEFAULT_SPEED,
  districtScale = 1,
  scale = 1,
  height = Math.round(VIEW_H * scale),
  paused = false,
  className,
}: CityscapeFooterProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const gid = useId().replace(/:/g, '')
  const [minWidth, setMinWidth] = useState(MIN_STRIP_WIDTH)
  const [reduceMotion, setReduceMotion] = useState(false)

  // コンテナ幅を監視し、必要幅が現在値を上回ったときのみ再生成する。
  // 縮小時に作り直さないことで、リサイズ中に街並みが変わるのを防ぐ。
  useEffect(() => {
    const el = frameRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      // 縮小表示するぶん、必要なストリップ幅は 1/scale 倍になる
      const need = Math.ceil((entry.contentRect.width / scale) * STRIP_WIDTH_FACTOR)
      setMinWidth((prev) => (need > prev ? need : prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [scale])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const city = useMemo(
    () => generateCity({ seed, minWidth, districtScale }),
    [seed, minWidth, districtScale],
  )

  const W = city.width
  const stopped = paused || reduceMotion

  return (
    <div ref={frameRef} className={['cityscape', className].filter(Boolean).join(' ')} style={{ height }}>
      <svg
        className="cityscape__strip"
        width={W * 2 * scale}
        height={VIEW_H * scale}
        viewBox={`0 0 ${W * 2} ${VIEW_H}`}
        aria-hidden="true"
        focusable="false"
        style={{
          // 実際に動く距離は W×scale なので、speed（px/秒）の意味を保つため倍率を掛ける
          animationDuration: `${(W * scale) / speed}s`,
          animationPlayState: stopped ? 'paused' : 'running',
          ['--cty-shift' as string]: `${-W * scale}px`,
        }}
      >
        <defs>
          <g id={gid}>
            <path
              d={city.path}
              fill="none"
              stroke="var(--cty-line)"
              strokeWidth={STROKE_OUTLINE}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {city.items.map((item, i) => (
              <g key={i} transform={`translate(${item.x},0)`}>
                {item.details.map((d, j) => <DetailNode key={j} d={d} />)}
              </g>
            ))}
          </g>
        </defs>
        {/* 同一グラフィックを use で2枚参照する。DOMノード数は1枚分で済む */}
        <use href={`#${gid}`} />
        <use href={`#${gid}`} x={W} />
      </svg>
    </div>
  )
}
