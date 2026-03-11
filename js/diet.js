// ═══════════════════════════════════════════════════════════════════
// diet.js — 饮食记录、添加食物、补剂、个人设置
// 依赖：sb, DEVICE_ID, selectedDate, currentMeal, selectedFood,
//       FOOD_DB, MEALS, mealKey, _dayDataCache, _monthFetched,
//       getDayData, saveDayData, getWeight, saveWeightValue,
//       getProfile, saveProfileData, getSuppData, saveSuppData,
//       openModal, closeModal, renderDateStrip, renderTodayTab（循环引用，
//       diet.js 自身定义 renderTodayTab）
// ═══════════════════════════════════════════════════════════════════

// ── Supplements ───────────────────────────────────────────────────────
const SUPPLEMENTS = [
  { id: "vit_b", name: "维生素 B 族", dose: "1片", times: 1, icon: "💊" },
  { id: "mag", name: "镁", dose: "1颗", times: 3, icon: "🟤", note: "随餐" },
];

async function renderSupplements(date) {
  const container = document.getElementById("supplementList");
  if (!container) return;
  const taken = await getSuppData(date);
  container.innerHTML = SUPPLEMENTS.map((s) => {
    const count = taken[s.id] || 0;
    const done = count >= s.times;
    return `
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:16px">${s.icon}</span>
          <div>
            <span style="font-size:13px;color:${done ? "var(--accent)" : "var(--text)"};
              font-weight:${done ? "600" : "400"};
              text-decoration:${done ? "line-through" : "none"};
              opacity:${done ? "0.7" : "1"}">
              ${s.name}
            </span>
            ${s.note ? `<span style="font-size:11px;color:var(--text3);margin-left:4px">${s.note}</span>` : ""}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          ${
            s.times > 1
              ? `<span style="font-size:11px;color:var(--text3)">${count}/${s.times}</span>
               <button onclick="suppTap('${s.id}', ${s.times}, false)"
                 style="width:26px;height:26px;border-radius:50%;border:1.5px solid var(--border);
                        background:none;color:var(--text2);font-size:14px;cursor:pointer;line-height:1">−</button>`
              : ""
          }
          <button onclick="suppTap('${s.id}', ${s.times}, true)"
            style="width:${s.times > 1 ? "26px" : "60px"};height:26px;border-radius:${s.times > 1 ? "50%" : "13px"};
                   border:1.5px solid ${done ? "var(--accent)" : "var(--border)"};
                   background:${done ? "var(--accent)22" : "none"};
                   color:${done ? "var(--accent)" : "var(--text2)"};
                   font-size:${s.times > 1 ? "14px" : "12px"};cursor:pointer;font-weight:600;line-height:1">
            ${s.times > 1 ? "+" : done ? "✓" : "记录"}
          </button>
        </div>
      </div>`;
  }).join("");
}

async function suppTap(id, maxTimes, increment) {
  const taken = await getSuppData(selectedDate);
  const cur = taken[id] || 0;
  if (increment) taken[id] = Math.min(cur + 1, maxTimes);
  else taken[id] = Math.max(cur - 1, 0);
  await saveSuppData(selectedDate, taken);
  renderSupplements(selectedDate);
}

// ── Today tab ─────────────────────────────────────────────────────────
async function renderTodayTab() {
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  _dayDataCache[selectedDate] = data;
  const profile = await getProfile();
  let totP = 0,
    totF = 0,
    totC = 0,
    totK = 0,
    totFib = 0;
  Object.values(data).forEach((arr) =>
    arr.forEach((item) => {
      const f = item.weight / 100;
      totP += item.protein * f;
      totF += item.fat * f;
      totC += item.carb * f;
      totK += item.kcal * f;
      totFib += (item.fiber || 0) * f;
    }),
  );

  // Period phase banner + nutrition adjustment
  let _periodAdj = { calAdj: 0, protAdj: 0, carbAdj: 0, fatAdj: 0 };
  if (typeof renderPeriodBanner === "function") {
    const bannerHtml = await renderPeriodBanner(selectedDate);
    let bannerEl = document.getElementById("periodBanner");
    if (!bannerEl) {
      bannerEl = document.createElement("div");
      bannerEl.id = "periodBanner";
      const mealsContainer = document.getElementById("mealsContainer");
      mealsContainer.parentNode.insertBefore(bannerEl, mealsContainer);
    }
    bannerEl.innerHTML = bannerHtml;
    const phase = await getPeriodPhase(selectedDate);
    if (phase) _periodAdj = phase.nutrition;
  }

  // Workout day nutrition adjustment
  let _workoutAdj = { protAdj: 0, carbAdj: 0 };
  if (typeof getWorkoutData === "function") {
    const todayWorkout = await getWorkoutData(selectedDate);
    if (todayWorkout?.split) {
      const intensity = profile.workoutIntensity ?? 5;
      const base = 56;
      const splitWeights = {
        legs: 1.0,
        back_shoulder: 0.857,
        chest_shoulder: 0.714,
      };
      const w = splitWeights[todayWorkout.split] ?? 0;
      const kcalAdj = intensity * base * w;
      _workoutAdj.protAdj = Math.round(kcalAdj * (30 / 280));
      _workoutAdj.carbAdj = Math.round(kcalAdj * (40 / 280));
    }
  }

  // Adjusted targets
  const calTarget =
    profile.calTarget +
    (_periodAdj.calAdj || 0) +
    (_workoutAdj.protAdj * 4 + _workoutAdj.carbAdj * 4);
  const protTarget =
    profile.protTarget + (_periodAdj.protAdj || 0) + _workoutAdj.protAdj;
  const fatTarget = profile.fatTarget + (_periodAdj.fatAdj || 0);
  const carbTarget =
    profile.carbTarget + (_periodAdj.carbAdj || 0) + _workoutAdj.carbAdj;

  // Ring
  const pct = Math.min(totK / calTarget, 1);
  const circ = 238.76;
  document.getElementById("calRing").style.strokeDashoffset = circ * (1 - pct);
  document.getElementById("calRing").style.stroke =
    pct > 1 ? "#f06060" : "#c8f060";
  document.getElementById("ringKcal").textContent = Math.round(totK);

  // Macro bars
  function updateMacroBar(barId, tickId, valId, actual, target, color) {
    const pct = actual / target;
    const bar = document.getElementById(barId);
    const tick = document.getElementById(tickId);
    const valEl = document.getElementById(valId);
    const old = bar.parentElement.querySelector(".macro-over-bar");
    if (old) old.remove();
    if (pct <= 1) {
      bar.style.width = pct * 100 + "%";
      bar.style.background = color;
      bar.style.opacity = "1";
      bar.style.borderRadius = "3px";
      if (tick) tick.style.opacity = "0.35";
      const badge = valEl.querySelector(".macro-over-badge");
      if (badge) badge.remove();
    } else {
      bar.style.width = "100%";
      bar.style.background = color;
      bar.style.opacity = "0.4";
      bar.style.borderRadius = "3px";
      if (tick) tick.style.opacity = "0";
      const overFrac = Math.min((pct - 1) / pct, 0.35);
      const overBar = document.createElement("div");
      overBar.className = "macro-over-bar";
      overBar.style.cssText = `position:absolute;top:0;right:0;width:${overFrac * 100}%;height:5px;background:#f06060;border-radius:0 3px 3px 0`;
      bar.parentElement.appendChild(overBar);
      let badge = valEl.querySelector(".macro-over-badge");
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "macro-over-badge";
        valEl.appendChild(badge);
      }
      badge.textContent = "+" + (actual - target).toFixed(0) + "g";
    }
  }

  document.getElementById("proteinVal").textContent = totP.toFixed(1) + "g";
  document.getElementById("fatVal").textContent = totF.toFixed(1) + "g";
  document.getElementById("carbVal").textContent = totC.toFixed(1) + "g";
  updateMacroBar(
    "proteinBar",
    "proteinTick",
    "proteinVal",
    totP,
    protTarget,
    "var(--protein)",
  );
  updateMacroBar("fatBar", "fatTick", "fatVal", totF, fatTarget, "var(--fat)");
  updateMacroBar(
    "carbBar",
    "carbTick",
    "carbVal",
    totC,
    carbTarget,
    "var(--carb)",
  );
  const fiberTarget = 25;
  document.getElementById("fiberVal").textContent = totFib.toFixed(1) + "g";
  updateMacroBar(
    "fiberBar",
    "fiberTick",
    "fiberVal",
    totFib,
    fiberTarget,
    "var(--fiber)",
  );

  // Supplements
  renderSupplements(selectedDate);

  // Weight display
  const wt = await getWeight(selectedDate);
  const wlEl = document.getElementById("wlDisplay");
  if (wlEl) wlEl.textContent = wt ? wt.toFixed(1) : "—";

  // Meals
  const cont = document.getElementById("mealsContainer");
  cont.innerHTML = "";
  MEALS.forEach((mealName) => {
    const key = mealKey(mealName);
    const items = data[key] || [];
    const card = document.createElement("div");
    card.className = "card";
    let mealKcal = 0;
    items.forEach((item) => {
      mealKcal += (item.kcal * item.weight) / 100;
    });
    card.innerHTML = `<div class="card-header">
      <div><div class="card-title">${mealName}</div></div>
      <div style="display:flex;align-items:center;gap:8px">
        ${items.length ? `<span style="font-size:12px;color:var(--text2)">${Math.round(mealKcal)} kcal</span>` : ""}
        <button class="add-btn" onclick="openAddModal('${mealName}')">+</button>
      </div>
    </div>`;
    if (items.length === 0) {
      card.innerHTML += `<div class="empty-meal">点击 + 添加食物</div>`;
    } else {
      items.forEach((item, idx) => {
        const row = document.createElement("div");
        row.className = "meal-item";
        row.innerHTML = `<div class="meal-dot"></div>
          <div class="meal-name">${item.name}</div>
          <div class="meal-weight">${item.weight}g</div>
          <div class="meal-kcal">${((item.kcal * item.weight) / 100).toFixed(0)}</div>
          <button class="meal-edit" onclick="openEditModal('${key}',${idx})" title="修改克重">✎</button>
          <button class="meal-del" onclick="deleteItem('${key}',${idx})">−</button>`;
        card.appendChild(row);
      });
    }
    cont.appendChild(card);
  });
}

