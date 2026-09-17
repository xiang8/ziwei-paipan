import { astro } from 'iztro';
import lunar from 'lunar-javascript';
const { Solar } = lunar;

// 劳翔 2001-07-18 11:50 广东茂名
console.log('========== 八字 (lunar-javascript) ==========');
const solar = Solar.fromYmdHms(2001, 7, 18, 11, 50, 0);
const lunarObj = solar.getLunar();
const ec = lunarObj.getEightChar();
console.log('四柱    :', ec.getYear(), ec.getMonth(), ec.getDay(), ec.getTime());
console.log('农历    :', lunarObj.toString());
console.log('日主    :', ec.getDayGan());
console.log('天干十神:', ec.getYearShiShenGan(), '/', ec.getMonthShiShenGan(), '/', ec.getTimeShiShenGan());
console.log('纳音    :', ec.getYearNaYin(), '/', ec.getMonthNaYin(), '/', ec.getDayNaYin(), '/', ec.getTimeNaYin());

console.log('\n========== 紫微 (iztro) ==========');
// 11:50 = 午时 = 时辰索引6 (子0丑1寅2卯3辰4巳5午6)
const astrolabe = astro.bySolar('2001-7-18', 6, '男', false, 'zh-CN');
console.log('五行局  :', astrolabe.fiveElementsClass);
console.log('命宫地支:', astrolabe.earthlyBranchOfSoulPalace, '| 身宫地支:', astrolabe.earthlyBranchOfBodyPalace);
console.log('--- 十二宫星曜 ---');
for (const p of astrolabe.palaces) {
  const stars = [
    ...p.majorStars.map(s => s.name + (s.brightness || '') + (s.mutagen ? `(${s.mutagen})` : '')),
    ...p.minorStars.map(s => s.name),
    ...p.adjectiveStars.map(s => s.name),
  ].filter(Boolean);
  console.log(`${p.name}(${p.earthlyBranch}): ${stars.join('、') || '（空宫）'}`);
}
