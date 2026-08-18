import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './NagiCityscape.css'
import {
  DEFAULT_SEED, DEFAULT_SPEED, DRAW_DELAY, DRAW_DURATION, LAYERS, LAYER_ORDER, MIN_STRIP_WIDTH,
  MIN_STRIP_COPIES, SCROLL_GAIN, STRIP_WIDTH_FACTOR, STROKE_DETAIL,
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
  layer, seed, minWidth, boxWidth, districtScale, scale, speed, stopped, gid,
}: {
  layer: LayerKey
  seed: number
  minWidth: number
  boxWidth: number
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
  const stripPx = W * scale
  const gain = SCROLL_GAIN * spec.speedFactor
  /*
   * 等速ループで最大 1 ストリップ、スクロール連動で最大 gain ストリップ左へ動く。
   * その位置からコンテナ幅ぶん右まで絵が続いていれば、どこまで送っても切れない。
   */
  const copies = Math.max(MIN_STRIP_COPIES, Math.ceil(1 + gain + boxWidth / stripPx))

  return (
    <div
      className={`nagi-city__layer nagi-city__layer--${layer}`}
      style={{
        opacity: spec.opacity,
        ['--strip-w' as string]: `${stripPx}px`,
        ['--dur' as string]: `${stripPx / (speed * spec.speedFactor)}s`,
        ['--draw-delay' as string]: `${DRAW_DELAY[layer]}s`,
        ['--gain' as string]: `${gain}`,
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
            width={W * copies * scale}
            height={VIEW_H * scale}
            viewBox={`0 0 ${W * copies} ${VIEW_H}`}
            aria-hidden="true"
            focusable="false"
          >
            {/*
              1枚目は defs に隠さず実際に描く。defs の中は描画されない要素なので
              transition が進まず、輪郭が stroke-dashoffset の初期値のまま
              止まってしまう。実描画にすれば描き起こしが動き、use の複製も追従する。
            */}
            <g className="nagi-city__strip">
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
            </g>
            {/* 残りは use で参照する。DOMノード数は1枚分で済む */}
            {Array.from({ length: copies - 1 }, (_, i) => (
              <use key={i} href={`#${id}`} x={W * (i + 1)} />
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
  // 初回からビューポートに足りる幅で生成する。あとで作り直すと
  // 描き起こしの最中にストリップが差し替わり、途中で切れて見える
  const [minWidth, setMinWidth] = useState(() =>
    Math.max(
      MIN_STRIP_WIDTH,
      Math.ceil(((typeof window === 'undefined' ? 1200 : window.innerWidth) / scale) * STRIP_WIDTH_FACTOR),
    ),
  )
  const [boxWidth, setBoxWidth] = useState(() => (typeof window === 'undefined' ? 1200 : window.innerWidth))
  const [reduceMotion, setReduceMotion] = useState(false)
  const [drawn, setDrawn] = useState(false)

  // コンテナ幅を監視し、必要幅が現在値を上回ったときのみ再生成する。
  // 縮小時に作り直さないことで、リサイズ中に街並みが変わるのを防ぐ。
  useEffect(() => {
    const el = frameRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([entry]) => {
      // 縮小表示するぶん、必要なストリップ幅は 1/scale 倍になる
      const w = entry.contentRect.width
      setBoxWidth((prev) => (w > prev ? w : prev))
      const need = Math.ceil((w / scale) * STRIP_WIDTH_FACTOR)
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

  // 初回可視時に一度だけラインドローイングを起こす
  useEffect(() => {
    const el = frameRef.current
    if (!el) return
    // 固定フッターは最初から画面内にあることが多い。監視の初回通知を
    // 待つと開始が遅れるので、見えているなら即座に始める
    const rect = el.getBoundingClientRect()
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
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
          boxWidth={boxWidth}
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
