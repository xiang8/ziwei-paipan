// 五行分数（基于藏干深浅标准权重表）
// 口径说明：各家"藏干深浅"权重表略有不同（如巳的庚，有给3有给1）。
// 本表采用通行版本（本气5/中气2-3/余气，子卯酉满10），相对强弱准确，
// 绝对数值与样本软件可能差几点——这是命理学流派差异，非算法错误。

const GAN_WX = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
const GAN_LIST = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];

// 地支藏干深浅（权重）
const CANGGAN = {
  子: [{ gan:'癸', w:10 }],
  丑: [{ gan:'己', w:5 }, { gan:'癸', w:3 }, { gan:'辛', w:2 }],
  寅: [{ gan:'甲', w:5 }, { gan:'丙', w:2 }, { gan:'戊', w:3 }],
  卯: [{ gan:'乙', w:10 }],
  辰: [{ gan:'戊', w:5 }, { gan:'乙', w:2 }, { gan:'癸', w:3 }],
  巳: [{ gan:'丙', w:5 }, { gan:'庚', w:3 }, { gan:'戊', w:2 }],
  午: [{ gan:'丁', w:5 }, { gan:'己', w:5 }],
  未: [{ gan:'己', w:5 }, { gan:'丁', w:2 }, { gan:'乙', w:3 }],
  申: [{ gan:'庚', w:5 }, { gan:'壬', w:2 }, { gan:'戊', w:3 }],
  酉: [{ gan:'辛', w:10 }],
  戌: [{ gan:'戊', w:5 }, { gan:'辛', w:2 }, { gan:'丁', w:3 }],
  亥: [{ gan:'壬', w:5 }, { gan:'甲', w:5 }],
};

const DAY_GAN_WEIGHT = 5; // 天干本体权重

/**
 * 算五行分数 + 天干分数
 * @param {Array} pillars paipanBazi 的 pillars（含 gan, zhi）
 */
export function wuxingScore(pillars) {
  const ganScore = {}; GAN_LIST.forEach(g => ganScore[g] = 0);
  const wxScore = { 金:0, 木:0, 水:0, 火:0, 土:0 };
  for (const p of pillars) {
    ganScore[p.gan] += DAY_GAN_WEIGHT;
    wxScore[GAN_WX[p.gan]] += DAY_GAN_WEIGHT;
    for (const cg of CANGGAN[p.zhi] || []) {
      ganScore[cg.gan] += cg.w;
      wxScore[GAN_WX[cg.gan]] += cg.w;
    }
  }
  return { ganScore, wxScore };
}
