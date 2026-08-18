import { FLOOR_H, GROUND_Y, PARAPET_H } from './constants'
import { randInt } from './rng'
import type { Detail, ModuleFn, ModuleShape, Point, Rng } from './types'

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

/* ---------------- 汎用高層（追加2種） ---------------- */

/** 高さを階数で量子化する。窓の段が半端な位置で切れるのを防ぐ */
function quantizeHeight(raw: number, minFloors: number): [number, number] {
  const floors = Math.max(minFloors, Math.round((raw - PARAPET_H) / FLOOR_H))
  return [PARAPET_H + floors * FLOOR_H, floors]
}

/** 点灯窓の配置。約15%が点灯する */
function litMask(r: Rng, cols: number, rows: number): boolean[][] {
  const out: boolean[][] = []
  for (let j = 0; j < rows; j++) {
    const row: boolean[] = []
    for (let i = 0; i < cols; i++) row.push(r() < 0.15)
    out.push(row)
  }
  return out
}

/** 先細り塔。上ほど両側が絞られる */
export const tapered: ModuleFn = (r, m) => {
  const w = 22 + r() * 12
  const [h, floors] = quantizeHeight((86 + r() * 46) * m, 8)
  const shrink = w * (0.14 + r() * 0.12)
  const knee = h * (0.55 + r() * 0.15)

  const details: Detail[] = []
  const cols = Math.max(2, Math.floor((w - 8) / 9))
  const lit = litMask(r, cols, floors)
  for (let f = 0; f < floors; f++) {
    const y = GY - (PARAPET_H + (f + 1) * FLOOR_H) + 3
    const t = Math.max(0, (PARAPET_H + f * FLOOR_H - knee) / (h - knee))
    const inX = shrink * Math.max(0, t)
    const cw = (w - 8 - inX * 2) / cols
    for (let c = 0; c < cols; c++) {
      details.push({
        kind: 'rect', x: 4 + inX + cw * c + 1, y, w: cw - 2, h: FLOOR_H - 5,
        sw: 1.2, accent: lit[f][c],
      })
    }
  }

  return {
    width: w,
    profile: [[0, 0], [0, knee], [shrink, h], [w - shrink, h], [w, knee], [w, 0]],
    details,
    profileMode: 'full',
  }
}

/** 低層部の上に塔が乗る形。都心・業務の密度を上げる */
export const podiumTower: ModuleFn = (r, m) => {
  const w = 34 + r() * 16
  const [h, floors] = quantizeHeight((74 + r() * 40) * m, 7)
  const podFloors = 2 + Math.floor(r() * 2)
  const podH = PARAPET_H + podFloors * FLOOR_H
  const inset = w * (0.16 + r() * 0.08)

  const details: Detail[] = []
  const towerW = w - inset * 2
  const cols = Math.max(2, Math.floor((towerW - 6) / 9))
  const lit = litMask(r, cols, Math.max(1, floors - podFloors))
  const cw = (towerW - 6) / cols
  for (let f = podFloors; f < floors; f++) {
    const y = GY - (PARAPET_H + (f + 1) * FLOOR_H) + 3
    for (let c = 0; c < cols; c++) {
      details.push({
        kind: 'rect', x: inset + 3 + cw * c + 1, y, w: cw - 2, h: FLOOR_H - 5,
        sw: 1.2, accent: lit[f - podFloors][c],
      })
    }
  }

  return {
    width: w,
    profile: [
      [0, 0], [0, podH], [inset, podH], [inset, h],
      [w - inset, h], [w - inset, podH], [w, podH], [w, 0],
    ],
    details,
    profileMode: 'full',
  }
}

/* ---------------- ランドマーク ---------------- */

/**
 * 左半分の点列を鏡映して全輪郭にする。
 * 入力の x は塔の中心を原点とした値（負が左）。
 */
function mirrorTower(left: Point[], w: number): Point[] {
  const half = w / 2
  const l = left.map(([x, h]) => [half + x, h] as Point)
  const r = [...left].reverse().map(([x, h]) => [half - x, h] as Point)
  return [...l, ...r]
}

/**
 * 格子塔。裾が広く、指数曲線で絞りながら立ち上がる。展望台を2段持つ。
 * 実在建築の忠実な複製ではなく、類型としてのシルエットとして生成する。
 */
