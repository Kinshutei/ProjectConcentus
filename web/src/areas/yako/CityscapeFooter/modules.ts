import { GROUND_Y } from './constants'
import { randInt } from './rng'
import type { Detail, ModuleFn, Point, Rng } from './types'

const GY = GROUND_Y

/** 高さに包絡線倍率を適用する。下限20pxでディテールの破綻を防ぐ */
const H = (v: number, m: number): number => Math.max(20, Math.round(v * m))

function line(
  x1: number, y1: number, x2: number, y2: number,
  sw = 1.2, accent = false,
): Detail {
  return { kind: 'line', x1, y1, x2, y2, sw, accent }
}

/** 窓グリッド。約15%の確率でアクセント色（点灯窓）になる */
function windowGrid(
  r: Rng, x0: number, top: number, w: number, h: number,
  cols: number, rows: number, cw: number, ch: number,
): Detail[] {
  const out: Detail[] = []
  const gx = (w - cols * cw) / (cols + 1)
  const gy = (h - rows * ch) / (rows + 1)
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      out.push({
        kind: 'rect',
        x: x0 + gx + i * (cw + gx),
        y: top + gy + j * (ch + gy),
        w: cw, h: ch, sw: 1.3,
        accent: r() < 0.15,
      })
    }
  }
  return out
}

function door(w: number): Detail {
  return { kind: 'rect', x: w / 2 - 6, y: GY - 15, w: 12, h: 15, sw: 1.3 }
}

/* ---------------- 低層 ---------------- */

/** 住居。切妻屋根 */
export const house: ModuleFn = (r, m) => {
  const w = randInt(r, 34, 48)
  const h = H(randInt(r, 42, 56), m)
  const roof = randInt(r, 14, 20)
  const profile: Point[] = [[0, h], [w / 2, h + roof], [w, h]]
  return { width: w, profile, details: [...windowGrid(r, 0, GY - h + 8, w, 20, 2, 1, 7, 7), door(w)] }
}

/** 商店。庇と大窓 */
export const shop: ModuleFn = (r, m) => {
  const w = randInt(r, 46, 64)
  const h = H(randInt(r, 34, 44), m)
  const details: Detail[] = [line(4, GY - h + 13, w - 4, GY - h + 13, 1.3)]
  for (let i = 1; i < 5; i++) {
    details.push(line((i * w) / 5, GY - h + 13, (i * w) / 5 - 4, GY - h + 22, 1))
  }
  details.push({ kind: 'rect', x: 7, y: GY - h + 26, w: w - 14, h: Math.max(6, h - 30), sw: 1.3 })
  return { width: w, profile: [[0, h], [w, h]], details }
}

/** 庁舎。ドーム */
export const dome: ModuleFn = (r, m) => {
  const w = randInt(r, 50, 64)
  const h = H(randInt(r, 54, 68), m)
  const dh = randInt(r, 16, 22)
  const c = w / 2
  const profile: Point[] = [
    [0, h], [c - 14, h], [c - 9, h + dh * 0.75], [c, h + dh],
    [c + 9, h + dh * 0.75], [c + 14, h], [w, h],
  ]
  const details = [
    ...windowGrid(r, 0, GY - h + 9, w, h - 24, 4, 2, 7, 7),
    line(c, GY - h - dh, c, GY - h - dh - 7, 1.2, true),
    door(w),
  ]
  return { width: w, profile, details }
}

/** 工場。建屋の脇に煙突 */
export const factory: ModuleFn = (r, m) => {
  const bw = randInt(r, 54, 72)
  const ch = H(randInt(r, 74, 98), m)
  const cw = 12
  const w = bw + cw + 8
  const hb = H(randInt(r, 36, 46), m)
  const cx = bw + 6
  const profile: Point[] = [[0, hb], [bw, hb], [cx, hb], [cx, ch], [cx + cw, ch], [cx + cw, hb], [w, hb]]
  const details: Detail[] = [
    ...windowGrid(r, 4, GY - hb + 8, bw - 8, Math.max(8, hb - 24), randInt(r, 4, 5), 1, 8, 8),
    { kind: 'rect', x: bw / 2 - 7, y: GY - 16, w: 14, h: 16, sw: 1.3 },
    line(cx + 1, GY - ch + 10, cx + cw - 1, GY - ch + 10, 1.3, true),
  ]
  return { width: w, profile, details }
}

