// ═══════════════════════════════════════════════════════════════════
// workout.js — 运动记录模块
// 依赖：index.html 中的 Storage, DEVICE_ID, selectedDate
// ═══════════════════════════════════════════════════════════════════

const SPLITS = {
  legs: { label: "臀腿", color: "#c8f060", recovery: 72 },
  back_shoulder: { label: "肩背", color: "#c8f060", recovery: 60 },
  chest_shoulder: { label: "胸肩", color: "#c8f060", recovery: 60 },
};

const DEFAULT_EXERCISES = {
  legs: ["足踝强化", "罗马尼亚硬拉", "髋外展", "臀推", "深蹲"],
  back_shoulder: ["引体向上", "划船", "坐姿推肩", "飞鸟", "面拉", "高位下拉"],
  chest_shoulder: ["卧推", "飞鸟", "面拉", "坐姿推肩", "动态前平举"],
};

const _workoutCache = {};
const _workoutMonthFetched = new Set();

async function prefetchWorkoutMonth(year, month) {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (_workoutMonthFetched.has(key)) return;
  _workoutMonthFetched.add(key);
  // 批量获取整月数据存入 cache
  const startDate = `${key}-01`;
  const endDate = `${key}-31`;
  const monthData = await Storage.getWorkoutRange(
    DEVICE_ID,
    startDate,
    endDate,
  );
  Object.assign(_workoutCache, monthData);
}

async function getWorkoutData(date) {
  const [y, m] = date.split("-").map(Number);
  await prefetchWorkoutMonth(y, m - 1);
  return _workoutCache[date] !== undefined ? _workoutCache[date] : null;
}

async function deleteWorkoutData(date) {
  _workoutMonthFetched.delete(date.slice(0, 7));
  delete _workoutCache[date];
  // localStorage 模式：存 null 表示删除；Supabase 模式：storage.js 里可扩展
  // 简单做法：saveSleep 存空对象，读取时判断是否有 split 字段
  await Storage.saveWorkout(DEVICE_ID, date, null);
}

async function saveWorkoutData(date, split, exercises) {
  _workoutMonthFetched.delete(date.slice(0, 7));
  delete _workoutCache[date];
  await Storage.saveWorkout(DEVICE_ID, date, { split, exercises });
}

async function workoutDotProvider(ds) {
  const d = await getWorkoutData(ds);
  return d && d.split ? '<div class="cal-dot dot-workout"></div>' : "";
}
if (typeof _dotProviders !== "undefined")
  _dotProviders.push(workoutDotProvider);

async function renderWorkout(date) {
  const container = document.getElementById("workoutContainer");
  if (!container) return;
  const existing = await getWorkoutData(date);
  const todayDate = new Date().toISOString().slice(0, 10);
  const isToday = date === todayDate;
  const lastWorkouts = isToday ? await getLastWorkouts() : {};

  let periodWarningHtml = "";
  if (typeof getPeriodWorkoutWarning === "function") {
    const warning = await getPeriodWorkoutWarning(date);
    if (warning) {
      periodWarningHtml = `<div style="padding:10px 12px;background:#f0608018;border:1px solid #f0608044;
        border-radius:8px;font-size:13px;color:#f06080;margin-bottom:12px">${warning}</div>`;
    }
  }

  if (existing) {
    _currentSplit = existing.split;
    _exerciseMap = {};
    existing.exercises.forEach((ex) => {
      const uid = _nextUid();
      _exerciseMap[uid] = { name: ex.name, sets: ex.sets || [] };
      ex.uid = uid;
    });
  }

  container.innerHTML = `
    <div style="padding:0 0 16px">
      ${periodWarningHtml}
      <div style="font-size:13px;color:var(--text2);margin-bottom:12px">${isToday ? "选择今日训练分化" : "选择训练分化"}</div>
      <div style="display:flex;gap:8px;margin-bottom:16px">
        ${Object.entries(SPLITS)
          .map(
            ([key, s]) => `
          <button onclick="selectSplit('${key}')" id="split-btn-${key}"
            style="flex:1;padding:10px 4px;border-radius:10px;border:1.5px solid ${existing?.split === key ? s.color : "var(--border)"};
                   background:${existing?.split === key ? s.color + "22" : "none"};
                   color:${existing?.split === key ? s.color : "var(--text2)"};
                   font-size:13px;font-weight:600;cursor:pointer">
            ${s.label}
            ${getRecoveryWarning(key, lastWorkouts)}
          </button>`,
          )
          .join("")}
      </div>
      <div id="exerciseList">
        ${existing ? renderExerciseList(existing.split, existing.exercises, date) : '<div style="color:var(--text3);text-align:center;padding:24px;font-size:13px">选择分化后开始记录</div>'}
      </div>
    </div>
  `;
}

