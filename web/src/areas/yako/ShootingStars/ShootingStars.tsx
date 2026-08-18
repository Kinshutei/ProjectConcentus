import { useMemo } from 'react'
import './ShootingStars.css'
import { createRng } from '../CityscapeFooter/rng'
import type { Rng } from '../CityscapeFooter/types'

const DEFAULT_SEED = 20260812
const COUNT = 7

/** 進行方向。水平から浅く傾け、右上から左下へ走らせる */
const ANGLE_DEG = 20

/** 走る距離のレンジ（px）。そのまま軌跡の線の長さになる */
const LEN_MIN = 420
const LEN_MAX = 780

/** 先端の◯を置く余白 */
const PAD = 10
const BOX_H = 22

interface Star {
  id: number
  /** 軌跡の長さ */
  len: number
  /** 先端の◯の半径 */
  head: number
  /** 軌跡の線幅 */
  sw: number
  /** 出現位置（%） */
  left: number
  top: number
  /** 1周期（秒）。走って見えるのはこのうち約2%だけ */
  duration: number
  delay: number
}

const rand = (r: Rng, lo: number, hi: number) => lo + r() * (hi - lo)
const round1 = (v: number) => Math.round(v * 10) / 10

function buildStars(seed: number): Star[] {
  const r = createRng(seed)
  return Array.from({ length: COUNT }, (_, id) => ({
    id,
    len: Math.round(rand(r, LEN_MIN, LEN_MAX)),
    head: round1(rand(r, 2.6, 4.2)),
    sw: round1(rand(r, 0.9, 1.4)),
    // 左下へ走るので、出現位置は右上寄りに散らす
    left: round1(rand(r, 48, 112)),
    top: round1(rand(r, -6, 58)),
    duration: round1(rand(r, 15, 34)),
    // 1本目だけすぐ走らせる。ONにした直後に何も起きないと反応が分からないため
    delay: id === 0 ? round1(rand(r, 0.2, 1.4)) : round1(rand(r, 0, 28)),
  }))
}

export interface ShootingStarsProps {
  /** 星の並びを決めるシード。同じ値なら常に同じ降り方になる */
  seed?: number
}

/**
 * 背景に流れ星を走らせる固定レイヤー。
 *
 * 先端の◯が進み、通った跡が線として引かれていく。
 * 線は stroke-dashoffset を詰めることで描画し、◯は同じ時間で同じ距離を移動するため、
 * ◯が常に線の先端に位置する。走り切ったあと全体をフェードアウトさせる。
 *
 * 生成時だけJSが動き、あとはCSSアニメーションのみで完結する。
 */
export function ShootingStars({ seed = DEFAULT_SEED }: ShootingStarsProps) {
  const stars = useMemo(() => buildStars(seed), [seed])

  // 進行方向が左下なので、+X 軸を 180-20 度に向ける
  const angle = 180 - ANGLE_DEG

  return (
    <div className="stars-layer" aria-hidden="true">
      {stars.map((s) => {
        const w = s.len + PAD * 2
        return (
          <svg
            key={s.id}
            className="star"
            width={w}
            height={BOX_H}
            viewBox={`0 0 ${w} ${BOX_H}`}
            focusable="false"
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              animationDuration: `${s.duration}s`,
              animationDelay: `${s.delay}s`,
              transform: `rotate(${angle}deg)`,
              transformOrigin: `${PAD}px ${BOX_H / 2}px`,
              ['--star-len' as string]: `${s.len}`,
            }}
          >
            <line
              className="star__trail"
              x1={PAD}
              y1={BOX_H / 2}
              x2={PAD + s.len}
              y2={BOX_H / 2}
              stroke="var(--navy)"
              strokeWidth={s.sw}
              strokeLinecap="round"
            />
            <circle
              className="star__head"
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
