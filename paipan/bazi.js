import lunar from 'lunar-javascript';
import { getTrueSolarTime } from './solar.js';
import { annotateShenSha, getShenShaMap } from './shensha.js';
import { wuxingScore } from './wuxing.js';
const { Solar } = lunar;

const PILLAR_KEYS = ['年', '月', '日', '时'];
const GAN_METHODS = ['getYearGan', 'getMonthGan', 'getDayGan', 'getTimeGan'];
const ZHI_METHODS = ['getYearZhi', 'getMonthZhi', 'getDayZhi', 'getTimeZhi'];
const GZ_METHODS = ['getYear', 'getMonth', 'getDay', 'getTime'];
const NA_METHODS = ['getYearNaYin', 'getMonthNaYin', 'getDayNaYin', 'getTimeNaYin'];
const GAN_SS_METHODS = ['getYearShiShenGan', 'getMonthShiShenGan', 'getDayShiShenGan', 'getTimeShiShenGan'];
const ZHI_SS_METHODS = ['getYearShiShenZhi', 'getMonthShiShenZhi', 'getDayShiShenZhi', 'getTimeShiShenZhi'];
const HIDE_METHODS = ['getYearHideGan', 'getMonthHideGan', 'getDayHideGan', 'getTimeHideGan'];
const WUXING_METHODS = ['getYearWuXing', 'getMonthWuXing', 'getDayWuXing', 'getTimeWuXing'];

/** 真太阳时校正后的日期时间（处理跨日）。只在当地时间层面偏移，不转时区 */
function shiftedDateTime(year, month, day, hour, minute, offsetMin) {
  let totalMin = hour * 60 + minute + offsetMin;
  const extraDays = Math.floor(totalMin / 1440);
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const tHour = Math.floor(totalMin / 60);
  const tMin = Math.floor(totalMin % 60);
  const d = new Date(Date.UTC(year, month - 1, day) + extraDays * 86400000);
  return {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: tHour, minute: tMin,
  };
}

/** 八字排盘 */
export function paipanBazi(input) {
  const { name = '命主', year, month, day, hour, minute, longitude = 116.4, gender = '男' } = input;
  const genderNum = gender === '女' ? 0 : 1;

  const st = getTrueSolarTime(year, month, day, hour, minute, longitude);
  const adj = shiftedDateTime(year, month, day, hour, minute, st.totalOffsetMin);

  const solar = Solar.fromYmdHms(adj.year, adj.month, adj.day, adj.hour, adj.minute, 0);
  const lunarObj = solar.getLunar();
  const ec = lunarObj.getEightChar();

  const pillars = PILLAR_KEYS.map((key, i) => ({
    key,
    ganzhi: ec[GZ_METHODS[i]](),
    gan: ec[GAN_METHODS[i]](),
    zhi: ec[ZHI_METHODS[i]](),
    ganShiShen: ec[GAN_SS_METHODS[i]](),
    zhiShiShen: ec[ZHI_SS_METHODS[i]](),
    hideGan: ec[HIDE_METHODS[i]](),
    naYin: ec[NA_METHODS[i]](),
    wuxing: ec[WUXING_METHODS[i]](),
  }));

  const dayGan = ec.getDayGan();
  const taiYuan = { ganzhi: ec.getTaiYuan(), naYin: ec.getTaiYuanNaYin() };
  const mingGong = { ganzhi: ec.getMingGong(), naYin: ec.getMingGongNaYin() };
  const shenGong = { ganzhi: ec.getShenGong(), naYin: ec.getShenGongNaYin() };

  const yun = ec.getYun(genderNum);
  const daYun = yun.getDaYun()
    .filter(d => d.getGanZhi())
    .map((d, i) => ({
      index: i,
      startAge: d.getStartAge(),
      endAge: d.getEndAge(),
      startYear: d.getStartYear(),
      endYear: d.getEndYear(),
      ganzhi: d.getGanZhi(),
      ganShiShen: ganShiShenOf(dayGan, d.getGanZhi()[0]),
    }));

  // 流年（从出生年起 94 年，独立推算覆盖样本范围；以立春为准取年柱）
  const dayZhi = pillars.find(p => p.key === '日').zhi;
  const yearZhi = pillars.find(p => p.key === '年').zhi;
  const ssMap = getShenShaMap(dayGan, dayZhi, yearZhi);
  const liuNian = [];
  for (let y = year; y <= year + 93; y++) {
    const gz = Solar.fromYmdHms(y, 2, 5, 12, 0, 0).getLunar().getYearInGanZhiExact();
    const zhi = gz[1];
    const ss = [];
    for (const [name, v] of Object.entries(ssMap)) {
      if (Array.isArray(v) ? v.includes(zhi) : v === zhi) ss.push(name);
    }
    liuNian.push({ year: y, age: y - year, ganzhi: gz, ganShiShen: ganShiShenOf(dayGan, gz[0]), zhi, shenSha: ss });
  }

  return {
    input: { name, year, month, day, hour, minute, longitude, gender },
    solarTime: {
      inputTime: `${pad(hour)}:${pad(minute)}`,
      trueSolarTime: st.trueSolarTimeStr,
      longitude,
      longitudeCorrectionMin: round1(st.longitudeCorrectionMin),
      eotMin: round1(st.eotMin),
      totalOffsetMin: round1(st.totalOffsetMin),
      shifted: `${adj.year}-${pad(adj.month)}-${pad(adj.day)} ${pad(adj.hour)}:${pad(adj.minute)}`,
    },
    lunar: lunarObj.toString(),
    shengXiao: shengXiaoFromZhi(ec.getYearZhi()),
    xingZuo: xingZuoFromDate(month, day),
    dayGan,
    dayWuXing: GAN_WX[dayGan],
    pillars,
    taiYuan, mingGong, shenGong,
    xun: ec.getDayXun(),
    xunKong: ec.getDayXunKong(),
    yunStart: {
      startAgeStr: `${yun.getStartYear()}年${yun.getStartMonth()}月${yun.getStartDay()}天${yun.getStartHour ? yun.getStartHour() : 0}时`,
      startSolar: yun.getStartSolar() ? yun.getStartSolar().toString() : null,
    },
    daYun,
    shenSha: annotateShenSha(dayGan, pillars, yearZhi),
    liuNian,
    wuXing: wuxingScore(pillars),
  };
}