function getRecoveryWarning(splitKey, lastWorkouts) {
  if (!lastWorkouts[splitKey]) return "";
  const hoursAgo =
    (Date.now() - new Date(lastWorkouts[splitKey]).getTime()) / 3600000;
  const remaining = Math.ceil(SPLITS[splitKey].recovery - hoursAgo);
  if (remaining > 0)
    return `<div style="font-size:9px;color:#f0a060">还需休息 ${remaining}h</div>`;
  return '<div style="font-size:9px;color:#60f0a0">✓ 已恢复</div>';
}

async function getLastWorkouts() {
  // 获取最近30天的运动记录，找出每个分化最近一次的日期
  const result = {};
  const todayDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const startStr = startDate.toISOString().slice(0, 10);

  const rangeData = await Storage.getWorkoutRange(
    DEVICE_ID,
    startStr,
    todayDate,
  );
  // 按日期降序排列
  const sorted = Object.entries(rangeData)
    .filter(([date]) => date < todayDate)
    .sort(([a], [b]) => b.localeCompare(a));

  sorted.forEach(([date, row]) => {
    if (row && row.split && !result[row.split]) {
      result[row.split] = date;
    }
  });
  return result;
}

let _currentSplit = null;
let _exerciseMap = {};
let _exUid = 0;

function _nextUid() {
  return ++_exUid;
}

function selectSplit(splitKey) {
  if (_currentSplit === splitKey) return;
  if (_currentSplit && Object.keys(_exerciseMap).length > 0) {
    if (!confirm("切换分化将清空当前填写的数据，确定切换吗？")) return;
  }
  _currentSplit = splitKey;
  _exerciseMap = {};
  const exercises = DEFAULT_EXERCISES[splitKey].map((name) => {
    const uid = _nextUid();
    _exerciseMap[uid] = { name, sets: [{ weight: "", reps: "" }] };
    return { uid, name, sets: [{ weight: "", reps: "" }] };
  });
  document.getElementById("exerciseList").innerHTML = renderExerciseList(
    splitKey,
    exercises,
  );
  Object.keys(SPLITS).forEach((key) => {
    const btn = document.getElementById("split-btn-" + key);
    const s = SPLITS[key];
    btn.style.borderColor = key === splitKey ? s.color : "var(--border)";
    btn.style.background = key === splitKey ? s.color + "22" : "none";
    btn.style.color = key === splitKey ? s.color : "var(--text2)";
  });
}

function renderExerciseList(splitKey, exercises, date) {
  if (!exercises || !exercises.length) return "";
  const normalised = exercises.map((ex) => {
    if (ex.uid != null) return ex;
    const uid = _nextUid();
    _exerciseMap[uid] = { name: ex.name, sets: ex.sets || [] };
    return { uid, name: ex.name, sets: ex.sets || [] };
  });
  return `
    <div style="display:flex;flex-direction:column;gap:10px">
      ${
        date
          ? `
        <div style="display:flex;justify-content:flex-end;margin-bottom:-4px">
          <button onclick="deleteWorkout('${date}')"
            style="font-size:12px;color:var(--text3);background:none;border:1px solid var(--border);
                   border-radius:6px;padding:4px 10px;cursor:pointer">🗑 删除本次记录</button>
        </div>`
          : ""
      }
      <div id="exerciseCards" style="display:flex;flex-direction:column;gap:10px">
        ${normalised.map((ex) => renderExerciseCard(ex.uid, ex)).join("")}
      </div>

      <button onclick="showAddExerciseInput()" id="addExerciseBtn"
        style="padding:12px;background:none;border:1.5px dashed var(--border);border-radius:10px;
               color:var(--accent2);font-size:13px;font-weight:600;cursor:pointer;width:100%;
               display:flex;align-items:center;justify-content:center;gap:6px">
        ＋ 添加动作
      </button>
      <div id="addExerciseForm"
        style="display:none;background:var(--surface2);border-radius:10px;padding:12px;flex-direction:column;gap:8px">
        <div style="font-size:12px;color:var(--text2)">动作名称</div>
        <div style="display:flex;gap:8px">
          <input id="newExerciseName" type="text" placeholder="例如：坐姿推胸" autocomplete="off"
            onkeydown="if(event.key==='Enter')confirmAddExercise()"
            onfocus="this.style.borderColor='var(--accent2)'" onblur="this.style.borderColor='var(--border)'"
            style="flex:1;padding:10px 12px;background:var(--surface);border:1.5px solid var(--border);
                   border-radius:8px;color:var(--text);font-size:14px;outline:none"/>
          <button onclick="confirmAddExercise()"
            style="padding:10px 16px;background:var(--accent2);border:none;border-radius:8px;
                   color:#000;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap">确认</button>
          <button onclick="hideAddExerciseInput()"
            style="padding:10px 12px;background:var(--surface);border:1px solid var(--border);
                   border-radius:8px;color:var(--text2);font-size:13px;cursor:pointer">取消</button>
        </div>
      </div>

      <button onclick="saveWorkout()"
        style="margin-top:4px;padding:14px;background:var(--accent);border:none;border-radius:var(--radius);
               color:#000;font-size:15px;font-weight:700;cursor:pointer;width:100%">
        保存训练记录
      </button>
    </div>
  `;
}

