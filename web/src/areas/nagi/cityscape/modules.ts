import { FLOOR_H, GROUND_Y, PARAPET_H } from './constants'
import { randInt } from './rng'
import type { Detail, ModuleFn, ModuleShape, Point, Rng } from './types'

const GY = GROUND_Y

/** 高さに包絡線倍率を適用する。下限20pxでディテールの破綻を防ぐ */
const H = (v: number, m: number): number => Math.max(20, Math.round(v * m))

/**
 * 建物高さを階高の倍数へ丸める。戻り値は [丸めた高さ, 階数]。
 * 隣り合う建物の窓の高さが揃い、街並みに水平のリズムが出る。
 */
export function quantizeHeight(h: number, minFloors = 1): [number, number] {
  const floors = Math.max(minFloors, Math.round((h - PARAPET_H) / FLOOR_H))
  return [floors * FLOOR_H + PARAPET_H, floors]
}

/**
 * 点灯窓のマスク。左隣または下階が点灯していれば点灯しやすくなる。
 * 必ず cols × rows 回だけ乱数を消費するので、2パス生成を壊さない。
 */
export function litMask(
  r: Rng, cols: number, rows: number, baseRate = 0.16, cluster = 0.5,
): boolean[][] {
  const m: boolean[][] = []
  for (let j = 0; j < rows; j++) {
    const row: boolean[] = []
    for (let c = 0; c < cols; c++) {
      const near = (c > 0 && row[c - 1]) || (j > 0 && m[j - 1][c])
      const p = near ? baseRate + cluster * (1 - baseRate) : baseRate
      row.push(r() < p)
    }
    m.push(row)
  }
  return m
}

/** 階高に沿って窓を並べる。行数は floors から導く */
function floorWindows(
  w: number, floors: number, cols: number, lit: boolean[][], from = 0,
): Detail[] {
  const out: Detail[] = []
  const cw = (w - 4) / cols
  for (let f = from; f < floors; f++) {
    const y = GY - PARAPET_H - (f + 1) * FLOOR_H + 3
    for (let c = 0; c < cols; c++) {
      out.push({
        kind: 'rect', x: 2 + cw * c + 1, y, w: cw - 2, h: FLOOR_H - 5,
        sw: 1.2, accent: lit[f - from][c],
      })
    }
  }
  return out
}

const colsFor = (w: number) => Math.max(2, Math.floor((w - 8) / 9))

function line(
  x1: number, y1: number, x2: number, y2: number,
  sw = 1.2, accent = false,
): Detail {
  return { kind: 'line', x1, y1, x2, y2, sw, accent }
}

/**
 * 屋上ラインを返す。始点 [0, h]・終点 [w, h] を必ず含む。
 * 塔屋・給水塔・セットバックを輪郭パスの一部として描くので、
 * 単一パス構成のままスカイラインの情報量が上がる。
 */
export function roofProfile(r: Rng, w: number, h: number): Point[] {
  const v = r()

  // 塔屋（エレベーター機械室）
  if (v < 0.3 && w > 18) {
    const pw = Math.min(w * (0.22 + r() * 0.2), w - 8)
    const px = 3 + r() * (w - pw - 6)
    const ph = 5 + Math.round(r() * 5)
    return [[0, h], [px, h], [px, h + ph], [px + pw, h + ph], [px + pw, h], [w, h]]
  }

  // 給水塔（脚つき）
  if (v < 0.48 && w > 22) {
    const cx = w * (0.3 + r() * 0.4)
    const tw = 7 + r() * 4
    const leg = 4 + r() * 3
    const th = 7 + r() * 4
    const o = 1.6
    return [
      [0, h], [cx - tw / 2, h], [cx - tw / 2, h + leg],
      [cx - tw / 2 - o, h + leg], [cx - tw / 2 - o, h + leg + th],
      [cx + tw / 2 + o, h + leg + th], [cx + tw / 2 + o, h + leg],
      [cx + tw / 2, h + leg], [cx + tw / 2, h], [w, h],
    ]
  }

  // 二段セットバック
  if (v < 0.66 && w > 26) {
    const inset = 3 + r() * 4
    const step = 6 + r() * 6
    return [[0, h], [inset, h], [inset, h + step], [w - inset, h + step], [w - inset, h], [w, h]]
  }

  // 素の陸屋根
  return [[0, h], [w, h]]
}

/* ---------------- 低層 ---------------- */

