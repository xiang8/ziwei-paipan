// 命理大师系统提示词（bbxiang 指定）
export const SYSTEM_PROMPT = `你是一位精通中华传统命理学与玄学的命理分析大师。你的知识体系扎根于经典命理著作：穷通宝鉴，滴天髓，三命通会，八字提要，子平真诠，渊海子平，天元咸巫，周易，神峰通考，千里命稿，五行精纪，李虚中命书，紫微斗数 等，并结合现代命理实践应用。
你的分析风格严谨、系统、客观，能够深入浅出地解释复杂的命理概念。解读时八字与紫微斗数相互印证，给出有依据、可落地的判断，避免空泛套话。`;

/**
 * 把排盘数据序列化喂给 AI，并指定输出维度
 */
export function buildUserPrompt({ basic, bazi, ziwei }) {
  return `请基于以下排盘数据，为命主做一份系统、深入的命理解读报告。

${basic}

${bazi}

${ziwei}

请按以下结构输出（用 Markdown 二级标题分节，每节内容充实、有命理依据）：

## 一、命局总论
综合八字与紫微，判断日主旺衰、格局层次、五行喜忌用神，点出命局最核心的特点。

## 二、性格与天赋
结合日主、十神、命宫主星，分析命主性格倾向、思维方式、天赋潜能。

## 三、事业与财运
结合官禄宫、财帛宫、八字财官格局，分析适合的事业方向、求财方式、财运层次。

## 四、感情与婚姻
结合夫妻宫、财官与日支，分析感情婚姻特征、配偶画像、需注意之处。

## 五、健康与灾厄
结合疾厄宫、五行偏枯、冲克，提示需留意的健康与灾厄方面。

## 六、大运走势
逐段点评关键大运（尤其当前与未来十年），指出顺逆起伏与转折点。

## 七、紫微命盘要点
提炼紫微十二宫中最值得注意的星曜组合与格局（如命宫主星、四化、空宫借星等）。

## 八、综合建议
给出务实的趋避建议（方位、行业、修心、时机等）。

注意：解读要有命理依据，引用具体星曜/十神/五行/大运；不夸大、不恐吓；语言专业且通俗。`;
}

/** 把 paipanBazi 结果格式化为文本 */
export function formatBaziText(bz) {
  const p = bz.pillars.map(x => `${x.key}柱${x.ganzhi}(${x.gan === bz.dayGan ? '日主' : x.ganShiShen})`).join('  ');
  const hide = bz.pillars.map(x => `${x.key}支藏[${x.hideGan.join(',')}]十神[${x.zhiShiShen.join(',')}]`).join('  ');
  const nay = bz.pillars.map(x => `${x.naYin}`).join('/');
  const dy = bz.daYun.map(d => `${d.startAge}岁${d.ganzhi}(${d.ganShiShen})`).join('  ');
  return `【八字】
四柱：${p}
日主：${bz.dayGan}（${bz.dayWuXing}）  生肖：${bz.shengXiao}  星座：${bz.xingZuo}
藏干十神：${hide}
纳音：${nay}
胎元：${bz.taiYuan.ganzhi}(${bz.taiYuan.naYin})  命宫：${bz.mingGong.ganzhi}(${bz.mingGong.naYin})  身宫：${bz.shenGong.ganzhi}(${bz.shenGong.naYin})
空亡：${bz.xunKong}
起运：${bz.yunStart.startAgeStr}（${bz.yunStart.startSolar}）
大运：${dy}`;
}

/** 把 paipanZiwei 结果格式化为文本 */
export function formatZiweiText(zw) {
  const pals = zw.palaces.map(p => {
    const major = p.majorStars.map(s => s.name + s.brightness + (s.mutagen ? `(化${s.mutagen})` : '')).join('、');
    const minor = p.minorStars.map(s => s.name + (s.mutagen ? `(化${s.mutagen})` : '')).join('、');
    const adj = p.adjectiveStars.join('、');
    const stars = [major, minor, adj].filter(Boolean).join('、') || '空宫';
    return `  ${p.name}(${p.branch})${p.isBodyPalace ? '[身宫]' : ''}：${stars}`;
  }).join('\n');
  return `【紫微斗数】
五行局：${zw.fiveElementsClass}  命宫地支：${zw.soulPalaceBranch}  身宫地支：${zw.bodyPalaceBranch}
十二宫：
${pals}`;
}
