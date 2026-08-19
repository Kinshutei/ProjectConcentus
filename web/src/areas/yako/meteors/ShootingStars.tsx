import { useCallback, useState, type AnimationEvent } from 'react'
import './ShootingStars.css'

const COUNT = 7

/** 進行方向の傾き（度）。水平から浅く傾け、右上から左下へ走らせる */
const ANGLE_MIN = 8
const ANGLE_MAX = 34

/** 走る距離のレンジ（px）。そのまま軌跡の線の長さになる */
const LEN_MIN = 240
const LEN_MAX = 900

/** 1周期（秒）。走って見えるのはこのうち約2%だけ */
const DUR_MIN = 13
const DUR_MAX = 30

/** 先端の◯を置く余白 */
const PAD = 10
const BOX_H = 22

interface Star {
  /** 差し替えのたびに増える連番。React の key に使う */
  key: number
  /** 軌跡の長さ */
  len: number
  /** 先端の◯の半径 */
  head: number
  /** 軌跡の線幅 */
  sw: number
  /** 進行方向の傾き */
  angle: number
  /** 出現位置（%） */
  left: number
  top: number
  duration: number
  delay: number
}

let keySeq = 0

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo)
const round1 = (v: number) => Math.round(v * 10) / 10

/**
 * 流れ星を1本作る。
 * 長さと周期を別々に振るので、走る速さ（長さ÷走行時間）も毎回変わる。
 */
function makeStar(delay: number): Star {
  return {
    key: keySeq++,
    len: Math.round(rand(LEN_MIN, LEN_MAX)),
    head: round1(rand(2.2, 5.0)),
    sw: round1(rand(0.8, 1.8)),
    angle: round1(rand(ANGLE_MIN, ANGLE_MAX)),
    // 左下へ走るので、出現位置は右上寄りに散らす
    left: round1(rand(48, 112)),
    top: round1(rand(-6, 58)),
    duration: round1(rand(DUR_MIN, DUR_MAX)),
    delay,
  }
}

/**
 * 背景に流れ星を走らせる固定レイヤー（夜紺火花専用）。
 *
 * 先端の◯が進み、通った跡が線として引かれていく。
 * 線は stroke-dashoffset を詰めることで描画し、◯は同じ時間で同じ距離を移動するため、
 * ◯が常に線の先端に位置する。走り切ったあと全体をフェードアウトさせる。
 *
 * 1周するたびに、その1本だけを新しい軌跡へ差し替える。
 * 差し替えは animationiteration で行うので、常駐する処理は持たない。
 */
export function ShootingStars() {
  const [stars, setStars] = useState<Star[]>(() =>
    // 1本目だけすぐ走らせる。ONにした直後に何も起きないと反応が分からないため
    Array.from({ length: COUNT }, (_, i) =>
      makeStar(i === 0 ? round1(rand(0.2, 1.4)) : round1(rand(0, 28))),
    ),
  )

  const handleIteration = useCallback((index: number, e: AnimationEvent<SVGSVGElement>) => {
    if (e.target !== e.currentTarget) return
    if (e.animationName !== 'yako-star-flash') return
    setStars((prev) => {
      const next = [...prev]
      next[index] = makeStar(0)
      return next
    })
  }, [])

  return (
    <div className="yako-stars" aria-hidden="true">
      {stars.map((s, i) => {
        const w = s.len + PAD * 2
        return (
          <svg
            key={s.key}
            className="yako-star"
            width={w}
            height={BOX_H}
            viewBox={`0 0 ${w} ${BOX_H}`}
            focusable="false"
            onAnimationIteration={(e) => handleIteration(i, e)}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              // 進行方向が左下なので、+X 軸を 180-傾き 度に向ける
              transform: `rotate(${180 - s.angle}deg)`,
              transformOrigin: `${PAD}px ${BOX_H / 2}px`,
              ['--star-len' as string]: `${s.len}`,
            }}
          >
            <line
              className="yako-star__trail"
              x1={PAD}
              y1={BOX_H / 2}
              x2={PAD + s.len}
              y2={BOX_H / 2}
              stroke="var(--navy)"
              strokeWidth={s.sw}
              strokeLinecap="round"
            />
            <circle
              className="yako-star__head"
              cx={PAD}
              cy={BOX_H / 2}
              r={s.head}
              fill="none"
              stroke="var(--spark)"
              strokeWidth={1.6}
            />
          </svg>
        )
      })}
    </div>
  )
}
