import { astro } from 'iztro';
import { getBirthSolarTime } from './solar.js';

const pad = n => String(n).padStart(2, '0');

/**
 * 紫微斗数排盘（基于 iztro）
 * @param {object} input {name, year, month, day, hour, minute, longitude, gender}
 * @returns 结构化紫微命盘
 */
export function paipanZiwei(input) {
  const { name = '命主', year, month, day, hour, minute, longitude = 116.4, gender = '男' } = input;
  const bst = getBirthSolarTime(year, month, day, hour, minute, longitude);
  const { shifted, timeIndex } = bst;
  const iztroGender = gender === '女' ? '女' : '男';
  const dateStr = `${shifted.year}-${shifted.month}-${shifted.day}`;

  const astrolabe = astro.bySolar(dateStr, timeIndex, iztroGender, false, 'zh-CN');

  const palaces = astrolabe.palaces.map(p => ({
    name: p.name,                 // 宫名：命宫/兄弟/...
    branch: p.earthlyBranch,      // 宫支
    stem: p.heavenlyStem,         // 宫干
    isBodyPalace: !!p.isBodyPalace,
    isSoulPalace: p.name === '命宫',
    majorStars: (p.majorStars || [])
      .map(s => ({ name: s.name, brightness: s.brightness || '', mutagen: s.mutagen || '' }))
      .filter(s => s.name),
    minorStars: (p.minorStars || [])
      .map(s => ({ name: s.name, mutagen: s.mutagen || '' }))
      .filter(s => s.name),
    adjectiveStars: (p.adjectiveStars || []).map(s => s.name).filter(Boolean),
    daXianRange: p.decadal && p.decadal.range ? [...p.decadal.range] : null, // 大限年龄 [起,止]
  }));

  return {
    input: { name, year, month, day, hour, minute, longitude, gender },
    solarTime: {
      inputTime: `${pad(hour)}:${pad(minute)}`,
      trueSolarTime: bst.trueSolarTimeStr,
      timeIndex, timeName: bst.timeName,
      shifted: `${shifted.year}-${pad(shifted.month)}-${pad(shifted.day)} ${pad(shifted.hour)}:${pad(shifted.minute)}`,
    },
    chineseDate: astrolabe.chineseDate,            // 农历日期对象
    solarDate: astrolabe.solarDate,
    fiveElementsClass: astrolabe.fiveElementsClass, // 五行局
    soulPalaceBranch: astrolabe.earthlyBranchOfSoulPalace, // 命宫地支
    bodyPalaceBranch: astrolabe.earthlyBranchOfBodyPalace, // 身宫地支
    palaces,
  };
}
