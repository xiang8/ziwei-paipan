// 八字神煞查表
// 口径（反推自样本）：
//   三合类(将星/亡神/桃花/驿马/华盖/劫煞) 按【日支】起
//   贵人/文昌/禄神/学堂/红艳/阳刃 按【日干】起
//   孤辰/寡宿 按【年支】起（三会局）
// 劳翔样本验证：年柱亡神天乙、日柱将星、时柱将星 ✓；流年神煞逐条对齐 ✓

// 三合局归类
const SANHE = {
  寅: '火', 午: '火', 戌: '火',
  巳: '金', 酉: '金', 丑: '金',
  申: '水', 子: '水', 辰: '水',
  亥: '木', 卯: '木', 未: '木',
};
const JIANGXING = { 火: '午', 金: '酉', 水: '子', 木: '卯' };
const WANGSHEN  = { 火: '巳', 金: '申', 水: '亥', 木: '寅' };
const TAOHUA    = { 火: '卯', 金: '午', 水: '酉', 木: '子' };
const YIMA      = { 火: '申', 金: '亥', 水: '寅', 木: '巳' };
const HUAGAI    = { 火: '戌', 金: '丑', 水: '辰', 木: '未' };
const JIESHA    = { 火: '亥', 金: '寅', 水: '巳', 木: '申' };

// 日干起的神煞
const TIANYI = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
  辛: ['午', '寅'],
};
const WENCHANG = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const HONGYAN  = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
const LUSHEN   = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const XUETANG  = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
const YANGREN  = { 甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑' }; // 羊刃(阳刃)

// 孤辰寡宿：年支三会局 → [孤辰地支, 寡宿地支]
const GUZHESHENS = {
  亥: ['寅', '戌'], 子: ['寅', '戌'], 丑: ['寅', '戌'],
  寅: ['巳', '丑'], 卯: ['巳', '丑'], 辰: ['巳', '丑'],
  巳: ['申', '辰'], 午: ['申', '辰'], 未: ['申', '辰'],
  申: ['亥', '未'], 酉: ['亥', '未'], 戌: ['亥', '未'],
};

/**
 * 命局所有神煞映射（神煞名 → 落在地支，天乙为数组）
 * @param {string} dayGan 日干
 * @param {string} dayZhi 日支
 * @param {string} yearZhi 年支（孤辰寡宿用）
 */
export function getShenShaMap(dayGan, dayZhi, yearZhi) {
  const ju = SANHE[dayZhi];
  const [guZhi, guaZhi] = GUZHESHENS[yearZhi] || ['', ''];
  return {
    将星: JIANGXING[ju],
    亡神: WANGSHEN[ju],
    桃花: TAOHUA[ju],
    驿马: YIMA[ju],
    华盖: HUAGAI[ju],
    劫煞: JIESHA[ju],
    阳刃: YANGREN[dayGan],
    孤辰: guZhi,
    寡宿: guaZhi,
    文昌: WENCHANG[dayGan],
    红艳: HONGYAN[dayGan],
    禄神: LUSHEN[dayGan],
    学堂: XUETANG[dayGan],
    天乙: TIANYI[dayGan],
  };
}

/**
 * 给四柱各柱标注命中的神煞
 */
export function annotateShenSha(dayGan, pillars, yearZhi) {
  const dayZhi = pillars.find(p => p.key === '日').zhi;
  const map = getShenShaMap(dayGan, dayZhi, yearZhi);
  return pillars.map(p => {
    const hits = [];
    for (const [name, zhi] of Object.entries(map)) {
      if (Array.isArray(zhi)) {
        if (zhi.includes(p.zhi)) hits.push(name);
      } else if (zhi === p.zhi) {
        hits.push(name);
      }
    }
    return { key: p.key, zhi: p.zhi, shenSha: hits };
  });
}
