import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import './StarfieldSky.css'
import { SKY_ANGLE, SKY_MIN_WIDTH, SKY_SEED, SKY_SPEED, SKY_WIDTH_FACTOR } from './constants'
import { generateSky } from './generator'

export interface StarfieldSkyProps {
  seed?: number
  speed?: number
  angle?: number
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
      </div>
    </div>
  )
}
