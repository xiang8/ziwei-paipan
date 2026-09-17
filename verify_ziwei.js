import { paipanZiwei } from './paipan/ziwei.js';

const r = paipanZiwei({
  name: '劳翔', year: 2001, month: 7, day: 18, hour: 11, minute: 50,
  longitude: 110.9, gender: '男',
});
console.log('【五行局】', r.fiveElementsClass, ' 样本:土五局');
console.log('【命宫地支】', r.soulPalaceBranch, ' 【身宫地支】', r.bodyPalaceBranch);
console.log('【真太阳时辰】', r.solarTime.timeName, '时 (真太阳时', r.solarTime.trueSolarTime + ')');
console.log('--- 十二宫 (样本: 命宫(子)=天梁庙、解神、天贵、台辅) ---');
for (const p of r.palaces) {
  const major = p.majorStars.map(s => s.name + s.brightness + (s.mutagen ? `(${s.mutagen})` : '')).join('、');
  const minor = p.minorStars.map(s => s.name + (s.mutagen ? `(${s.mutagen})` : '')).join('、');
  const adj = p.adjectiveStars.join('、');
  const tag = p.isSoulPalace ? '★命' : (p.isBodyPalace ? '☆身' : '');
  console.log(`${p.name}(${p.branch})${tag} [大限${p.daXianRange ? p.daXianRange.join('-') : '-'}]: ${major || '空宫'} | ${minor} | ${adj}`);
}
