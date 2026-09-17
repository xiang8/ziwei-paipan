import { paipanBazi } from './paipan/bazi.js';

const r = paipanBazi({
  name: '劳翔', year: 2001, month: 7, day: 18, hour: 11, minute: 50,
  longitude: 110.9, gender: '男',   // 茂名经度(cities表)
});

console.log('【真太阳时】', r.solarTime.inputTime, '→', r.solarTime.trueSolarTime,
  `(经度校正${r.solarTime.longitudeCorrectionMin}min + 均位差${r.solarTime.eotMin}min), 校正后${r.solarTime.shifted}`);
console.log('【农历】', r.lunar);
console.log('【生肖/星座】', r.shengXiao, '/', r.xingZuo);
console.log('【日主】', r.dayGan, r.dayWuXing);
console.log('【四柱】');
for (const p of r.pillars) {
  console.log(`  ${p.key}柱 ${p.ganzhi}  ${p.gan}(${p.ganShiShen})${p.zhi}  藏干[${p.hideGan.join(',')}] 十神[${p.zhiShiShen.join(',')}]  ${p.naYin}`);
}
console.log('【胎元】', r.taiYuan.ganzhi, r.taiYuan.naYin, '  样本:丙戌 屋上土');
console.log('【命宫】', r.mingGong.ganzhi, r.mingGong.naYin, '  样本:壬辰 长流水');
console.log('【身宫】', r.shenGong.ganzhi, r.shenGong.naYin, '  样本:庚寅 松柏木');
console.log('【空亡】', r.xunKong, '  样本:申酉');
console.log('【起运】', JSON.stringify(r.yunStart));
console.log('【大运】(样本:5岁甲午食神→15岁癸巳劫财→25岁壬辰比肩→35岁辛卯正印...)');
for (const d of r.daYun) {
  console.log(`  ${d.startAge}岁(${d.startYear}) ${d.ganzhi} ${d.ganShiShen}`);
}
console.log('【神煞】(样本: 年柱=亡神·天乙  日柱=将星  时柱=将星)');
for (const s of r.shenSha) console.log(`  ${s.key}柱(${s.zhi}): ${s.shenSha.join('、') || '无'}`);
console.log('【流年】(样本前6: 2001辛巳正印 / 2002壬午比肩 / 2003癸未劫财 / 2004甲申食神 / 2005乙酉伤官 / 2006丙戌偏财)');
for (const ln of r.liuNian.slice(0, 12)) console.log(`  ${ln.year}(${ln.age}岁) ${ln.ganzhi} ${ln.ganShiShen} [${ln.shenSha.join('、') || '-'}]`);
console.log('【五行】(样本: 金6 木7 水5 火24 土18)');
console.log('  五行分数:', Object.entries(r.wuXing.wxScore).map(([k,v]) => `${k}${v}`).join(' '));
console.log('  天干分数:', Object.entries(r.wuXing.ganScore).filter(([,v]) => v).map(([k,v]) => `${k}${v}`).join(' '));