async function deleteItem(key, idx) {
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  data[key].splice(idx, 1);
  _dayDataCache[selectedDate] = data;
  await saveDayData(selectedDate, data);
  await renderTodayTab();
}

// ── Edit modal ────────────────────────────────────────────────────────
let _editKey = null,
  _editIdx = null,
  _editFood = null;

async function openEditModal(key, idx) {
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  const item = data[key][idx];
  _editKey = key;
  _editIdx = idx;
  _editFood = item;
  document.getElementById("editFoodName").textContent = item.name;
  document.getElementById("editWeightInput").value = item.weight;
  updateEditPreview();
  openModal("editModal");
  setTimeout(() => document.getElementById("editWeightInput").focus(), 300);
}

function updateEditPreview() {
  if (!_editFood) return;
  const w = parseFloat(document.getElementById("editWeightInput").value);
  if (!w || w <= 0) {
    ["epvProt", "epvFat", "epvCarb", "epvCal"].forEach(
      (id) => (document.getElementById(id).textContent = "—"),
    );
    return;
  }
  const f = w / 100;
  document.getElementById("epvProt").textContent =
    (_editFood.protein * f).toFixed(1) + "g";
  document.getElementById("epvFat").textContent =
    (_editFood.fat * f).toFixed(1) + "g";
  document.getElementById("epvCarb").textContent =
    (_editFood.carb * f).toFixed(1) + "g";
  document.getElementById("epvCal").textContent = (_editFood.kcal * f).toFixed(
    0,
  );
}