export const landmarkTower = (r: Rng): ModuleShape => {
  const half = 21 + r() * 6
  const TH = 106 + r() * 22
  const p = 1.6 + r() * 0.25
  const shape = (t: number) => -half * Math.pow(1 - t, p)

  const decks = [
    { t: 0.38 + r() * 0.05, out: -5.0 - r() * 1.5, th: 0.03 },
    { t: 0.7 + r() * 0.04, out: -3.0 - r() * 1.0, th: 0.022 },
  ]
  const antT = 0.87
  const antW = -1.0

  const left: Point[] = []
  let lastT = -1
  const push = (x: number, t: number) => { left.push([x, t * TH]); lastT = t }

  let di = 0
  const STEPS = 18
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * antT
    while (di < decks.length && decks[di].t <= t) {
      const dk = decks[di]
      push(shape(dk.t), dk.t)
      push(shape(dk.t) + dk.out, dk.t)
      push(shape(dk.t) + dk.out, dk.t + dk.th)
      push(shape(dk.t + dk.th), dk.t + dk.th)
      di++
    }
    if (t > lastT) push(shape(t), t)
  }
  push(antW, antT)
  push(antW, 1)

  const w = half * 2
  return {
    width: w,
    profile: mirrorTower(left, w),
    details: [],
    profileMode: 'full',
    absoluteHeight: true,
  }
}

/** 自立塔。裾で急に絞り、上部が細長い小塔になる。3種で最も高い */
export const landmarkSpine = (r: Rng): ModuleShape => {
  const half = 14 + r() * 4
  const TH = 146 + r() * 24
  const neck = 0.78
  const shape = (t: number) => -half * 0.8 * Math.pow((1 - t) / 0.94, 2.15)

  const decks = [
    { t: 0.5 + r() * 0.04, out: -4.0 - r() * 1.2, th: 0.026 },
    { t: 0.68 + r() * 0.03, out: -2.6 - r() * 0.8, th: 0.018 },
  ]

  const left: Point[] = [[-half, 0]]
  let lastT = 0
  const push = (x: number, t: number) => { left.push([x, t * TH]); lastT = t }
  push(shape(0.06), 0.06)

  let di = 0
  const STEPS = 16
  for (let i = 1; i <= STEPS; i++) {
    const t = 0.06 + ((neck - 0.06) * i) / STEPS
    while (di < decks.length && decks[di].t <= t) {
      const dk = decks[di]
      push(shape(dk.t), dk.t)
      push(shape(dk.t) + dk.out, dk.t)
      push(shape(dk.t) + dk.out, dk.t + dk.th)
      push(shape(dk.t + dk.th), dk.t + dk.th)
      di++
    }
    if (t > lastT) push(shape(t), t)
  }
  push(-0.9, neck)
  push(-0.9, 1)

  const w = half * 2
  return {
    width: w,
    profile: mirrorTower(left, w),
    details: [],
    profileMode: 'full',
    absoluteHeight: true,
  }
}

/** 双塔庁舎。基壇から立ち上がった塔が上部で二本に割れる */
export const landmarkTwinTower = (r: Rng): ModuleShape => {
  const w = 58 + r() * 14
  const TH = 84 + r() * 18
  const podH = TH * (0.24 + r() * 0.05)
  const inset = w * 0.055
  const shoulderH = TH * 0.85
  const shoulderIn = w * 0.045
  const splitH = TH * (0.56 + r() * 0.06)
  const tw = w * 0.33
  const mastX = inset + shoulderIn + (tw - inset - shoulderIn) * 0.5

  const left: Point[] = ([
    [0, 0], [0, podH],
    [inset, podH], [inset, shoulderH],
    [inset + shoulderIn, shoulderH], [inset + shoulderIn, TH],
    [mastX - 0.8, TH], [mastX - 0.8, TH + 6], [mastX + 0.8, TH + 6], [mastX + 0.8, TH],
    [inset + tw, TH], [inset + tw, splitH],
    [w / 2, splitH],
  ] as Point[]).map(([x, h]) => [x - w / 2, h] as Point)

  // 主層に置いたときだけ使われる。遠景層は detailLevel 0 なので描かれない
  const details: Detail[] = []
  const mull = 5
  for (let s = 0; s < 2; s++) {
    const x0 = s === 0 ? inset : w - inset - tw
    for (let i = 1; i < mull; i++) {
      const mx = x0 + ((tw - inset) / mull) * i
      details.push({ kind: 'line', x1: mx, y1: GY - shoulderH, x2: mx, y2: GY - podH, sw: 0.7 })
    }
  }

  return {
    width: w,
    profile: mirrorTower(left, w),
    details,
    profileMode: 'full',
    absoluteHeight: true,
  }
}
