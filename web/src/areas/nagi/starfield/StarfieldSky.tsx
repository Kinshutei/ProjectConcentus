import {
  useCallback, useEffect, useMemo, useRef, useState, type AnimationEvent, type CSSProperties,
} from 'react'
import './StarfieldSky.css'
import {
  SKY_ANGLE, SKY_MIN_WIDTH, SKY_SEED, SKY_SPEED, SKY_WIDTH_FACTOR,
  SLOT_COUNT, SLOT_MARGIN,
} from './constants'
import { generateSky } from './generator'
import { currentSeason, seasonPool } from './seasons'
import { makeSlot } from './slots'
import type { Season, SlotState } from './types'

export interface StarfieldSkyProps {
  seed?: number
  speed?: number
  angle?: number
  /** 省略時は現在の月から判定する */
  season?: Season
  className?: string
}

/**
 * 斜めに流れる星空。
 * 二次元の無限ループを避けるため、レイヤーごと回転させ、その内部では
 * 水平にスクロールさせている。ループ機構は街並みと同じ。
 */
export function StarfieldSky({
  seed = SKY_SEED,
  speed = SKY_SPEED,
  angle = SKY_ANGLE,
  season,
  className = '',
}: StarfieldSkyProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 1200, h: 400 })

  useEffect(() => {
    const el = hostRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      setBox((prev) =>
        width > prev.w || height > prev.h
          ? { w: Math.max(prev.w, Math.ceil(width)), h: Math.max(prev.h, Math.ceil(height)) }
          : prev,
      )
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const rad = (angle * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)

  // 回転後も画面を覆う外接矩形
  const Wr = Math.ceil(box.w * cos + box.h * sin)
  const Hr = Math.ceil(box.w * sin + box.h * cos)
  const Ws = Math.max(SKY_MIN_WIDTH, Math.ceil(Wr * SKY_WIDTH_FACTOR))

  const strip = useMemo(() => generateSky({ seed, width: Ws, height: Hr }), [seed, Ws, Hr])

  const dur = Ws / speed

  // ── 星座のスロット ──
  const activeSeason: Season = season ?? currentSeason()
  const pool = useMemo(() => seasonPool(activeSeason), [activeSeason])

  /*
   * 縦位置の制約。回転枠の高さ Hr は画面より大きいので、0〜Hr の一様乱数で
   * 決めると大半の星座が一度も画面に現れない。スロットが画面中央を通る瞬間に
   * 見えている縦幅は Hc / cos θ なので、その帯の割合に収める。
   */
  const bandRatio = (box.h / cos) / Hr

  const [slots, setSlots] = useState<SlotState[]>([])

  // プールが変わったら全スロットを作り直す。
  // bandRatio は依存に入れない。リサイズのたびに星座が総入れ替えになるため
  useEffect(() => {
    const next: SlotState[] = []
    const used = new Set<string>()
    for (let i = 0; i < SLOT_COUNT; i++) {
      const s = makeSlot(pool, used, bandRatio)
      used.add(s.constellation.id)
      if (s.constellation.group) used.add(s.constellation.group)
      next.push(s)
    }
    setSlots(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool])

  const travel = Wr + SLOT_MARGIN * 2
  const slotDur = travel / speed

  const handleIteration = useCallback(
    (index: number, e: AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget) return
      if (e.animationName !== 'sky-slot-travel') return
      setSlots((prev) => {
        const used = new Set<string>()
        prev.forEach((s, k) => {
          if (k === index) return
          used.add(s.constellation.id)
          if (s.constellation.group) used.add(s.constellation.group)
        })
        const next = [...prev]
        next[index] = makeSlot(pool, used, bandRatio)
        return next
      })
    },
    [pool, bandRatio],
  )

  return (
    <div ref={hostRef} className={`sky ${className}`.trim()} aria-hidden="true">
      <div
        className="sky__rot"
        style={{
          width: Wr,
          height: Hr,
          left: (box.w - Wr) / 2,
          top: (box.h - Hr) / 2,
          transform: `rotate(-${angle}deg)`,
        }}
      >
        <div
          className="sky__track"
          style={{
            ['--strip-w' as string]: `${Ws}px`,
            ['--dur' as string]: `${dur}s`,
          } as CSSProperties}
        >
          {[0, 1].map((i) => (
            <svg
              key={i}
              className="sky__svg"
              width={Ws}
              height={Hr}
              viewBox={`0 0 ${Ws} ${Hr}`}
              style={{ left: (i - 1) * Ws }}
            >
              <g className="sky__dust">
                {strip.dust.map((b, k) => (
                  <path key={k} d={b.d} opacity={b.o.toFixed(2)} />
                ))}
              </g>
              <g className="sky__stars">
                {strip.stars.map((s, k) => (
                  <circle
                    key={k}
                    cx={s.x.toFixed(1)}
                    cy={s.y.toFixed(1)}
                    r={s.r.toFixed(2)}
                    opacity={s.o.toFixed(2)}
                    className={s.tw ? 'is-twinkle' : undefined}
                    style={
                      s.tw
                        ? ({
                            ['--tw-dur' as string]: `${s.tw.dur}s`,
                            ['--tw-delay' as string]: `${s.tw.delay}s`,
                          } as CSSProperties)
                        : undefined
                    }
                  />
                ))}
              </g>
            </svg>
          ))}
        </div>

        {slots.map((s, i) => {
          const c = s.constellation
          const pts = c.stars.map((st) => ({
            px: st.x * s.size,
            py: st.y * s.size,
            mag: st.mag,
          }))
          const d = c.lines
            .map(([a, b]) =>
              `M${pts[a].px.toFixed(1)} ${pts[a].py.toFixed(1)} L${pts[b].px.toFixed(1)} ${pts[b].py.toFixed(1)}`,
            )
            .join(' ')

          return (
            <div
              key={s.key}
              className="sky__slot"
              onAnimationIteration={(e) => handleIteration(i, e)}
              style={{
                top: `${s.topRatio * 100}%`,
                ['--travel' as string]: `${travel}px`,
                ['--margin' as string]: `${SLOT_MARGIN}px`,
                animationDuration: `${slotDur}s`,
                animationDelay: `${-(i / SLOT_COUNT) * slotDur}s`,
              } as CSSProperties}
            >
              <svg
                width={s.size}
                height={s.size}
                style={{
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: '50% 50%',
                  overflow: 'visible',
                }}
              >
                <path className="sky__lines" d={d} />
                {pts.map((p, k) => (
                  <circle
                    key={k}
                    cx={p.px.toFixed(1)}
                    cy={p.py.toFixed(1)}
                    r={Math.max(1.0, Math.min(2.0, 1.95 - 0.3 * p.mag) * 1.25).toFixed(2)}
                    fill="var(--sky-star-bright)"
                  />
                ))}
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}