async function saveEditItem() {
  const w = parseFloat(document.getElementById("editWeightInput").value);
  if (!w || w <= 0) return;
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  data[_editKey][_editIdx].weight = w;
  _dayDataCache[selectedDate] = data;
  await saveDayData(selectedDate, data);
  closeModal("editModal");
  await renderTodayTab();
}

// ── Add modal ─────────────────────────────────────────────────────────
function openAddModal(meal) {
  currentMeal = meal;
  selectedFood = null;
  document.getElementById("modalMealTitle").textContent = "添加 · " + meal;
  document.getElementById("foodSearch").value = "";
  document.getElementById("weightInput").value = "";
  document.getElementById("customForm").style.display = "none";
  updatePreview();
  filterFoods();
  openModal("addModal");
  setTimeout(() => document.getElementById("foodSearch").focus(), 300);
}

function filterFoods() {
  const q = document.getElementById("foodSearch").value.toLowerCase();
  const list = document.getElementById("foodList");
  list.innerHTML = "";
  const filtered = q
    ? FOOD_DB.filter(
        (f) =>
          f.name.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q),
      )
    : FOOD_DB.slice(0, 20);
  filtered.forEach((food) => {
    const div = document.createElement("div");
    div.className = "food-opt" + (selectedFood === food ? " selected" : "");
    div.innerHTML = `<div><div class="food-opt-name">${food.name}</div><div class="food-opt-cat">${food.cat}</div></div>
      <div class="food-opt-macro">${food.protein}蛋 / ${food.fat}脂 / ${food.carb}碳<br>${food.kcal.toFixed(0)} kcal/100g</div>`;
    div.onclick = () => {
      selectedFood = food;
      filterFoods();
      updatePreview();
    };
    list.appendChild(div);
  });
}

