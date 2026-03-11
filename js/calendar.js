// ═══════════════════════════════════════════════════════════════════
// calendar.js — 日历模块
// 依赖：sb, DEVICE_ID, selectedDate, calYear, calMonth, DAYS_CN,
//       _dayDataCache, _dotProviders, getDayDots, prefetchMonth,
//       prefetchWorkoutMonth, hasData, getDayData, getProfile,
//       getWorkoutData, getSleepData, getPeriodPhase, SPLITS,
//       todayStr, openModal, closeModal
// ═══════════════════════════════════════════════════════════════════

async function renderCalendar() {
  const mn = document.getElementById("calMonth");
  mn.textContent = `${calYear}年${calMonth + 1}月`;
  const grid = document.getElementById("calGrid");
  grid.innerHTML = "";
  DAYS_CN.forEach((d) => {
    const el = document.createElement("div");
    el.className = "cal-day-label";
    el.textContent = d;
    grid.appendChild(el);
  });
  const first = new Date(calYear, calMonth, 1).getDay();
  for (let i = 0; i < first; i++) {
    const el = document.createElement("div");
    el.className = "cal-cell empty";
    grid.appendChild(el);
  }
  const days = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayStr();
  await prefetchMonth(calYear, calMonth);
  if (typeof prefetchWorkoutMonth === "function")
    await prefetchWorkoutMonth(calYear, calMonth);
  const allDates = [];
  for (let d = 1; d <= days; d++) {
    allDates.push(
      `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
    );
  }
  const dotsMap = {};
  await Promise.all(
    allDates.map(async (ds) => {
      dotsMap[ds] = await getDayDots(ds);
    }),
  );
  for (let d = 1; d <= days; d++) {
    const ds = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const el = document.createElement("div");
    el.className =
      "cal-cell" +
      (ds === today ? " today" : "") +
      (ds === selectedDate ? " selected" : "");
    const dots = dotsMap[ds] || "";
    el.innerHTML = `<span>${d}</span>${dots ? `<div class="cal-dots">${dots}</div>` : ""}`;
    el.onclick = async () => {
      selectedDate = ds;
      await renderCalendar();
      await renderCalDayDetail();
    };
    grid.appendChild(el);
  }
  await renderCalDayDetail();
}

async function renderCalDayDetail() {
  const detail = document.getElementById("calDayDetail");
  const d = new Date(selectedDate + "T00:00:00");
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;

  const [dayData, workoutData, sleepData, periodPhase] = await Promise.all([
    getDayData(selectedDate).then((data) => {
      _dayDataCache[selectedDate] = data;
      return data;
    }),
    typeof getWorkoutData === "function" ? getWorkoutData(selectedDate) : null,
    typeof getSleepData === "function" ? getSleepData(selectedDate) : null,
    typeof getPeriodPhase === "function" ? getPeriodPhase(selectedDate) : null,
  ]);

  const hasDiet = hasData(selectedDate);
  const hasWorkout = !!workoutData;
  const hasSleep = !!sleepData;

  if (!hasDiet && !hasWorkout && !hasSleep && !periodPhase) {
    detail.innerHTML = `<div class="section-title" style="text-align:center;padding:16px;color:var(--text3)">该日暂无记录</div>`;
    return;
  }

  // ── Diet summary ──────────────────────────────────────────────────
  let dietHtml = "";
  if (hasDiet) {
    const profile = await getProfile();
    let totP = 0,
      totF = 0,
      totC = 0,
      totK = 0;
    Object.values(dayData).forEach((arr) =>
      arr.forEach((item) => {
        const f = item.weight / 100;
        totP += item.protein * f;
        totF += item.fat * f;
        totC += item.carb * f;
        totK += item.kcal * f;
      }),
    );
    dietHtml = `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="color:var(--accent)">●</span> 饮食
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="preview-chip"><div class="pv" style="color:var(--accent)">${Math.round(totK)}</div><div class="pl">千卡 / ${profile.calTarget}目标</div></div>
          <div class="preview-chip"><div class="pv" style="color:var(--protein)">${totP.toFixed(1)}g</div><div class="pl">蛋白质</div></div>
          <div class="preview-chip"><div class="pv" style="color:var(--fat)">${totF.toFixed(1)}g</div><div class="pl">脂肪</div></div>
          <div class="preview-chip"><div class="pv" style="color:var(--carb)">${totC.toFixed(1)}g</div><div class="pl">碳水</div></div>
        </div>
      </div>`;
  }

  // ── Workout summary ───────────────────────────────────────────────
  let workoutHtml = "";
  if (hasWorkout) {
    const split = SPLITS[workoutData.split];
    const exercises = workoutData.exercises || [];
    const exListHtml = exercises
      .map((ex) => {
        const validSets = (ex.sets || []).filter((s) => s.weight || s.reps);
        const setsHtml = validSets
          .map(
            (s, si) =>
              `<div style="display:flex;gap:12px;font-size:12px;color:var(--text2);padding:3px 0">
          <span style="color:var(--text3);min-width:32px">第${si + 1}组</span>
          <span>${s.weight ? s.weight + "kg" : "--"} × ${s.reps ? s.reps + "次" : "--"}</span>
        </div>`,
          )
          .join("");
        return `
        <div style="border-bottom:1px solid var(--border)">
          <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'"
            style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;cursor:pointer">
            <span style="font-size:13px;color:var(--text)">${ex.name}</span>
            <span style="font-size:11px;color:var(--text3)">${validSets.length}组 ›</span>
          </div>
          <div style="display:none;padding:0 12px 8px;background:var(--surface)">
            ${setsHtml || '<span style="font-size:12px;color:var(--text3)">暂无数据</span>'}
          </div>
        </div>`;
      })
      .join("");

    workoutHtml = `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="color:#60f0a0">●</span> 运动
        </div>
        <div style="background:var(--surface2);border-radius:8px;overflow:hidden">
          <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'"
            style="padding:10px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer">
            <span style="font-size:14px;font-weight:600;color:${split?.color || "#60f0a0"}">${split?.label || workoutData.split}</span>
            <span style="font-size:12px;color:var(--text3)">${exercises.length} 个动作 ›</span>
          </div>
          <div style="display:none">${exListHtml}</div>
        </div>
      </div>`;
  }

  // ── Sleep summary ─────────────────────────────────────────────────
  let sleepHtml = "";
  if (hasSleep) {
    const dur =
      sleepData.sleep_time && sleepData.wake_time
        ? (() => {
            const [sh, sm] = sleepData.sleep_time.split(":").map(Number);
            const [wh, wm] = sleepData.wake_time.split(":").map(Number);
            let mins = wh * 60 + wm - (sh * 60 + sm);
            if (mins < 0) mins += 1440;
            return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? (mins % 60) + "m" : ""}`;
          })()
        : "--";
    const stars =
      "★".repeat(sleepData.score || 0) + "☆".repeat(5 - (sleepData.score || 0));
    sleepHtml = `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="color:#60c8f0">●</span> 睡眠
        </div>
        <div style="background:var(--surface2);border-radius:8px;padding:10px 12px;
                    display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:14px;font-weight:600;color:#60c8f0">${dur}</span>
          <span style="font-size:13px;color:#f0c060">${stars}</span>
        </div>
      </div>`;
  }

  // ── Period phase ──────────────────────────────────────────────────
  let periodHtml = "";
  if (periodPhase) {
    periodHtml = `
      <div style="margin-bottom:10px">
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;display:flex;align-items:center;gap:6px">
          <span style="color:#f06080">●</span> 经期
        </div>
        <div style="background:${periodPhase.color}18;border:1px solid ${periodPhase.color}44;
                    border-radius:8px;padding:8px 12px;font-size:13px;
                    font-weight:600;color:${periodPhase.color}">
          ${periodPhase.label} · 第${periodPhase.cycleDay}天
        </div>
      </div>`;
  }

  detail.innerHTML = `
    <div class="section-title">${dateLabel} · 汇总</div>
    <div class="analysis-card">
      ${dietHtml}${workoutHtml}${sleepHtml}${periodHtml}
    </div>`;
}

async function changeMonth(dir) {
  calMonth += dir;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  await renderCalendar();
}
