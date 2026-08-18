import { useEffect, useMemo, useRef, useState } from 'react'
import './NagiCityscape.css'
import {
  CHUNK_MARGIN, DEFAULT_SPEED, DRAW_DELAY, DRAW_DURATION,
  LAYERS, LAYER_ORDER, STROKE_DETAIL, VIEW_H, type LayerKey,
} from './constants'
import { createCityState, generateChunk } from './generator'
import type { Detail, PlacedItem } from './types'

export interface NagiCityscapeProps {
  /** 街並みを決めるシード。省略すると読み込みごとに変わる */
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
  /** 外部から停止させたい場合に true */
  paused?: boolean
  className?: string
}

interface Chunk {
  key: number
  /** 層の座標系での左端（描画単位） */
  left: number
  width: number
  path: string
  wires: string
  items: PlacedItem[]
  /** 初回に画面へ出た区画。ラインドローイングを掛ける */
  initial: boolean
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

/**
 * 1層ぶんの街並み。
 * 区画を必要なぶんだけ作り足し、流れ切った区画は捨てる。
 * 捨てるときに座標を左へ詰め直すので、値が際限なく大きくなることはない。
 */
function Layer({
  layer, seed, districtScale, scale, speed, stopped,
}: {
  layer: LayerKey
  seed: number
  districtScale: number
  scale: number
  speed: number
  stopped: boolean
}) {
  const spec = LAYERS[layer]
  const hostRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const chunksRef = useRef<Chunk[]>([])
  const stateRef = useRef(createCityState(seed, layer, districtScale))
  const offsetRef = useRef(0)
  const nextKeyRef = useRef(0)
  const [, setVersion] = useState(0)

  useEffect(() => {
    const host = hostRef.current
    const track = trackRef.current
    if (!host || !track) return

    // シードや層が変わったら作り直す
    stateRef.current = createCityState(seed, layer, districtScale)
    chunksRef.current = []
    offsetRef.current = 0

    let raf = 0
    let last = 0
    const pxPerSec = speed * spec.speedFactor

    const right = () => {
      const list = chunksRef.current
      return list.length ? list[list.length - 1].left + list[list.length - 1].width : 0
    }

    /**
     * 区画ひとつは画面幅＋余白。
     * 右端が画面の右外に届いていなければ次の区画を作り、
     * 画面の左外へ出た区画は捨てる。どちらも視界の外で起きる。
     */
    const fill = (): boolean => {
      const span = host.clientWidth / scale + CHUNK_MARGIN
      let changed = false

      while (right() < offsetRef.current / scale + span) {
        const left = right()
        // ラインドローイングは最初の1枚だけ。以降は画面外で作るので掛けない
        const first = chunksRef.current.length === 0
        const chunk = generateChunk(stateRef.current, span)
        chunksRef.current.push({ key: nextKeyRef.current++, left, ...chunk, initial: first })
        changed = true
      }

      // 捨てるたびに座標を詰め直すので、判定のたびに現在値を取り直す
      while (chunksRef.current.length > 1) {
        const head = chunksRef.current[0]
        if (head.left + head.width >= offsetRef.current / scale) break
        chunksRef.current.shift()
        for (const c of chunksRef.current) c.left -= head.width
        offsetRef.current -= head.width * scale
        changed = true
      }
      return changed
    }

    fill()
    setVersion((v) => v + 1)
    track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`

    const step = (t: number) => {
      raf = requestAnimationFrame(step)
      if (!last) last = t
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      if (!stopped) offsetRef.current += pxPerSec * dt
      track.style.transform = `translate3d(${-offsetRef.current}px,0,0)`
      if (fill()) setVersion((v) => v + 1)
    }
    raf = requestAnimationFrame(step)

    const ro = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(() => { if (fill()) setVersion((v) => v + 1) })
    ro?.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [layer, scale, speed, spec.speedFactor, stopped, seed, districtScale])

  return (
    <div
      ref={hostRef}
      className={`nagi-city__layer nagi-city__layer--${layer}`}
      style={{ opacity: spec.opacity }}
    >
      <div ref={trackRef} className="nagi-city__track">
        {chunksRef.current.map((c) => (
          <svg
            key={c.key}
            className={`nagi-city__chunk${c.initial ? ' is-first' : ''}`}
            width={c.width * scale}
            height={VIEW_H * scale}
            viewBox={`0 0 ${c.width} ${VIEW_H}`}
            style={{ left: c.left * scale, ['--draw-delay' as string]: `${DRAW_DELAY[layer]}s` }}
            aria-hidden="true"
            focusable="false"
          >
            {/* 層ごとに地面の高さをずらす。遠景ほど上に置くと奥行きが出る */}
            <g transform={`translate(0,${spec.groundOffset})`}>
              <path
                className="nagi-city__outline"
                d={c.path}
                pathLength={1000}
                fill="none"
                stroke="var(--cty-line)"
                strokeWidth={spec.strokeWidth}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {c.wires && (
                <path
                  className="nagi-city__wire"
                  d={c.wires}
                  fill="none"
                  stroke="var(--cty-line)"
                  strokeWidth={0.8}
                  strokeLinecap="round"
                />
              )}
              <g className="nagi-city__details">
                {c.items.map((item, i) => (
                  <g key={i} transform={`translate(${item.x},0)`}>
                    {item.details.map((d, j) => <DetailNode key={j} d={d} />)}
                  </g>
                ))}
              </g>
            </g>
          </svg>
        ))}
      </div>
    </div>
  )
}

/** URL に ?seed=数値 があればそれを使う。無ければ読み込みごとに変える */
function resolveSeed(given?: number): number {
  if (given !== undefined) return given
  if (typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search).get('seed')
    if (q && /^\d+$/.test(q)) return Number(q)
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0
}

export function NagiCityscape({
  seed,
  speed = DEFAULT_SPEED,
  districtScale = 1,
  scale = 1,
  height = Math.round(VIEW_H * scale),
  paused = false,
  className,
}: NagiCityscapeProps) {
  const [reduceMotion, setReduceMotion] = useState(false)
  const resolvedSeed = useMemo(() => resolveSeed(seed), [seed])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const stopped = paused || reduceMotion

  return (
    <div
      className={['nagi-city', className].filter(Boolean).join(' ')}
      style={{ height, ['--draw-dur' as string]: `${DRAW_DURATION}s` }}
      aria-hidden="true"
    >
      {LAYER_ORDER.map((layer) => (
        <Layer
          key={layer}
          layer={layer}
          seed={resolvedSeed}
          districtScale={districtScale}
          scale={scale}
          speed={speed}
          stopped={stopped}
        />
      ))}
    </div>
  )
}
