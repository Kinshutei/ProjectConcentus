import { CONSTELLATION_SIZE, SLOT_SPREAD } from './constants'
import type { Constellation, SlotState } from './types'

let slotKeySeq = 0

/**
 * スロット1本ぶんの状態を作る。
 * exclude には使用中の id と group の両方を積む。
 */
export function makeSlot(
  pool: Constellation[],
  exclude: Set<string>,
  bandRatio: number,
): SlotState {
  const avail = pool.filter(
    (c) => !exclude.has(c.id) && (c.group === undefined || !exclude.has(c.group)),
  )
  const src = avail.length > 0 ? avail : pool
  const c = src[Math.floor(Math.random() * src.length)]

  const [minS, maxS] = CONSTELLATION_SIZE
  return {
    key: slotKeySeq++,
    constellation: c,
    topRatio: 0.5 + (Math.random() - 0.5) * bandRatio * SLOT_SPREAD,
    size: (minS + Math.random() * (maxS - minS)) * c.scale,
  }
}
