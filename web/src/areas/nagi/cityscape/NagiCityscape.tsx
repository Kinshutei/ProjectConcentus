import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './NagiCityscape.css'
import {
  DEFAULT_SEED, DEFAULT_SPEED, DRAW_DELAY, DRAW_DURATION, LAYERS, LAYER_ORDER,
  MIN_STRIP_WIDTH, SCROLL_GAIN, STRIP_COPIES, STRIP_WIDTH_FACTOR, STROKE_DETAIL,
  VIEW_H, type LayerKey,
} from './constants'
import { generateCity } from './generator'
import type { Detail } from './types'

export interface NagiCityscapeProps {
  /** 街並みを決めるシード。同じ値なら常に同じ街になる */
  seed?: number
  /** 主層のスクロール速度（px/秒）。遠景・近景は層ごとの倍率が掛かる */
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
  /** ページスクロールに連動させるか。非対応ブラウザでは自動的に無視される */
  scrollLinked?: boolean
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

function Layer({
  layer, seed, minWidth, districtScale, scale, speed, stopped, gid,
}: {
  layer: LayerKey
  seed: number
  minWidth: number
  districtScale: number
  scale: number
  speed: number
  stopped: boolean
  gid: string
}) {
  const spec = LAYERS[layer]
  const city = useMemo(
    () => generateCity({ seed: seed + spec.seedOffset, minWidth, districtScale, layer }),
    [seed, spec.seedOffset, minWidth, districtScale, layer],
  )
  const W = city.width
  const id = `${gid}-${layer}`

  return (
    <div
      className={`nagi-city__layer nagi-city__layer--${layer}`}
      style={{
        opacity: spec.opacity,
        ['--strip-w' as string]: `${W * scale}px`,
        ['--dur' as string]: `${(W * scale) / (speed * spec.speedFactor)}s`,
        ['--draw-delay' as string]: `${DRAW_DELAY[layer]}s`,
        ['--gain' as string]: `${SCROLL_GAIN * spec.speedFactor}`,
        animationPlayState: stopped ? 'paused' : 'running',
      }}
    >
      <div className="nagi-city__parallax">
        <div
          className="nagi-city__track"
          style={{ animationPlayState: stopped ? 'paused' : 'running' }}
        >
          <svg
            className="nagi-city__svg"
            width={W * STRIP_COPIES * scale}
            height={VIEW_H * scale}
            viewBox={`0 0 ${W * STRIP_COPIES} ${VIEW_H}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              {/* 層ごとに地面の高さをずらす。遠景ほど上に置くと奥行きが出る */}
              <g id={id} transform={`translate(0,${spec.groundOffset})`}>
                <path
                  className="nagi-city__outline"
                  d={city.path}
                  pathLength={1000}
                  fill="none"
                  stroke="var(--cty-line)"
                  strokeWidth={spec.strokeWidth}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {city.wires && (
                  <path
                    className="nagi-city__wire"
                    d={city.wires}
                    fill="none"
                    stroke="var(--cty-line)"
                    strokeWidth={0.8}
                    strokeLinecap="round"
                  />
                )}
                <g className="nagi-city__details">
                  {city.items.map((item, i) => (
                    <g key={i} transform={`translate(${item.x},0)`}>
                      {item.details.map((d, j) => <DetailNode key={j} d={d} />)}
                    </g>
                  ))}
                </g>
              </g>
            </defs>
            {/* 同一グラフィックを use で参照する。DOMノード数は1枚分で済む */}
            {Array.from({ length: STRIP_COPIES }, (_, i) => (
              <use key={i} href={`#${id}`} x={W * i} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  )
}

export function NagiCityscape({
  seed = DEFAULT_SEED,
  speed = DEFAULT_SPEED,
  districtScale = 1,
  scale = 1,
  height = Math.round(VIEW_H * scale),
  scrollLinked = true,
  paused = false,
  className,
}: NagiCityscapeProps) {
  const frameRef = useRef<HTMLDivElement>(null)
  const gid = useId().replace(/:/g, '')
  const [minWidth, setMinWidth] = useState(MIN_STRIP_WIDTH)
  const [reduceMotion, setReduceMotion] = useState(false)
  const [drawn, setDrawn] = useState(false)

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

  // 初回可視時に一度だけ描画アニメを起こす
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true)
      return
    }
    if (typeof IntersectionObserver === 'undefined') {
      setDrawn(true)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setDrawn(true)
          io.disconnect()
        }
      },
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const stopped = paused || reduceMotion

  return (
    <div
      ref={frameRef}
      className={[
        'nagi-city',
        drawn ? 'is-drawn' : '',
        scrollLinked ? 'is-scroll-linked' : '',
        className,
      ].filter(Boolean).join(' ')}
      style={{ height, ['--draw-dur' as string]: `${DRAW_DURATION}s` }}
      aria-hidden="true"
    >
      {LAYER_ORDER.map((layer) => (
        <Layer
          key={layer}
          layer={layer}
          seed={seed}
          minWidth={minWidth}
          districtScale={districtScale}
          scale={scale}
          speed={speed}
          stopped={stopped}
          gid={gid}
        />
      ))}
    </div>
  )
}