function renderExerciseCard(uid, ex) {
  return `
    <div id="exercise-card-${uid}"
      style="background:var(--surface2);border-radius:10px;padding:12px;overflow:hidden;box-sizing:border-box">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:14px;font-weight:600;color:var(--text)">${ex.name}</div>
        <button onclick="removeExercise(${uid})"
          style="width:22px;height:22px;border-radius:50%;background:none;border:1px solid var(--border);
                 color:var(--text3);font-size:14px;line-height:1;cursor:pointer;flex-shrink:0"
          title="移除此动作">×</button>
      </div>
      <div id="sets-${uid}">
        ${(ex.sets || []).map((set, si) => renderSetRow(uid, si, set)).join("")}
      </div>
      <button onclick="addSet(${uid})"
        style="margin-top:6px;font-size:12px;color:var(--text3);background:none;border:1px dashed var(--border);
               border-radius:6px;padding:4px 10px;cursor:pointer;width:100%">+ 添加一组</button>
    </div>
  `;
}

function renderSetRow(uid, setIdx, set) {
  return `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;box-sizing:border-box" id="set-${uid}-${setIdx}">
      <span style="font-size:11px;color:var(--text3);flex-shrink:0;width:28px">第${setIdx + 1}组</span>
      <input type="number" placeholder="kg" value="${set.weight || ""}"
        style="flex:1;min-width:0;padding:6px 4px;background:var(--surface);border:1px solid var(--border);
               border-radius:6px;color:var(--text);font-size:13px;text-align:center;box-sizing:border-box">
      <span style="font-size:12px;color:var(--text3);flex-shrink:0">×</span>
      <input type="number" placeholder="次" value="${set.reps || ""}"
        style="flex:1;min-width:0;padding:6px 4px;background:var(--surface);border:1px solid var(--border);
               border-radius:6px;color:var(--text);font-size:13px;text-align:center;box-sizing:border-box">
    </div>
  `;
}

function addSet(uid) {
  const container = document.getElementById("sets-" + uid);
  const setIdx = container.children.length;
  container.insertAdjacentHTML("beforeend", renderSetRow(uid, setIdx, {}));
}

function showAddExerciseInput() {
  document.getElementById("addExerciseBtn").style.display = "none";
  const form = document.getElementById("addExerciseForm");
  form.style.display = "flex";
  setTimeout(() => document.getElementById("newExerciseName").focus(), 100);
}

function hideAddExerciseInput() {
  document.getElementById("addExerciseForm").style.display = "none";
  document.getElementById("addExerciseBtn").style.display = "flex";
  document.getElementById("newExerciseName").value = "";
}

function confirmAddExercise() {
  const nameInput = document.getElementById("newExerciseName");
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.style.borderColor = "#f06060";
    setTimeout(() => {
      nameInput.style.borderColor = "var(--border)";
    }, 1000);
    return;
  }
  const uid = _nextUid();
  _exerciseMap[uid] = { name, sets: [] };
  document
    .getElementById("exerciseCards")
    .insertAdjacentHTML(
      "beforeend",
      renderExerciseCard(uid, { name, sets: [{ weight: "", reps: "" }] }),
    );
  hideAddExerciseInput();
}

function removeExercise(uid) {
  const card = document.getElementById("exercise-card-" + uid);
  if (card) card.remove();
  delete _exerciseMap[uid];
}

async function deleteWorkout(date) {
  if (!confirm("确定删除这天的训练记录吗？")) return;
  await deleteWorkoutData(date);
  await renderWorkout(date);
}

async function saveWorkout() {
  if (!_currentSplit) {
    alert("请先选择训练分化");
    return;
  }
  const cards = document.querySelectorAll("[id^='exercise-card-']");
  const exercises = [];
  cards.forEach((card) => {
    const uid = parseInt(card.id.replace("exercise-card-", ""));
    const exData = _exerciseMap[uid];
    if (!exData) return;
    const setsContainer = document.getElementById("sets-" + uid);
    if (!setsContainer) return;
    const sets = Array.from(setsContainer.children).map((row) => {
      const inputs = row.querySelectorAll("input");
      return {
        weight: inputs?.[0]?.value || "",
        reps: inputs?.[1]?.value || "",
      };
    });
    exercises.push({ name: exData.name, sets });
  });
  await saveWorkoutData(selectedDate, _currentSplit, exercises);
  alert("训练记录已保存 💪");
  await renderWorkout(selectedDate);
}
