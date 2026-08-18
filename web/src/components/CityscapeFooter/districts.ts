import {
  crown, curtain, dome, factory, highrise, house, lamp, lattice,
  midrise, setback, shop, signal, spire, tree, twin,
} from './modules'
import type { DistrictConfig, DistrictId, Weighted } from './types'

export const DISTRICTS: Record<DistrictId, DistrictConfig> = {
  cbd: {
    label: '都心',
    urbanRatio: 0.92, gap: 5, fixtureRate: 0.07,
    widthRange: [280, 420], heightBias: 0.08,
    low: [[shop, 3], [dome, 1]],
    high: [[curtain, 4], [highrise, 4], [twin, 3], [setback, 3], [crown, 2], [midrise, 2], [spire, 1]],
    fixtures: [[tree, 3], [lamp, 3], [signal, 3]],
  },
  office: {
    label: '業務',
    urbanRatio: 0.66, gap: 8, fixtureRate: 0.13,
    widthRange: [200, 320], heightBias: 0.02,
    low: [[shop, 3], [dome, 2], [house, 1]],
    high: [[midrise, 4], [curtain, 3], [highrise, 2], [crown, 2], [setback, 2], [spire, 1]],
    fixtures: [[tree, 4], [lamp, 3], [signal, 3]],
  },
  shopping: {
    label: '商店街',
    urbanRatio: 0.26, gap: 6, fixtureRate: 0.15,
    widthRange: [180, 280], heightBias: 0,
    low: [[shop, 5], [house, 3], [dome, 2]],
    high: [[midrise, 4], [curtain, 1]],
    fixtures: [[tree, 4], [lamp, 3], [signal, 2]],
  },
  residential: {
    label: '住宅',
    urbanRatio: 0.10, gap: 11, fixtureRate: 0.28,
    widthRange: [220, 340], heightBias: -0.05,
    low: [[house, 6], [shop, 2], [dome, 1]],
    high: [[midrise, 2], [crown, 1]],
    fixtures: [[tree, 6], [lamp, 2], [signal, 1]],
  },
  park: {
    label: '公園',
    urbanRatio: 0.03, gap: 17, fixtureRate: 0.70,
    widthRange: [90, 170], heightBias: -0.07,
    low: [[house, 1], [dome, 1]],
    high: [[midrise, 1]],
    fixtures: [[tree, 9], [lamp, 2], [signal, 1]],
  },
  industrial: {
    label: '工業',
    urbanRatio: 0.32, gap: 12, fixtureRate: 0.09,
    widthRange: [200, 300], heightBias: 0,
    low: [[factory, 5], [shop, 2]],
    high: [[lattice, 4], [highrise, 2], [curtain, 1]],
    fixtures: [[tree, 3], [lamp, 3], [signal, 2]],
  },
}

/**
 * 地区の遷移確率。都心の隣に公園は来ず、必ず業務地区を挟む。
 * これにより同心円的な都市構造が自然に現れる。
 */
export const TRANSITIONS: Record<DistrictId, readonly Weighted<DistrictId>[]> = {
  cbd: [['office', 5], ['cbd', 1]],
  office: [['cbd', 3], ['shopping', 3], ['industrial', 1], ['residential', 1]],
  shopping: [['residential', 4], ['office', 3], ['park', 1]],
  residential: [['park', 3], ['shopping', 3], ['industrial', 1], ['residential', 1]],
  park: [['residential', 4], ['shopping', 2]],
  industrial: [['residential', 2], ['office', 2], ['park', 1]],
}

/** 開始地区。ループ接合部が住宅同士になるよう、中庸な地区を選ぶ */
export const START_DISTRICT: DistrictId = 'residential'