function updatePreview() {
  const w = parseFloat(document.getElementById("weightInput").value);
  const btn = document.getElementById("confirmAddBtn");
  const microDiv = document.getElementById("microPreview");
  if (!selectedFood || !w || w <= 0) {
    ["pvProt", "pvFat", "pvCarb", "pvCal"].forEach(
      (id) => (document.getElementById(id).textContent = "—"),
    );
    if (microDiv) microDiv.innerHTML = "";
    btn.disabled = true;
    return;
  }
  const f = w / 100;
  document.getElementById("pvProt").textContent =
    (selectedFood.protein * f).toFixed(1) + "g";
  document.getElementById("pvFat").textContent =
    (selectedFood.fat * f).toFixed(1) + "g";
  document.getElementById("pvCarb").textContent =
    (selectedFood.carb * f).toFixed(1) + "g";
  document.getElementById("pvCal").textContent = (
    selectedFood.kcal * f
  ).toFixed(0);
  btn.disabled = false;
  if (microDiv) {
    const micros = [
      { key: "fiber", label: "膳食纤维", unit: "g" },
      { key: "Ca", label: "钙", unit: "mg" },
      { key: "Fe", label: "铁", unit: "mg" },
      { key: "Zn", label: "锌", unit: "mg" },
      { key: "Se", label: "硒", unit: "μg" },
      { key: "Na", label: "钠", unit: "mg" },
      { key: "K", label: "钾", unit: "mg" },
      { key: "Mg", label: "镁", unit: "mg" },
      { key: "vitA", label: "维生素A", unit: "μg" },
      { key: "vitC", label: "维生素C", unit: "mg" },
      { key: "vitE", label: "维生素E", unit: "mg" },
      { key: "cholesterol", label: "胆固醇", unit: "mg" },
    ];
    const hasAny = micros.some((m) => selectedFood[m.key] > 0);
    if (!hasAny) {
      microDiv.innerHTML = "";
      return;
    }
    microDiv.innerHTML =
      '<div class="micro-section-title">微量元素 / 100g摄入量</div><div class="micro-grid">' +
      micros
        .filter((m) => selectedFood[m.key] > 0)
        .map((m) => {
          const val = selectedFood[m.key] * f;
          const display =
            val < 0.1
              ? val.toFixed(2)
              : val < 10
                ? val.toFixed(1)
                : val.toFixed(0);
          return `<div class="micro-chip"><div class="mv">${display}${m.unit}</div><div class="ml">${m.label}</div></div>`;
        })
        .join("") +
      "</div>";
  }
}

async function confirmAdd() {
  const w = parseFloat(document.getElementById("weightInput").value);
  if (!selectedFood || !w) return;
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  const key = mealKey(currentMeal);
  data[key].push({
    name: selectedFood.name,
    weight: w,
    protein: selectedFood.protein,
    fat: selectedFood.fat,
    carb: selectedFood.carb,
    kcal: selectedFood.kcal,
    fiber: selectedFood.fiber || 0,
    Ca: selectedFood.Ca || 0,
    Fe: selectedFood.Fe || 0,
    Zn: selectedFood.Zn || 0,
    Se: selectedFood.Se || 0,
    Na: selectedFood.Na || 0,
    K: selectedFood.K || 0,
    Mg: selectedFood.Mg || 0,
    vitA: selectedFood.vitA || 0,
    vitC: selectedFood.vitC || 0,
    vitE: selectedFood.vitE || 0,
    cholesterol: selectedFood.cholesterol || 0,
  });
  _dayDataCache[selectedDate] = data;
  await saveDayData(selectedDate, data);
  closeModal("addModal");
  await renderTodayTab();
  await renderDateStrip();
}

// Called by AI estimate — adds a single item to currentMeal without closing modal
async function _addItemToMeal(item) {
  const data = _dayDataCache[selectedDate] || (await getDayData(selectedDate));
  const key = mealKey(currentMeal);
  data[key].push({
    name: item.name,
    weight: item.weight,
    protein: item.protein || 0,
    fat: item.fat || 0,
    carb: item.carb || 0,
    kcal: item.kcal || 0,
    fiber: 0,
    Ca: 0,
    Fe: 0,
    Zn: 0,
    Se: 0,
    Na: 0,
    K: 0,
    Mg: 0,
    vitA: 0,
    vitC: 0,
    vitE: 0,
    cholesterol: 0,
  });
  _dayDataCache[selectedDate] = data;
  await saveDayData(selectedDate, data);
}

// ── Custom food ───────────────────────────────────────────────────────
function toggleCustom() {
  const f = document.getElementById("customForm");
  f.style.display = f.style.display === "none" ? "flex" : "none";
}