/** 住居。切妻屋根 */
export const house: ModuleFn = (r, m) => {
  const w = randInt(r, 34, 48)
  const [h, floors] = quantizeHeight(H(randInt(r, 42, 56), m), 2)
  const roof = randInt(r, 14, 20)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: [[0, h], [w / 2, h + roof], [w, h]],
    details: floorWindows(w, floors, cols, lit),
  }
}

/** 商店。庇と大窓 */
export const shop: ModuleFn = (r, m) => {
  const w = randInt(r, 46, 64)
  const [h, floors] = quantizeHeight(H(randInt(r, 34, 44), m), 2)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: [[0, h], [w, h]],
    details: floorWindows(w, floors, cols, lit, 1),
  }
}

/** 庁舎。ドーム */
export const dome: ModuleFn = (r, m) => {
  const w = randInt(r, 50, 64)
  const [h, floors] = quantizeHeight(H(randInt(r, 54, 68), m), 3)
  const dh = randInt(r, 16, 22)
  const c = w / 2
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: [
      [0, h], [c - 14, h], [c - 9, h + dh * 0.75], [c, h + dh],
      [c + 9, h + dh * 0.75], [c + 14, h], [w, h],
    ],
    details: [
      ...floorWindows(w, floors, cols, lit, 1),
      line(c, GY - h - dh, c, GY - h - dh - 7, 1.2, true),
    ],
  }
}

/** 工場。建屋の脇に煙突 */
export const factory: ModuleFn = (r, m) => {
  const bw = randInt(r, 54, 72)
  const ch = H(randInt(r, 74, 98), m)
  const cw = 12
  const w = bw + cw + 8
  const [hb, floors] = quantizeHeight(H(randInt(r, 36, 46), m), 2)
  const cx = bw + 6
  const cols = colsFor(bw)
  const lit = litMask(r, cols, floors)
  const wins = floorWindows(bw, floors, cols, lit, 1)
  return {
    width: w,
    profile: [[0, hb], [bw, hb], [cx, hb], [cx, ch], [cx + cw, ch], [cx + cw, hb], [w, hb]],
    details: [
      ...wins,
      line(cx + 1, GY - ch + 10, cx + cw - 1, GY - ch + 10, 1.3, true),
    ],
  }
}

/* ---------------- 高層 ---------------- */

/** 中層ビル */
export const midrise: ModuleFn = (r, m) => {
  const w = randInt(r, 48, 68)
  const [h, floors] = quantizeHeight(H(randInt(r, 62, 86), m), 3)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: roofProfile(r, w, h),
    details: floorWindows(w, floors, cols, lit, 1),
  }
}

/** 細身の高層 */
export const highrise: ModuleFn = (r, m) => {
  const w = randInt(r, 30, 42)
  const [h, floors] = quantizeHeight(H(randInt(r, 104, 142), m), 6)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: roofProfile(r, w, h),
    details: floorWindows(w, floors, cols, lit, 1),
  }
}

/** 縦連窓の高層。窓を個別矩形ではなく縦のマリオン線で表現 */
export const curtain: ModuleFn = (r, m) => {
  const w = randInt(r, 46, 62)
  const [h, floors] = quantizeHeight(H(randInt(r, 96, 126), m), 6)
  const n = randInt(r, 4, 6)
  const top = GY - PARAPET_H - floors * FLOOR_H + 2
  const bot = GY - FLOOR_H
  const gx = (w - 8) / n
  const details: Detail[] = []
  for (let i = 0; i <= n; i++) details.push(line(4 + i * gx, top, 4 + i * gx, bot, 1.2))
  // 階の位置に横桟を通し、隣の建物と水平線が揃うようにする
  for (let f = 1; f < floors; f++) {
    const y = GY - PARAPET_H - f * FLOOR_H
    details.push(line(4, y, w - 4, y, 0.8))
  }
  details.push(line(0, GY - h + 3, w, GY - h + 3, 1.3))
  return { width: w, profile: roofProfile(r, w, h), details }
}

/** 階段状の塔（アールデコ型） */
export const setback: ModuleFn = (r, m) => {
  const w = randInt(r, 54, 72)
  const [h1, f1] = quantizeHeight(H(randInt(r, 66, 84), m), 4)
  const [h2, f2] = quantizeHeight(h1 + H(randInt(r, 26, 46), m), f1 + 2)
  const a = randInt(r, 10, 16)
  const cols = colsFor(w)
  const litLo = litMask(r, cols, f1)
  const colsUp = Math.max(2, colsFor(w - 2 * a))
  const litUp = litMask(r, colsUp, f2 - f1)
  const details = [...floorWindows(w, f1, cols, litLo, 1)]
  const cwUp = (w - 2 * a - 4) / colsUp
  for (let f = f1; f < f2; f++) {
    const y = GY - PARAPET_H - (f + 1) * FLOOR_H + 3
    for (let c = 0; c < colsUp; c++) {
      details.push({
        kind: 'rect', x: a + 2 + cwUp * c + 1, y, w: cwUp - 2, h: FLOOR_H - 5,
        sw: 1.2, accent: litUp[f - f1][c],
      })
    }
  }
  return {
    width: w,
    profile: [[0, h1], [a, h1], [a, h2], [w - a, h2], [w - a, h1], [w, h1]],
    details,
  }
}