/* ---------------- 高層 ---------------- */

/** 中層ビル */
export const midrise: ModuleFn = (r, m) => {
  const w = randInt(r, 48, 68)
  const h = H(randInt(r, 62, 86), m)
  const details = [
    ...windowGrid(r, 0, GY - h + 7, w, h - 22, randInt(r, 3, 4), randInt(r, 3, 4), 7, 7),
    door(w),
  ]
  return { width: w, profile: [[0, h], [w, h]], details }
}

/** 細身の高層 */
export const highrise: ModuleFn = (r, m) => {
  const w = randInt(r, 30, 42)
  const h = H(randInt(r, 104, 142), m)
  const details = [
    ...windowGrid(r, 0, GY - h + 8, w, h - 24, w > 36 ? 3 : 2, randInt(r, 7, 10), 6, 6),
    line(0, GY - h + 5, w, GY - h + 5, 1.3),
    door(w),
  ]
  return { width: w, profile: [[0, h], [w, h]], details }
}

/** 縦連窓の高層。窓を個別矩形ではなく縦のマリオン線で表現 */
export const curtain: ModuleFn = (r, m) => {
  const w = randInt(r, 46, 62)
  const h = H(randInt(r, 96, 126), m)
  const n = randInt(r, 4, 6)
  const top = GY - h + 9
  const bot = GY - 16
  const gx = (w - 8) / n
  const details: Detail[] = []
  for (let i = 0; i <= n; i++) details.push(line(4 + i * gx, top, 4 + i * gx, bot, 1.2))
  details.push(
    line(4, top, w - 4, top, 1.2),
    line(4, bot, w - 4, bot, 1.2),
    line(0, GY - h + 5, w, GY - h + 5, 1.3),
    door(w),
  )
  return { width: w, profile: [[0, h], [w, h]], details }
}

/** 階段状の塔（アールデコ型） */
export const setback: ModuleFn = (r, m) => {
  const w = randInt(r, 54, 72)
  const h1 = H(randInt(r, 66, 84), m)
  const h2 = h1 + H(randInt(r, 26, 46), m)
  const a = randInt(r, 10, 16)
  const profile: Point[] = [[0, h1], [a, h1], [a, h2], [w - a, h2], [w - a, h1], [w, h1]]
  const details = [
    ...windowGrid(r, 0, GY - h1 + 6, w, h1 - 20, 4, randInt(r, 3, 4), 6, 6),
    ...windowGrid(r, a, GY - h2 + 7, w - 2 * a, h2 - h1 - 4, 2, randInt(r, 3, 5), 6, 6),
    door(w),
  ]
  return { width: w, profile, details }
}

/** 尖塔＋アンテナ＋航空障害灯 */
export const spire: ModuleFn = (r, m) => {
  const w = randInt(r, 26, 34)
  const h = H(randInt(r, 92, 118), m)
  const tp = randInt(r, 16, 24)
  const ant = randInt(r, 12, 20)
  const profile: Point[] = [[0, h], [w / 2, h + tp], [w, h]]
  const details: Detail[] = [
    line(w / 2, GY - h - tp, w / 2, GY - h - tp - ant, 1.2),
    { kind: 'circle', cx: w / 2, cy: GY - h - tp - ant - 3, r: 2.6, sw: 1.2, accent: true },
    ...windowGrid(r, 0, GY - h + 8, w, h - 26, 2, randInt(r, 6, 8), 6, 6),
    door(w),
  ]
  return { width: w, profile, details }
}

/** 冠屋付き高層 */
export const crown: ModuleFn = (r, m) => {
  const w = randInt(r, 44, 58)
  const h = H(randInt(r, 92, 116), m)
  const a = randInt(r, 12, 16)
  const ch = randInt(r, 14, 20)
  const profile: Point[] = [[0, h], [a, h], [a, h + ch], [w - a, h + ch], [w - a, h], [w, h]]
  const details: Detail[] = [
    ...windowGrid(r, 0, GY - h + 8, w, h - 24, 3, randInt(r, 6, 8), 7, 7),
    line(w / 2, GY - h - ch, w / 2, GY - h - ch - 10, 1.2),
    { kind: 'circle', cx: w / 2, cy: GY - h - ch - 13, r: 2.6, sw: 1.2, accent: true },
    door(w),
  ]
  return { width: w, profile, details }
}