async function saveCustomFood() {
  const name = document.getElementById("customName").value.trim();
  const protein =
    parseFloat(document.getElementById("customProtein").value) || 0;
  const fat = parseFloat(document.getElementById("customFat").value) || 0;
  const carb = parseFloat(document.getElementById("customCarb").value) || 0;
  if (!name) return;
  const kcalInput = parseFloat(document.getElementById("customKcal").value);
  const kcal = kcalInput > 0 ? kcalInput : protein * 4 + fat * 9 + carb * 4;
  const food = { cat: "自定义", name, protein, fat, carb, kcal };
  FOOD_DB.push(food);
  const { data: existing } = await sb
    .from("custom_foods")
    .select("data")
    .eq("device_id", DEVICE_ID)
    .maybeSingle();
  const customs = existing?.data || [];
  customs.push(food);
  await sb
    .from("custom_foods")
    .upsert(
      { device_id: DEVICE_ID, data: customs },
      { onConflict: "device_id" },
    );
  document.getElementById("customForm").style.display = "none";
  [
    "customName",
    "customProtein",
    "customFat",
    "customCarb",
    "customKcal",
  ].forEach((id) => (document.getElementById(id).value = ""));
  selectedFood = food;
  document.getElementById("foodSearch").value = food.name;
  filterFoods();
  updatePreview();
  const weightInput = document.getElementById("weightInput");
  weightInput.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => weightInput.focus(), 300);
}

// ── Weight (inline save) ──────────────────────────────────────────────
async function saveWeight() {
  const v = parseFloat(document.getElementById("wlInput").value);
  if (!v || v < 20 || v > 300) return;
  await saveWeightValue(selectedDate, v);
  document.getElementById("wlDisplay").textContent = v.toFixed(1);
  document.getElementById("wlInput").value = "";
}

// ── Profile ───────────────────────────────────────────────────────────
function _workoutAdjPreview(intensity) {
  const base = 56;
  const splits = [
    { label: "臀腿", w: 1.0 },
    { label: "肩背", w: 0.857 },
    { label: "胸肩", w: 0.714 },
  ];
  return splits
    .map((s) => {
      const kcal = Math.round(intensity * base * s.w);
      const prot = Math.round(kcal * (30 / 280));
      const carb = Math.round(kcal * (40 / 280));
      return `${s.label} +${prot}g蛋白 +${carb}g碳水 (+${kcal}kcal)`;
    })
    .join("　·　");
}

async function loadProfile() {
  const p = await getProfile();
  document.getElementById("pHeight").value = p.height;
  document.getElementById("pWeight").value = p.weight;
  document.getElementById("pCalTarget").value = p.calTarget;
  document.getElementById("pProtTarget").value = p.protTarget;
  document.getElementById("pFatTarget").value = p.fatTarget;
  document.getElementById("pCarbTarget").value = p.carbTarget;
  const intensity = p.workoutIntensity ?? 5;
  const slider = document.getElementById("pWorkoutIntensity");
  slider.value = intensity;
  document.getElementById("pIntensityVal").textContent = intensity;
  document.getElementById("pIntensityPreview").textContent =
    _workoutAdjPreview(intensity);
  slider.oninput = function () {
    document.getElementById("pIntensityVal").textContent = this.value;
    document.getElementById("pIntensityPreview").textContent =
      _workoutAdjPreview(+this.value);
  };
}

async function openProfile() {
  await loadProfile();
  document.getElementById("pUserId").value = DEVICE_ID || "";
  openModal("profileModal");
  if (typeof renderPeriodSettings === "function") renderPeriodSettings();
  if (typeof renderTrackerSettings === "function") renderTrackerSettings();
}

async function saveProfile() {
  const newId = document.getElementById("pUserId").value;
  if (newId && newId !== DEVICE_ID) {
    if (!setUserId(newId)) {
      alert("ID 格式不对，只能用英文小写字母、数字和下划线");
      return;
    }
    Object.keys(_dayDataCache).forEach((k) => delete _dayDataCache[k]);
    _monthFetched.clear();
  }
  await saveProfileData({
    height: +document.getElementById("pHeight").value,
    weight: +document.getElementById("pWeight").value,
    calTarget: +document.getElementById("pCalTarget").value,
    protTarget: +document.getElementById("pProtTarget").value,
    fatTarget: +document.getElementById("pFatTarget").value,
    carbTarget: +document.getElementById("pCarbTarget").value,
    workoutIntensity: +document.getElementById("pWorkoutIntensity").value,
  });
  if (typeof flushTrackerFields === "function") await flushTrackerFields();
  closeModal("profileModal");
  await renderTodayTab();
}