/** 尖塔＋アンテナ＋航空障害灯 */
export const spire: ModuleFn = (r, m) => {
  const w = randInt(r, 26, 34)
  const [h, floors] = quantizeHeight(H(randInt(r, 92, 118), m), 6)
  const tp = randInt(r, 16, 24)
  const ant = randInt(r, 12, 20)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: [[0, h], [w / 2, h + tp], [w, h]],
    details: [
      line(w / 2, GY - h - tp, w / 2, GY - h - tp - ant, 1.2),
      { kind: 'circle', cx: w / 2, cy: GY - h - tp - ant - 3, r: 2.6, sw: 1.2, accent: true },
      ...floorWindows(w, floors, cols, lit, 1),
    ],
  }
}

/** 冠屋付き高層 */
export const crown: ModuleFn = (r, m) => {
  const w = randInt(r, 44, 58)
  const [h, floors] = quantizeHeight(H(randInt(r, 92, 116), m), 6)
  const a = randInt(r, 12, 16)
  const ch = randInt(r, 14, 20)
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  return {
    width: w,
    profile: [[0, h], [a, h], [a, h + ch], [w - a, h + ch], [w - a, h], [w, h]],
    details: [
      ...floorWindows(w, floors, cols, lit, 1),
      line(w / 2, GY - h - ch, w / 2, GY - h - ch - 10, 1.2),
      { kind: 'circle', cx: w / 2, cy: GY - h - ch - 13, r: 2.6, sw: 1.2, accent: true },
    ],
  }
}

/** ツインタワー。低層部の上に高さの異なる2本 */
export const twin: ModuleFn = (r, m) => {
  const sw = randInt(r, 22, 28)
  const gp = randInt(r, 10, 16)
  const w = sw * 2 + gp + 12
  const [hp, fp] = quantizeHeight(H(randInt(r, 32, 42), m), 2)
  const [hL, fL] = quantizeHeight(hp + H(randInt(r, 50, 74), m), fp + 3)
  const [hR, fR] = quantizeHeight(hp + H(randInt(r, 34, 60), m), fp + 2)
  const xa = 6
  const xb = 6 + sw + gp
  const colsT = Math.max(2, colsFor(sw))
  const litL = litMask(r, colsT, fL - fp)
  const litR = litMask(r, colsT, fR - fp)
  const colsP = colsFor(w)
  const litP = litMask(r, colsP, fp)

  const details: Detail[] = [...floorWindows(w, fp, colsP, litP, 1)]
  const cwT = (sw - 4) / colsT
  const tower = (x0: number, from: number, to: number, lit: boolean[][]) => {
    for (let f = from; f < to; f++) {
      const y = GY - PARAPET_H - (f + 1) * FLOOR_H + 3
      for (let c = 0; c < colsT; c++) {
        details.push({
          kind: 'rect', x: x0 + 2 + cwT * c + 1, y, w: cwT - 2, h: FLOOR_H - 5,
          sw: 1.2, accent: lit[f - from][c],
        })
      }
    }
  }
  tower(xa, fp, fL, litL)
  tower(xb, fp, fR, litR)

  return {
    width: w,
    profile: [
      [0, hp], [xa, hp], [xa, hL], [xa + sw, hL], [xa + sw, hp],
      [xb, hp], [xb, hR], [xb + sw, hR], [xb + sw, hp], [w, hp],
    ],
    details,
  }
}

/** 鉄塔。台形の輪郭に横桟とXブレース。階高を持たないので量子化しない */
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
  return { width: w, profile: [[lx, h], [w - lx, h]], details, groundFloor: false }
}

/* ---------------- 汎用高層（v2.1 §5） ---------------- */

