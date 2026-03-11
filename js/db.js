// ═══════════════════════════════════════════════════════════════════
// db.js — 数据读写层（通过 Storage adapter 自动切换本地/云端）
// 依赖：Storage, DEVICE_ID（index.html 全局）
// ═══════════════════════════════════════════════════════════════════

// ── Profile ───────────────────────────────────────────────────────
const _defaultProfile = {
  height: 160,
  weight: 60,
  calTarget: 1450,
  protTarget: 65,
  fatTarget: 48,
  carbTarget: 160,
  workoutIntensity: 5,
};

async function getProfile() {
  const data = await Storage.getProfile(DEVICE_ID);
  // profiles 表原来存的是 data.data，兼容两种格式
  return data?.data || data || { ..._defaultProfile };
}

async function saveProfileData(p) {
  await Storage.saveProfile(DEVICE_ID, { data: p });
}

// ── Diet logs ─────────────────────────────────────────────────────
async function getDayData(dateStr) {
  return await Storage.getDayData(DEVICE_ID, dateStr);
}

async function saveDayData(dateStr, dayData) {
  _monthFetched.delete(dateStr.slice(0, 7));
  await Storage.saveDayData(DEVICE_ID, dateStr, dayData);
}

// ── Weight logs ───────────────────────────────────────────────────
async function getWeight(dateStr) {
  const data = await Storage.getTrackerData(DEVICE_ID, "weight_" + dateStr);
  return data?.value || 0;
}

async function saveWeightValue(dateStr, value) {
  await Storage.saveTrackerData(DEVICE_ID, "weight_" + dateStr, { value });
}

// ── Settings helper ───────────────────────────────────────────────
async function _getSetting(key) {
  try {
    return await Storage.getSetting(DEVICE_ID, key);
  } catch (e) {
    return null;
  }
}

async function _setSetting(key, value) {
  await Storage.setSetting(DEVICE_ID, key, value);
}

// ── Supplement list ───────────────────────────────────────────────
async function getSuppList() {
  try {
    const raw = await _getSetting("supp_list");
    if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
    return [
      { id: "vit_b", name: "维生素 B 族", times: 1, icon: "💊", note: "" },
      { id: "mag", name: "镁", times: 3, icon: "🟤", note: "随餐" },
    ];
  } catch (e) {
    return [];
  }
}

async function saveSuppList(list) {
  await _setSetting("supp_list", JSON.stringify(list));
}

// ── Supplement daily data ─────────────────────────────────────────
async function getSuppData(date) {
  try {
    const raw = await _getSetting("supp_" + date);
    if (!raw) return {};
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch (e) {
    return {};
  }
}

async function saveSuppData(date, suppData) {
  await _setSetting("supp_" + date, JSON.stringify(suppData));
}

// ── Month prefetch ────────────────────────────────────────────────
async function prefetchMonth(year, month) {
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  if (_monthFetched.has(key)) return;
  _monthFetched.add(key);
  try {
    const monthData = await Storage.getMonthData(DEVICE_ID, year, month);
    Object.entries(monthData).forEach(([date, data]) => {
      _dayDataCache[date] = data || {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      };
    });
  } catch (e) {}
}
