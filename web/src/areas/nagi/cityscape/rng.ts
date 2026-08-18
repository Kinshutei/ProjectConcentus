import type { Rng, Weighted } from './types'

/**
 * mulberry32。シード固定の軽量PRNG。
 * Math.random() を直接使うと再レンダリングのたびに街並みが変わるため使用しない。
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** lo 以上 hi 以下の整数 */
export function randInt(r: Rng, lo: number, hi: number): number {
  return lo + Math.floor(r() * (hi - lo + 1))
}

/** 重み付き抽選 */
export function pickWeighted<T>(r: Rng, table: readonly Weighted<T>[]): T {
  let total = 0
  for (const [, w] of table) total += w
  let acc = 0
  const v = r() * total
  for (const [item, w] of table) {
    acc += w
    if (v < acc) return item
  }
  return table[0][0]
}

/** 次のシードを決定的に導出する */
export function nextSeed(seed: number): number {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0
}
