// ═══════════════════════════════════════════════════════════════════
// sleep.js — 睡眠记录模块
// 依赖：index.html 中的 Storage, DEVICE_ID, selectedDate
// 对外暴露：renderSleep(date), _dotProviders
// ═══════════════════════════════════════════════════════════════════

// ── Storage helpers ───────────────────────────────────────────────
async function getSleepData(date) {
  try {
    return await Storage.getSleep(DEVICE_ID, date);
  } catch (e) {
    return null;
  }
}

async function saveSleepData(date, sleepTime, wakeTime, score) {
  await Storage.saveSleep(DEVICE_ID, date, {
    sleep_time: sleepTime,
    wake_time: wakeTime,
    score,
  });
}

// ── Helpers ───────────────────────────────────────────────────────
function calcDuration(sleepTime, wakeTime) {
  if (!sleepTime || !wakeTime) return null;
  const [sh, sm] = sleepTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let mins = wh * 60 + wm - (sh * 60 + sm);
  if (mins < 0) mins += 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return { h, m, label: `${h}h ${m > 0 ? m + "m" : ""}` };
}

function sleepQualityColor(score) {
  return (
    ["", "#f06060", "#f0a060", "#f0f060", "#a0f060", "#60f0a0"][score] ||
    "var(--text2)"
  );
}

// ── Calendar dot provider ─────────────────────────────────────────
async function sleepDotProvider(ds) {
  const d = await getSleepData(ds);
  return d ? '<div class="cal-dot dot-sleep"></div>' : "";
}
if (typeof _dotProviders !== "undefined") {
  _dotProviders.push(sleepDotProvider);
}

// ── Main render ───────────────────────────────────────────────────
async function renderSleep(date) {
  const container = document.getElementById("sleepContainer");
  if (!container) return;

  const existing = await getSleepData(date);
  const duration = existing
    ? calcDuration(existing.sleep_time, existing.wake_time)
    : null;

  container.innerHTML = `
    <div style="padding:0 0 16px">

      ${
        existing
          ? `
        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div style="flex:1;background:var(--surface2);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:var(--accent2)">${duration?.label || "—"}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">睡眠时长</div>
          </div>
          <div style="flex:1;background:var(--surface2);border-radius:10px;padding:12px;text-align:center">
            <div style="font-size:22px;font-weight:700;color:${sleepQualityColor(existing.score)}">${"★".repeat(existing.score || 0)}${"☆".repeat(5 - (existing.score || 0))}</div>
            <div style="font-size:11px;color:var(--text3);margin-top:2px">主观评分</div>
          </div>
        </div>
      `
          : ""
      }

      <div style="background:var(--surface);border-radius:var(--radius);border:1px solid var(--border);padding:14px;display:flex;flex-direction:column;gap:12px">

        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:var(--text2)">入睡时间</span>
          <input type="time" id="sleepTimeInput" value="${existing?.sleep_time || ""}"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
                   color:var(--text);padding:6px 10px;font-size:14px">
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:var(--text2)">起床时间</span>
          <input type="time" id="wakeTimeInput" value="${existing?.wake_time || ""}"
            style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;
                   color:var(--text);padding:6px 10px;font-size:14px">
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:13px;color:var(--text2)">睡眠质量</span>
          <div style="display:flex;gap:6px">
            ${[1, 2, 3, 4, 5]
              .map(
                (n) => `
              <button onclick="selectSleepScore(${n})" id="sleep-score-${n}"
                style="width:32px;height:32px;border-radius:50%;border:1.5px solid ${(existing?.score || 0) >= n ? sleepQualityColor(n) : "var(--border)"};
                       background:${(existing?.score || 0) >= n ? sleepQualityColor(n) + "33" : "none"};
                       color:${(existing?.score || 0) >= n ? sleepQualityColor(n) : "var(--text3)"};
                       font-size:14px;cursor:pointer">
                ${n}
              </button>
            `,
              )
              .join("")}
          </div>
        </div>

        <button onclick="saveSleep()"
          style="padding:13px;background:var(--accent2);border:none;border-radius:var(--radius);
                 color:#000;font-size:14px;font-weight:700;cursor:pointer;width:100%">
          保存睡眠记录
        </button>
      </div>

    </div>
  `;
}

let _sleepScore = 0;

function selectSleepScore(n) {
  _sleepScore = n;
  [1, 2, 3, 4, 5].forEach((i) => {
    const btn = document.getElementById("sleep-score-" + i);
    const c = sleepQualityColor(n);
    btn.style.borderColor = i <= n ? c : "var(--border)";
    btn.style.background = i <= n ? c + "33" : "none";
    btn.style.color = i <= n ? c : "var(--text3)";
  });
}

async function saveSleep() {
  const sleepTime = document.getElementById("sleepTimeInput")?.value;
  const wakeTime = document.getElementById("wakeTimeInput")?.value;
  if (!sleepTime || !wakeTime) {
    alert("请填写入睡和起床时间");
    return;
  }
  await saveSleepData(selectedDate, sleepTime, wakeTime, _sleepScore);
  await renderSleep(selectedDate);
}
