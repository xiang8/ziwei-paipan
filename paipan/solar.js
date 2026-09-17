// 真太阳时校正
// 真太阳时 = 当地平太阳时 + 均位差(EoT)
// 当地平太阳时 = 输入时间(按UTC+8北京时间) + (经度 - 120°) × 4分钟
// 120° 为北京时间的中央经度

/**
 * 均位差 Equation of Time（NOAA 近似公式）
 * @param {Date} date 公历日期
 * @returns {number} 均位差，单位分钟
 */
export function equationOfTime(date) {
  const year = date.getFullYear();
  const start = Date.UTC(year, 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const B = (2 * Math.PI * (dayOfYear - 81)) / 365;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * 把"时:分"转成距 00:00 的分钟数
 */
function hmToMinutes(h, m) {
  return h * 60 + m;
}

/**
 * 分钟数转 "HH:MM:SS"
 */
function minutesToHMS(totalMin) {
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const h = Math.floor(totalMin / 60);
  const m = Math.floor(totalMin % 60);
  const s = Math.floor(((totalMin % 1) * 60));
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * 计算真太阳时
 * @param {number} year
 * @param {number} month
 * @param {number} day
 * @param {number} hour   输入小时（北京时间，0-23）
 * @param {number} minute 输入分钟
 * @param {number} longitude 出生地经度（东经，如茂名 110.9）
 * @returns {{trueSolarTimeStr: string, trueSolarMinutes: number, longitudeCorrectionMin: number, eotMin: number, totalOffsetMin: number}}
 */
export function getTrueSolarTime(year, month, day, hour, minute, longitude) {
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const inputMinutes = hmToMinutes(hour, minute);
  const longitudeCorrectionMin = (longitude - 120) * 4;
  const eotMin = equationOfTime(date);
  const totalOffsetMin = longitudeCorrectionMin + eotMin;
  const trueSolarMinutes = inputMinutes + totalOffsetMin;
  return {
    trueSolarTimeStr: minutesToHMS(trueSolarMinutes),
    trueSolarMinutes,
    longitudeCorrectionMin,
    eotMin,
    totalOffsetMin,
  };
}

/**
 * 根据真太阳时（小时+分钟，含小数）判定时辰索引 0-11
 * 时辰划分（按真太阳时）：
 *  子 23:00-01:00 (索引0) | 丑 01-03 (1) | 寅 03-05 (2) | 卯 05-07 (3)
 *  辰 07-09 (4) | 巳 09-11 (5) | 午 11-13 (6) | 未 13-15 (7)
 *  申 15-17 (8) | 酉 17-19 (9) | 戌 19-21 (10) | 亥 21-23 (11)
 * @param {number} trueSolarMinutes 真太阳时距0点分钟数
 * @returns {number} 时辰索引 0-11
 */
export function timeIndexFromTrueSolar(trueSolarMinutes) {
  const minutes = ((trueSolarMinutes % 1440) + 1440) % 1440;
  if (minutes >= 23 * 60 || minutes < 60) return 0; // 子时 23:00-00:59
  return Math.floor((minutes - 60) / 120) + 1; // 1:00起：1-3→1(丑), 3-5→2(寅) ...
}

/**
 * 时辰索引 → 中文时辰名
 */
export const TIME_INDEX_NAME = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export function timeIndexToName(idx) {
  return TIME_INDEX_NAME[((idx % 12) + 12) % 12];
}

/**
 * 一次性算出排盘所需的全部时间信息：真太阳时、校正后日期、时辰索引
 * @returns {{trueSolarTimeStr, trueSolarMinutes, longitudeCorrectionMin, eotMin, totalOffsetMin, shifted:{year,month,day,hour,minute}, timeIndex, timeName}}
 */
export function getBirthSolarTime(year, month, day, hour, minute, longitude) {
  const st = getTrueSolarTime(year, month, day, hour, minute, longitude);
  let totalMin = hour * 60 + minute + st.totalOffsetMin;
  const extraDays = Math.floor(totalMin / 1440);
  totalMin = ((totalMin % 1440) + 1440) % 1440;
  const tHour = Math.floor(totalMin / 60);
  const tMin = Math.floor(totalMin % 60);
  const d = new Date(Date.UTC(year, month - 1, day) + extraDays * 86400000);
  const shifted = {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: tHour, minute: tMin,
  };
  const timeIndex = timeIndexFromTrueSolar(totalMin);
  return {
    ...st,
    shifted,
    timeIndex,
    timeName: TIME_INDEX_NAME[timeIndex],
  };
}