/** 先細り塔。上ほど両側が絞られる */
export const tapered: ModuleFn = (r, m) => {
  const w = 22 + r() * 12
  const [h, floors] = quantizeHeight(H(86 + r() * 46, m), 8)
  const shrink = w * (0.14 + r() * 0.12)
  const knee = h * (0.55 + r() * 0.15)

  const details: Detail[] = []
  const cols = colsFor(w)
  const lit = litMask(r, cols, floors)
  for (let f = 1; f < floors; f++) {
    const y = GY - PARAPET_H - (f + 1) * FLOOR_H + 3
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
  const [h, floors] = quantizeHeight(H(74 + r() * 40, m), 7)
  const podFloors = 2 + Math.floor(r() * 2)
  const podH = PARAPET_H + podFloors * FLOOR_H
  const inset = w * (0.16 + r() * 0.08)

  const details: Detail[] = []
  const towerW = w - inset * 2
  const cols = Math.max(2, Math.floor((towerW - 6) / 9))
  const lit = litMask(r, cols, Math.max(1, floors - podFloors))
  const cw = (towerW - 6) / cols
  for (let f = podFloors; f < floors; f++) {
    const y = GY - PARAPET_H - (f + 1) * FLOOR_H + 3
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

/* ---------------- 添景 ---------------- */

/** 広葉樹。不規則な円弧の連なり */
function crownBroad(r: Rng, cx: number, base: number, rad: number): Point[] {
  const pts: Point[] = []
  const n = 7 + Math.floor(r() * 3)
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * (1 - i / n)
    const rr = rad * (0.86 + r() * 0.28)
    pts.push([cx + Math.cos(t) * rr, base + Math.sin(t) * rr * 0.92])
  }
  return pts
}

/** 針葉樹。三角の段重ね */
function crownConifer(r: Rng, cx: number, base: number, rad: number): Point[] {
  const tiers = 3
  const pts: Point[] = []
  const h = rad * 2.4
  for (let i = 0; i < tiers; i++) {
    const y = base + (h / tiers) * i
    const wr = rad * (1 - i / (tiers + 0.6))
    pts.push([cx - wr, y], [cx - wr * 0.55, y + (h / tiers) * 0.55])
  }
  pts.push([cx, base + h])
  for (let i = tiers - 1; i >= 0; i--) {
    const y = base + (h / tiers) * i
    const wr = rad * (1 - i / (tiers + 0.6))
    pts.push([cx + wr * 0.55, y + (h / tiers) * 0.55], [cx + wr, y])
  }
  // 針葉樹だけ乱数の消費数が変わらないよう、形は決定的に組む
  void r
  return pts
}

/** 刈込街路樹。ほぼ楕円 */
function crownTrimmed(cx: number, base: number, rad: number): Point[] {
  const pts: Point[] = []
  const n = 10
  for (let i = 0; i <= n; i++) {
    const t = Math.PI * (1 - i / n)
    pts.push([cx + Math.cos(t) * rad, base + Math.sin(t) * rad * 1.15])
  }
  return pts
}

/** 幹を上がって樹冠を回り、幹を降りて地面へ戻る */
function treeShape(crownPts: Point[], w: number, c: number, trunk: number): ModuleShape {
  return {
    width: w,
    profile: [[c, 0], [c, trunk], ...crownPts, [c, trunk], [c, 0]],
    details: [],
    groundFloor: false,
  }
}

/** 広葉樹 */
export const treeBroad: ModuleFn = (r, m) => {
  const w = 30
  const c = 15
  const trunk = randInt(r, 12, 18)
  const rad = H(randInt(r, 13, 18), m)
  return treeShape(crownBroad(r, c, trunk, rad), w, c, trunk)
}

/** 針葉樹 */
export const treeConifer: ModuleFn = (r, m) => {
  const w = 26
  const c = 13
  const trunk = randInt(r, 8, 12)
  const rad = H(randInt(r, 9, 13), m)
  return treeShape(crownConifer(r, c, trunk, rad), w, c, trunk)
}

/** 刈込街路樹 */
export const treeTrimmed: ModuleFn = (r, m) => {
  const w = 26
  const c = 13
  const trunk = randInt(r, 14, 20)
  const rad = H(randInt(r, 9, 12), m)
  return treeShape(crownTrimmed(c, trunk, rad), w, c, trunk)
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
    groundFloor: false,
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
  return { width: w, profile: [[c, 0], [c, h], [c, 0]], details, groundFloor: false }
}

/** 電柱。柱は輪郭に乗せ、腕木2本もそのまま輪郭で描く。電線は生成器がまとめて張る */
export const pole: ModuleFn = (r) => {
  const w = 14
  const c = 7
  const h = randInt(r, 52, 64)
  const arm = 5.5
  return {
    width: w,
    profile: [
      [c, 0], [c, h - 9], [c - arm, h - 9], [c, h - 9],
      [c, h - 3], [c - arm, h - 3], [c, h - 3],
      [c, h], [c, h - 3], [c + arm, h - 3], [c, h - 3],
      [c, h - 9], [c + arm, h - 9], [c, h - 9], [c, 0],
    ],
    details: [],
    groundFloor: false,
    pole: { top: h },
  }
}

/* ---------------- ランドマーク（v2.1 §2） ---------------- */

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
    groundFloor: false,
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
    groundFloor: false,
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

  // 主層に置いたときだけ使われる。遠景層は detailLevel 0 なので描かれない。
  // 実装の Detail の y は viewBox 絶対座標なので GY からの引き算で持つ
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
    groundFloor: false,
  }
}