// ─── 工具函数 ──────────────────────────────────────────
const GAN_WX = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
function pad(n) { return String(n).padStart(2, '0'); }
function round1(n) { return Math.round(n * 10) / 10; }

function shengXiaoFromZhi(zhi) {
  const MAP = { 子:'鼠',丑:'牛',寅:'虎',卯:'兔',辰:'龙',巳:'蛇',午:'马',未:'羊',申:'猴',酉:'鸡',戌:'狗',亥:'猪' };
  return MAP[zhi] ?? '';
}

function xingZuoFromDate(m, d) {
  if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return '白羊';
  if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return '金牛';
  if ((m === 5 && d >= 21) || (m === 6 && d <= 21)) return '双子';
  if ((m === 6 && d >= 22) || (m === 7 && d <= 22)) return '巨蟹';
  if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return '狮子';
  if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return '处女';
  if ((m === 9 && d >= 23) || (m === 10 && d <= 23)) return '天秤';
  if ((m === 10 && d >= 24) || (m === 11 && d <= 22)) return '天蝎';
  if ((m === 11 && d >= 23) || (m === 12 && d <= 21)) return '射手';
  return '摩羯';
}

// 日主 vs 某天干 → 十神
const SHISHEN_TABLE = buildShiShenTable();
function ganShiShenOf(dayGan, gan) { return SHISHEN_TABLE[dayGan]?.[gan] ?? ''; }
function buildShiShenTable() {
  const GAN = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  const WX = { 甲:'木',乙:'木',丙:'火',丁:'火',戊:'土',己:'土',庚:'金',辛:'金',壬:'水',癸:'水' };
  const YIN = { 甲:0,乙:1,丙:2,丁:3,戊:4,己:5,庚:6,辛:7,壬:8,癸:9 };
  const SHENG = { 木:'火',火:'土',土:'金',金:'水',水:'木' }; // 我生
  const KE = { 木:'土',土:'水',水:'火',火:'金',金:'木' };   // 我克
  const table = {};
  for (const dg of GAN) {
    table[dg] = {};
    const dw = WX[dg], dy = YIN[dg] % 2;
    for (const g of GAN) {
      const gw = WX[g], gy = YIN[g] % 2, sameYin = dy === gy;
      let name = '';
      if (dw === gw) name = sameYin ? '比肩' : '劫财';
      else if (SHENG[dw] === gw) name = sameYin ? '食神' : '伤官';
      else if (SHENG[gw] === dw) name = sameYin ? '偏印' : '正印';
      else if (KE[dw] === gw) name = sameYin ? '偏财' : '正财';
      else if (KE[gw] === dw) name = sameYin ? '七杀' : '正官';
      table[dg][g] = name;
    }
  }
  return table;
}
