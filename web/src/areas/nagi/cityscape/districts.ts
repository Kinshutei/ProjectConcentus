import {
  crown, curtain, dome, factory, highrise, house, lamp, lattice, midrise,
  podiumTower, pole, setback, shop, signal, spire, tapered,
  treeBroad, treeConifer, treeTrimmed, twin,
} from './modules'
import type { DistrictConfig, DistrictId, Weighted } from './types'

export const DISTRICTS: Record<DistrictId, DistrictConfig> = {
  cbd: {
    label: '都心',
    urbanRatio: 0.92, gap: 5, fixtureRate: 0.07,
    widthRange: [280, 420], heightBias: 0.08,
    groundFloor: 'glass',
    low: [[shop, 3], [dome, 1]],
    high: [
      [curtain, 4], [highrise, 4], [twin, 3], [setback, 3], [crown, 2],
      [midrise, 2], [spire, 1], [tapered, 14], [podiumTower, 18],
    ],
    fixtures: [[treeTrimmed, 3], [lamp, 3], [signal, 3]],
  },
  office: {
    label: '業務',
    urbanRatio: 0.66, gap: 8, fixtureRate: 0.13,
    widthRange: [200, 320], heightBias: 0.02,
    groundFloor: 'entrance',
    low: [[shop, 3], [dome, 2], [house, 1]],
    high: [
      [midrise, 4], [curtain, 3], [highrise, 2], [crown, 2], [setback, 2],
      [spire, 1], [tapered, 10], [podiumTower, 14],
    ],
    fixtures: [[treeTrimmed, 4], [lamp, 3], [signal, 3]],
  },
  shopping: {
    label: '商店街',
    urbanRatio: 0.26, gap: 6, fixtureRate: 0.15,
    widthRange: [180, 280], heightBias: 0,
    groundFloor: 'glass', awningRate: 0.7, signRate: 0.5,
    low: [[shop, 5], [house, 3], [dome, 2]],
    high: [[midrise, 4], [curtain, 1], [podiumTower, 4]],
    fixtures: [[treeTrimmed, 4], [lamp, 3], [signal, 2], [pole, 4]],
  },
  residential: {
    label: '住宅',
    urbanRatio: 0.10, gap: 11, fixtureRate: 0.28,
    widthRange: [220, 340], heightBias: -0.05,
    groundFloor: 'entrance',
    low: [[house, 6], [shop, 2], [dome, 1]],
    high: [[midrise, 2], [crown, 1]],
    fixtures: [[treeBroad, 5], [treeTrimmed, 2], [lamp, 2], [signal, 1], [pole, 5]],
  },
  park: {
    label: '公園',
    urbanRatio: 0.03, gap: 17, fixtureRate: 0.70,
    widthRange: [90, 170], heightBias: -0.07,
    groundFloor: 'none',
    low: [[house, 1], [dome, 1]],
    high: [[midrise, 1]],
    fixtures: [[treeBroad, 6], [treeConifer, 3], [treeTrimmed, 1], [lamp, 2], [signal, 1]],
  },
  industrial: {
    label: '工業',
    urbanRatio: 0.32, gap: 12, fixtureRate: 0.09,
    widthRange: [200, 300], heightBias: 0,
    groundFloor: 'shutter',
    low: [[factory, 5], [shop, 2]],
    high: [[lattice, 4], [highrise, 2], [curtain, 1]],
    fixtures: [[treeBroad, 2], [lamp, 3], [signal, 2], [pole, 4]],
  },
}

/**
 * 地区の遷移確率（v2.1 §4 の都市寄り改訂）。都心・業務の常在確率を引き上げ、
 * 公園・工業は挟みとして残す。公園から都心・業務へ戻る確率を高くしてあるのは、
 * 大きな公園の向こうに高層街区が見える構図を作るため。
 * 重みは確率×100 で持つ。行ごとの合計は 100。
 */
export const TRANSITIONS: Record<DistrictId, readonly Weighted<DistrictId>[]> = {
  cbd: [['cbd', 34], ['office', 30], ['shopping', 16], ['residential', 4], ['park', 12], ['industrial', 4]],
  office: [['cbd', 26], ['office', 32], ['shopping', 20], ['residential', 8], ['park', 10], ['industrial', 4]],
  shopping: [['cbd', 18], ['office', 24], ['shopping', 24], ['residential', 20], ['park', 10], ['industrial', 4]],
  residential: [['cbd', 6], ['office', 12], ['shopping', 30], ['residential', 30], ['park', 18], ['industrial', 4]],
  park: [['cbd', 24], ['office', 22], ['shopping', 18], ['residential', 20], ['park', 4], ['industrial', 12]],
  industrial: [['cbd', 10], ['office', 16], ['shopping', 12], ['residential', 18], ['park', 14], ['industrial', 30]],
}

/** 電柱を立てる地区。都心・業務・公園では地中化されたものとして扱う */
export const POLE_DISTRICTS = new Set<DistrictId>(['residential', 'shopping', 'industrial'])

/** 開始地区。工業は都市感が弱いので都心から始める */
export const START_DISTRICT: DistrictId = 'cbd'