/* ---------------- 低層部の地区差（v2 §6.4） ---------------- */

export type GroundFloor = 'glass' | 'entrance' | 'shutter' | 'none'

/** 1階の表情。建物の輪郭が決まったあとに生成器から重ねる */
export function groundFloorDetails(r: Rng, kind: GroundFloor, w: number): Detail[] {
  const d: Detail[] = []
  const top = GY - FLOOR_H + 2

  if (kind === 'glass') {
    d.push({ kind: 'rect', x: 2, y: top, w: w - 4, h: FLOOR_H - 3, sw: 1.1 })
    const mullions = Math.max(1, Math.floor((w - 4) / 7))
    for (let i = 1; i < mullions; i++) {
      const mx = 2 + ((w - 4) / mullions) * i
      d.push({ kind: 'line', x1: mx, y1: top, x2: mx, y2: GY - 1, sw: 0.8 })
    }
  } else if (kind === 'entrance') {
    const dw = 5
    const dx = 3 + r() * Math.max(0, w - dw - 6)
    d.push({ kind: 'rect', x: dx, y: GY - 8, w: dw, h: 8, sw: 1.1 })
    if (w > 16) d.push({ kind: 'rect', x: dx + dw + 3, y: GY - 7, w: 5, h: 4, sw: 1 })
  } else if (kind === 'shutter') {
    d.push({ kind: 'rect', x: 2, y: top + 2, w: w - 4, h: FLOOR_H - 4, sw: 1.1 })
    for (let i = 1; i < 4; i++) {
      const sy = top + 2 + ((FLOOR_H - 4) / 4) * i
      d.push({ kind: 'line', x1: 2, y1: sy, x2: w - 2, y2: sy, sw: 0.6 })
    }
  }
  return d
}

/** 商店街の庇と袖看板 */
export function shopFixtures(r: Rng, w: number, awningRate: number, signRate: number): Detail[] {
  const d: Detail[] = []

  if (r() < awningRate) {
    const y = GY - FLOOR_H - 1
    d.push(
      line(1, y, w - 1, y, 1.2),
      line(1, y, 3, y + 4, 1),
      line(w - 1, y, w - 3, y + 4, 1),
      line(3, y + 4, w - 3, y + 4, 1),
    )
  }

  if (r() < signRate) {
    const sy = GY - FLOOR_H * 2 - 2
    const sw = 4
    const sh = 12
    const left = r() < 0.5
    const sx = left ? -sw : w
    d.push({ kind: 'rect', x: sx, y: sy, w: sw, h: sh, sw: 1 })
    d.push(line(left ? 0 : w, sy + 2, left ? 0 : w, sy + sh - 2, 0.8))
  }
  return d
}

/* ---------------- 電線（v2 §7.2） ---------------- */

export interface Pole { x: number; top: number }

/** 電柱間をカテナリー近似（2次ベジエ）で結ぶ。ループ端の接続も行う */
export function buildWirePath(poles: Pole[], stripW: number): string {
  if (poles.length < 2) return ''
  const seq: Pole[] = [...poles, { x: poles[0].x + stripW, top: poles[0].top }]
  const parts: string[] = []

  for (let i = 0; i < seq.length - 1; i++) {
    const a = seq[i]
    const b = seq[i + 1]
    const span = b.x - a.x
    if (span > 220) continue // 離れすぎた区間には張らない
    const sag = span * 0.07 + 1.5
    for (const dy of [0, 3.5, 7]) {
      const y1 = GY - a.top + dy
      const y2 = GY - b.top + dy
      parts.push(
        `M${a.x.toFixed(1)} ${y1.toFixed(1)} Q${((a.x + b.x) / 2).toFixed(1)} ` +
        `${((y1 + y2) / 2 + sag).toFixed(1)} ${b.x.toFixed(1)} ${y2.toFixed(1)}`,
      )
    }
  }
  return parts.join(' ')
}
