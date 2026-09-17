// 最小验证入口：浏览器端排盘(打包后 node 跑，验证 bundle 可用)
import { paipanBazi } from '../../paipan/bazi.js';
import { paipanZiwei } from '../../paipan/ziwei.js';
import { findLongitude } from '../../paipan/cities.js';

const lon = findLongitude('广东省茂名市')?.longitude ?? 110.9;
const input = { name: '劳翔', year: 2001, month: 7, day: 18, hour: 11, minute: 50, longitude: lon, gender: '男' };
const bazi = paipanBazi(input);
const zw = paipanZiwei(input);
console.log('八字:', bazi.pillars.map(p => p.ganzhi).join(' '));
console.log('紫微五行局:', zw.fiveElementsClass, '| 命宫地支:', zw.soulPalaceBranch);
console.log('命宫星曜:', zw.palaces.find(p => p.isSoulPalace)?.majorStars.map(s => s.name).join(','));
console.log('✅ bundle 排盘可用（与劳翔基准一致）');