/** ツインタワー。低層部の上に高さの異なる2本 */
export const twin: ModuleFn = (r, m) => {
  const sw = randInt(r, 22, 28)
  const gp = randInt(r, 10, 16)
  const w = sw * 2 + gp + 12
  const hp = H(randInt(r, 32, 42), m)
  const hL = hp + H(randInt(r, 50, 74), m)
  const hR = hp + H(randInt(r, 34, 60), m)
  const xa = 6
  const xb = 6 + sw + gp
  const profile: Point[] = [
    [0, hp], [xa, hp], [xa, hL], [xa + sw, hL], [xa + sw, hp],
    [xb, hp], [xb, hR], [xb + sw, hR], [xb + sw, hp], [w, hp],
  ]
  const details = [
    ...windowGrid(r, xa, GY - hL + 8, sw, hL - hp - 16, 2, randInt(r, 5, 7), 6, 6),
    ...windowGrid(r, xb, GY - hR + 8, sw, hR - hp - 16, 2, randInt(r, 4, 6), 6, 6),
    ...windowGrid(r, 4, GY - hp + 7, w - 8, Math.max(8, hp - 24), randInt(r, 4, 5), 1, 7, 7),
    door(w),
  ]
  return { width: w, profile, details }
}

/** 鉄塔。台形の輪郭に横桟とXブレース */
export const lattice: ModuleFn = (r, m) => {
  const w = randInt(r, 36, 46)
  const h = H(randInt(r, 110, 138), m)
  const tw = randInt(r, 10, 14)
  const lx = (w - tw) / 2
  const seg = 5
  const details: Detail[] = []
  for (let i = 1; i < seg; i++) {
    const t0 = i / seg
    const t1 = (i - 1) / seg
    const y0 = GY - h * t0
    const y1 = GY - h * t1
    const a0 = w / 2 - (w / 2 - lx) * t0
    const b0 = w / 2 + (w / 2 - lx) * t0
    const a1 = w / 2 - (w / 2 - lx) * t1
    const b1 = w / 2 + (w / 2 - lx) * t1
    details.push(line(a0, y0, b0, y0, 1.1), line(a1, y1, b0, y0, 1), line(b1, y1, a0, y0, 1))
  }
  details.push(
    line(w / 2, GY - h, w / 2, GY - h - 3, 1.2),
    { kind: 'circle', cx: w / 2, cy: GY - h - 6, r: 3, sw: 1.3, accent: true },
  )
  return { width: w, profile: [[lx, h], [w - lx, h]], details }
}

/* ---------------- 添景 ---------------- */

/**
 * 樹木。幹を上がり、樹冠の左下・頂点・右下を経て幹に戻り地面へ降りる。
 * 幹と樹冠の底辺を二度なぞるため線が重なるが、見た目は通常の三角形と幹になる。
 */
export const tree: ModuleFn = (r, m) => {
  const w = 28
  const c = 14
  const tr = randInt(r, 14, 20)
  const fw = randInt(r, 11, 13)
  const h = tr + H(randInt(r, 30, 46), m)
  const profile: Point[] = [[c, 0], [c, tr], [c - fw, tr], [c, h], [c + fw, tr], [c, tr], [c, 0]]
  return { width: w, profile, details: [] }
}

/** 街灯。支柱は同一X座標を往復するため1本の線に見える */
export const lamp: ModuleFn = (r) => {
  const w = 16
  const c = 8
  const h = randInt(r, 34, 46)
  return {
    width: w,
    profile: [[c, 0], [c, h], [c, 0]],
    details: [{ kind: 'circle', cx: c, cy: GY - h - 4, r: 4.2, sw: 1.4, accent: true }],
  }
}

/** 信号機。支柱のみ輪郭に乗せ、箱と灯はディテール */
export const signal: ModuleFn = (r) => {
  const w = 18
  const c = 9
  const h = randInt(r, 36, 48)
  const top = GY - h - 24
  const details: Detail[] = [
    { kind: 'rect', x: c - 6, y: top, w: 12, h: 24, rx: 4, sw: 1.4 },
  ]
  for (let i = 0; i < 3; i++) {
    details.push({ kind: 'circle', cx: c, cy: top + 6 + i * 6, r: 2, sw: 1.2, accent: i === 2 })
  }
  return { width: w, profile: [[c, 0], [c, h], [c, 0]], details }
}
