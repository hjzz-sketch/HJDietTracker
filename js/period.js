// ═══════════════════════════════════════════════════════════════════
// period.js — 经期记录模块
// 依赖：index.html 中的 Storage, DEVICE_ID, selectedDate
// 对外暴露：renderPeriodSettings, periodDotProvider, getPeriodPhase,
//           renderPeriodBanner, getPeriodWorkoutWarning
// ═══════════════════════════════════════════════════════════════════

// ── 周期阶段定义（基于28天标准周期）────────────────────────────────
const CYCLE_PHASES = {
  menstrual: { days: [1, 2, 3, 4, 5], label: "月经期", color: "#f06080" },
  follicular: {
    days: [6, 7, 8, 9, 10, 11, 12, 13],
    label: "卵泡期",
    color: "#f0c060",
  },
  ovulation: { days: [14, 15, 16], label: "排卵期", color: "#60f0a0" },
  luteal: {
    days: [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
    label: "黄体期",
    color: "#c060f0",
  },
};

// 各阶段营养调整（相对基础目标）
const PHASE_NUTRITION = {
  menstrual: {
    calAdj: +100,
    protAdj: 0,
    carbAdj: +10,
    fatAdj: 0,
    tips: [
      "增加富铁食物（红肉、菠菜、豆类）",
      "补充镁（坚果、深色蔬菜）有助缓解痉挛",
      "减少咖啡因和精制糖",
      "多喝温水",
    ],
    workoutWarning: "⚠️ 经期中，建议避免高强度下肢训练",
  },
  follicular: {
    calAdj: -50,
    protAdj: 0,
    carbAdj: -10,
    fatAdj: 0,
    tips: [
      "雌激素上升，是减脂最佳窗口",
      "适合增加有氧和力量训练强度",
      "多吃发酵食品（酸奶、泡菜）",
    ],
    workoutWarning: null,
  },
  ovulation: {
    calAdj: 0,
    protAdj: +10,
    carbAdj: 0,
    fatAdj: 0,
    tips: [
      "力量和精力达到顶峰，适合冲击大重量",
      "注意热身——雌激素高峰期韧带相对松弛",
    ],
    workoutWarning: null,
  },
  luteal: {
    calAdj: +200,
    protAdj: +5,
    carbAdj: +20,
    fatAdj: +5,
    tips: [
      "基础代谢提高，适当增加热量和碳水是合理的",
      "优选复合碳水（燕麦、红薯、糙米）",
      "镁有助缓解经前综合征（PMS）",
      "力量可能略降，不必强迫创PR",
    ],
    workoutWarning: null,
  },
};

// ── Storage helpers ───────────────────────────────────────────────
// 注意：原来用数据库自增 id 定位记录，现在改用 start_date 作为唯一标识
let _periodLogsCache = null;

async function getPeriodLogs(forceRefresh = false) {
  if (_periodLogsCache && !forceRefresh) return _periodLogsCache;
  try {
    const data = await Storage.getPeriodLog(DEVICE_ID);
    // 按 start_date 降序排列，模拟原来的 .order("start_date", { ascending: false })
    _periodLogsCache = data
      .sort((a, b) => b.start_date.localeCompare(a.start_date))
      .slice(0, 12);
    return _periodLogsCache;
  } catch (e) {
    return [];
  }
}

async function getActivePeriod() {
  const logs = await getPeriodLogs();
  return logs.find((p) => !p.end_date) || null;
}

async function startPeriod(startDate) {
  const log = await Storage.getPeriodLog(DEVICE_ID);
  log.push({ start_date: startDate, end_date: null });
  await Storage.savePeriodLog(DEVICE_ID, log);
  _periodLogsCache = null;
  Object.keys(_periodDotCache).forEach((k) => delete _periodDotCache[k]);
}

async function deletePeriodLog(id) {
  // id 即 start_date
  const log = await Storage.getPeriodLog(DEVICE_ID);
  const updated = log.filter((entry) => entry.start_date !== id);
  await Storage.savePeriodLog(DEVICE_ID, updated);
  _periodLogsCache = null;
  Object.keys(_periodDotCache).forEach((k) => delete _periodDotCache[k]);
}

async function endPeriod(id, endDate) {
  // id 即 start_date
  const log = await Storage.getPeriodLog(DEVICE_ID);
  const entry = log.find((p) => p.start_date === id);
  if (entry) entry.end_date = endDate;
  await Storage.savePeriodLog(DEVICE_ID, log);
  _periodLogsCache = null;
  Object.keys(_periodDotCache).forEach((k) => delete _periodDotCache[k]);
}

async function updatePeriodStartDate(id, startDate) {
  // id 即原来的 start_date
  const log = await Storage.getPeriodLog(DEVICE_ID);
  const entry = log.find((p) => p.start_date === id);
  if (entry) entry.start_date = startDate;
  await Storage.savePeriodLog(DEVICE_ID, log);
  _periodLogsCache = null;
}

// ── Phase calculation ─────────────────────────────────────────────
async function getPeriodPhase(date) {
  const logs = await getPeriodLogs();
  if (!logs.length) return null;
  const log = logs.find((p) => p.start_date <= date);
  if (!log) return null;
  const dayInCycle = daysBetween(log.start_date, date);
  const cycleDay = ((dayInCycle - 1) % 28) + 1;
  for (const [key, phase] of Object.entries(CYCLE_PHASES)) {
    if (phase.days.includes(cycleDay)) {
      return {
        phase: key,
        label: phase.label,
        color: phase.color,
        cycleDay,
        dayInCycle,
        nutrition: PHASE_NUTRITION[key],
      };
    }
  }
  return null;
}

// ── isDateInPeriod ────────────────────────────────────────────────
async function isDateInPeriod(ds) {
  const logs = await getPeriodLogs();
  return logs.some((p) => {
    if (ds < p.start_date) return false;
    if (!p.end_date) return true;
    return ds <= p.end_date;
  });
}

// ── Calendar dot provider ─────────────────────────────────────────
const _periodDotCache = {};

async function periodDotProvider(ds) {
  if (_periodDotCache[ds] !== undefined) return _periodDotCache[ds];
  const inPeriod = await isDateInPeriod(ds);
  _periodDotCache[ds] = inPeriod
    ? '<div class="cal-dot dot-period"></div>'
    : "";
  return _periodDotCache[ds];
}
if (typeof _dotProviders !== "undefined") {
  _dotProviders.push(periodDotProvider);
}

// ── Workout warning ───────────────────────────────────────────────
async function getPeriodWorkoutWarning(date) {
  const p = await getPeriodPhase(date);
  return p ? PHASE_NUTRITION[p.phase]?.workoutWarning || null : null;
}

// ── Period banner for today tab ───────────────────────────────────
async function renderPeriodBanner(date) {
  const p = await getPeriodPhase(date);
  if (!p) return "";
  const n = p.nutrition;
  const adj = [];
  if (n.calAdj) adj.push(`热量 ${n.calAdj > 0 ? "+" : ""}${n.calAdj}`);
  if (n.protAdj) adj.push(`蛋白 ${n.protAdj > 0 ? "+" : ""}${n.protAdj}g`);
  if (n.carbAdj) adj.push(`碳水 ${n.carbAdj > 0 ? "+" : ""}${n.carbAdj}g`);
  return `
    <div style="margin:0 16px 10px;padding:12px 14px;background:${p.color}18;
                border:1px solid ${p.color}44;border-radius:var(--radius)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:13px;font-weight:600;color:${p.color}">${p.label} · 第${p.cycleDay}天</span>
        ${adj.length ? `<span style="font-size:11px;color:${p.color};opacity:0.85">${adj.join(" · ")}</span>` : ""}
      </div>
      <div style="font-size:11px;color:var(--text2);line-height:1.6">${n.tips[0]}</div>
    </div>
  `;
}

// ── Settings panel ────────────────────────────────────────────────
async function renderPeriodSettings() {
  const container = document.getElementById("periodSettingsContainer");
  if (!container) return;
  const active = await getActivePeriod();
  const logs = await getPeriodLogs();
  const today =
    typeof selectedDate !== "undefined"
      ? selectedDate
      : new Date().toISOString().slice(0, 10);

  // 注意：所有 p.id / active.id 改为 p.start_date / active.start_date
  container.innerHTML = `
    <div>
      <div style="font-size:13px;margin-bottom:10px;color:var(--text2)">
        ${
          active
            ? `<span style="color:#f06080;font-weight:600">● 经期进行中</span>
             <span style="color:var(--text3);font-size:12px"> · 第 ${daysBetween(active.start_date, today)} 天</span>`
            : `<span style="color:var(--text3)">${
                logs[0]
                  ? "上次：" +
                    logs[0].start_date +
                    (logs[0].end_date
                      ? " ~ " +
                        logs[0].end_date +
                        "（" +
                        daysBetween(logs[0].start_date, logs[0].end_date) +
                        "天）"
                      : "（进行中）")
                  : "暂无记录"
              }</span>`
        }
      </div>

      ${
        active
          ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:var(--surface2);border-radius:8px;padding:10px 12px">
            <span style="font-size:13px;color:var(--text2)">开始日期</span>
            <input type="date" id="periodStartEdit" value="${active.start_date}" max="${today}"
              onchange="handleUpdateStart('${active.start_date}', this.value)"
              style="background:none;border:none;color:#f06080;font-size:13px;font-weight:600;cursor:pointer">
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="handlePeriodEnd('${active.start_date}', '${today}')"
              style="flex:1;padding:10px;background:var(--surface2);border:1.5px solid var(--border);
                     border-radius:8px;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer">
              今天结束
            </button>
            <button onclick="showEndPicker('${active.start_date}')"
              style="flex:1;padding:10px;background:var(--surface2);border:1.5px solid var(--border);
                     border-radius:8px;color:var(--text2);font-size:13px;font-weight:600;cursor:pointer">
              选日期结束
            </button>
          </div>
          <div id="endPickerBox"></div>
        </div>
      `
          : `
        <div style="display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between;
                      background:var(--surface2);border-radius:8px;padding:10px 12px">
            <span style="font-size:13px;color:var(--text2)">开始日期</span>
            <input type="date" id="periodStartDate" value="${today}" max="${today}"
              style="background:none;border:none;color:#f06080;font-size:13px;font-weight:600;cursor:pointer">
          </div>
          <button onclick="handlePeriodStart()"
            style="padding:10px;background:#f0608022;border:1.5px solid #f06080;
                   border-radius:8px;color:#f06080;font-size:13px;font-weight:600;cursor:pointer">
            开始记录经期
          </button>
        </div>
      `
      }

      ${
        logs.length
          ? `
        <div style="margin-top:14px">
          <div style="font-size:11px;color:var(--text3);margin-bottom:6px">历史记录</div>
          ${logs
            .slice(0, 6)
            .map(
              (p) => `
            <div style="font-size:12px;color:var(--text2);padding:5px 0;border-bottom:1px solid var(--border);
                        display:flex;justify-content:space-between;align-items:center">
              <span>${p.start_date}${p.end_date ? " ~ " + p.end_date : " <span style=\'color:#f06080\'>进行中</span>"}</span>
              <div style="display:flex;align-items:center;gap:8px">
                ${p.end_date ? `<span style="color:var(--text3)">${daysBetween(p.start_date, p.end_date)} 天</span>` : ""}
                <button onclick="handleDeletePeriod('${p.start_date}')"
                  style="font-size:11px;color:var(--text3);background:none;border:1px solid var(--border);
                         border-radius:4px;padding:2px 6px;cursor:pointer">删除</button>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }
    </div>
  `;
}

// ── Event handlers ────────────────────────────────────────────────
async function handlePeriodStart() {
  const d = document.getElementById("periodStartDate")?.value;
  if (!d) return;
  const logs = await getPeriodLogs(true);
  const unclosed = logs.filter((p) => !p.end_date);
  if (unclosed.length > 0) {
    if (
      !confirm(
        `已有 ${unclosed.length} 条未结束的经期记录，确定要新建一条吗？\n建议先在历史记录里删除错误数据。`,
      )
    )
      return;
  }
  await startPeriod(d);
  await renderPeriodSettings();
}

async function handlePeriodEnd(id, endDate) {
  await endPeriod(id, endDate);
  await renderPeriodSettings();
}

async function handleUpdateStart(id, newDate) {
  await updatePeriodStartDate(id, newDate);
  _periodLogsCache = null;
  await renderPeriodSettings();
}

function showEndPicker(id) {
  const box = document.getElementById("endPickerBox");
  if (!box) return;
  const today =
    typeof selectedDate !== "undefined"
      ? selectedDate
      : new Date().toISOString().slice(0, 10);
  box.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;background:var(--surface2);
                border-radius:8px;padding:10px 12px">
      <span style="font-size:13px;color:var(--text2);flex-shrink:0">结束日期</span>
      <input type="date" id="endDateInput" value="${today}" max="${today}"
        style="flex:1;background:none;border:none;color:#f06080;font-size:13px;font-weight:600">
      <button onclick="confirmEnd('${id}')"
        style="padding:6px 14px;background:#f06080;border:none;border-radius:6px;
               color:#fff;font-size:13px;font-weight:600;cursor:pointer">确认</button>
    </div>
  `;
}

async function confirmEnd(id) {
  const d = document.getElementById("endDateInput")?.value;
  if (!d) return;
  await endPeriod(id, d);
  await renderPeriodSettings();
}

async function handleDeletePeriod(id) {
  if (!confirm("确定删除这条经期记录吗？")) return;
  await deletePeriodLog(id);
  await renderPeriodSettings();
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000) + 1;
}
