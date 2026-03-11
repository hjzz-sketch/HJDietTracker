/**
 * storage.js — 统一存储适配器
 *
 * 根据页面是否配置了 Supabase，自动切换后端：
 *   - 未配置 → LocalStorageAdapter（纯本地，无需任何账号）
 *   - 已配置 → SupabaseAdapter（云端同步，需自建 Supabase 项目）
 *
 * 外部代码统一调用 window.Storage，不需要关心底层实现。
 *
 * 数据表结构见 supabase/schema.sql
 */

// ─────────────────────────────────────────────────────────────
// LocalStorage Adapter
// 所有数据存储在浏览器本地，清除浏览器数据会丢失
// ─────────────────────────────────────────────────────────────
class LocalStorageAdapter {
  constructor() {
    this.type = "local";
    console.log("[Storage] 使用本地存储模式 (LocalStorage)");
  }

  // 内部 key 前缀，避免和其他网站冲突
  _k(userId, table, ...parts) {
    return (
      `diet:${userId}:${table}` + (parts.length ? ":" + parts.join(":") : "")
    );
  }

  _get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }

  _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error("[Storage] localStorage 写入失败:", e);
      return false;
    }
  }

  // ── 密码验证（本地 hash 存储）──────────────────────────────
  async getStoredHash(userId) {
    return this._get(this._k(userId, "settings", "_pwd_hash"));
  }

  async storeHash(userId, hash) {
    this._set(this._k(userId, "settings", "_pwd_hash"), hash);
  }

  // ── 设置项（API Key 等）────────────────────────────────────
  async getSetting(userId, key) {
    const map = this._get(this._k(userId, "settings")) || {};
    return map[key] ?? null;
  }

  async setSetting(userId, key, value) {
    const k = this._k(userId, "settings");
    const map = this._get(k) || {};
    map[key] = value;
    this._set(k, map);
  }

  // ── 每日饮食记录 ───────────────────────────────────────────
  // 格式：{ breakfast: [...], lunch: [...], dinner: [...], snack: [...] }
  async getDayData(userId, dateStr) {
    return (
      this._get(this._k(userId, "diet", dateStr)) || {
        breakfast: [],
        lunch: [],
        dinner: [],
        snack: [],
      }
    );
  }

  async saveDayData(userId, dateStr, data) {
    this._set(this._k(userId, "diet", dateStr), data);
  }

  // 批量获取某月的数据（用于日历展示）
  async getMonthData(userId, year, month) {
    const result = {};
    // month 为 0-indexed
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const data = this._get(this._k(userId, "diet", ds));
      if (data) result[ds] = data;
    }
    return result;
  }

  // 批量获取某日期范围的数据（用于图表分析）
  async getRangeData(userId, startDateStr, endDateStr) {
    const result = {};
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const data = this._get(this._k(userId, "diet", ds));
      if (data) result[ds] = data;
    }
    return result;
  }

  // ── 自定义食物 ─────────────────────────────────────────────
  async getCustomFoods(userId) {
    return this._get(this._k(userId, "custom_foods")) || [];
  }

  async saveCustomFoods(userId, foods) {
    this._set(this._k(userId, "custom_foods"), foods);
  }

  // ── 个人资料 ───────────────────────────────────────────────
  async getProfile(userId) {
    return this._get(this._k(userId, "profile")) || null;
  }

  async saveProfile(userId, profile) {
    this._set(this._k(userId, "profile"), {
      ...profile,
      updated_at: new Date().toISOString(),
    });
  }

  // ── 运动记录 ───────────────────────────────────────────────
  async getWorkout(userId, dateStr) {
    return this._get(this._k(userId, "workout", dateStr)) || null;
  }

  async saveWorkout(userId, dateStr, data) {
    this._set(this._k(userId, "workout", dateStr), {
      ...data,
      updated_at: new Date().toISOString(),
    });
  }

  async getWorkoutRange(userId, startDateStr, endDateStr) {
    const result = {};
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const data = this._get(this._k(userId, "workout", ds));
      if (data) result[ds] = data;
    }
    return result;
  }

  // ── 睡眠记录 ───────────────────────────────────────────────
  async getSleep(userId, dateStr) {
    return this._get(this._k(userId, "sleep", dateStr)) || null;
  }

  async saveSleep(userId, dateStr, data) {
    this._set(this._k(userId, "sleep", dateStr), {
      ...data,
      updated_at: new Date().toISOString(),
    });
  }

  async getSleepRange(userId, startDateStr, endDateStr) {
    const result = {};
    const start = new Date(startDateStr + "T00:00:00");
    const end = new Date(endDateStr + "T00:00:00");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const data = this._get(this._k(userId, "sleep", ds));
      if (data) result[ds] = data;
    }
    return result;
  }

  // ── 周期记录（period.js 用）────────────────────────────────
  async getPeriodLog(userId) {
    return this._get(this._k(userId, "period")) || [];
  }

  async savePeriodLog(userId, log) {
    this._set(this._k(userId, "period"), log);
  }

  // ── 通用追踪器（tracker.js 用）────────────────────────────
  async getTrackerData(userId, trackerKey) {
    return this._get(this._k(userId, "tracker", trackerKey)) || {};
  }

  async saveTrackerData(userId, trackerKey, data) {
    this._set(this._k(userId, "tracker", trackerKey), data);
  }
}

// ─────────────────────────────────────────────────────────────
// Supabase Adapter
// 数据存储在你自己的 Supabase 项目，支持多设备同步
// ─────────────────────────────────────────────────────────────
class SupabaseAdapter {
  constructor(sb) {
    this.sb = sb; // supabase client 实例
    this.type = "supabase";
    console.log("[Storage] 使用云端存储模式 (Supabase)");
  }

  // ── 密码验证 ───────────────────────────────────────────────
  async getStoredHash(userId) {
    try {
      const { data } = await this.sb
        .from("settings")
        .select("value")
        .eq("device_id", userId)
        .eq("key", "_pwd_hash")
        .maybeSingle();
      return data?.value || null;
    } catch {
      return null;
    }
  }

  async storeHash(userId, hash) {
    await this.sb.from("settings").upsert(
      {
        device_id: userId,
        key: "_pwd_hash",
        value: hash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,key" },
    );
  }

  // ── 设置项 ─────────────────────────────────────────────────
  async getSetting(userId, key) {
    const { data } = await this.sb
      .from("settings")
      .select("value")
      .eq("device_id", userId)
      .eq("key", key)
      .maybeSingle();
    return data?.value ?? null;
  }

  async setSetting(userId, key, value) {
    await this.sb
      .from("settings")
      .upsert(
        { device_id: userId, key, value, updated_at: new Date().toISOString() },
        { onConflict: "device_id,key" },
      );
  }

  // ── 每日饮食记录 ───────────────────────────────────────────
  async getDayData(userId, dateStr) {
    const { data } = await this.sb
      .from("diet_logs")
      .select("data")
      .eq("device_id", userId)
      .eq("date", dateStr)
      .maybeSingle();
    return data?.data || { breakfast: [], lunch: [], dinner: [], snack: [] };
  }

  async saveDayData(userId, dateStr, data) {
    await this.sb.from("diet_logs").upsert(
      {
        device_id: userId,
        date: dateStr,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,date" },
    );
  }

  async getMonthData(userId, year, month) {
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${new Date(year, month + 1, 0).getDate()}`;
    const { data } = await this.sb
      .from("diet_logs")
      .select("date, data")
      .eq("device_id", userId)
      .gte("date", start)
      .lte("date", end);
    const result = {};
    (data || []).forEach((row) => (result[row.date] = row.data));
    return result;
  }

  async getRangeData(userId, startDateStr, endDateStr) {
    const { data } = await this.sb
      .from("diet_logs")
      .select("date, data")
      .eq("device_id", userId)
      .gte("date", startDateStr)
      .lte("date", endDateStr);
    const result = {};
    (data || []).forEach((row) => (result[row.date] = row.data));
    return result;
  }

  // ── 自定义食物 ─────────────────────────────────────────────
  async getCustomFoods(userId) {
    const { data } = await this.sb
      .from("custom_foods")
      .select("data")
      .eq("device_id", userId)
      .maybeSingle();
    return data?.data || [];
  }

  async saveCustomFoods(userId, foods) {
    await this.sb.from("custom_foods").upsert(
      {
        device_id: userId,
        data: foods,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id" },
    );
  }

  // ── 个人资料 ───────────────────────────────────────────────
  async getProfile(userId) {
    const { data } = await this.sb
      .from("profiles")
      .select("*")
      .eq("device_id", userId)
      .maybeSingle();
    return data || null;
  }

  async saveProfile(userId, profile) {
    await this.sb
      .from("profiles")
      .upsert(
        { ...profile, device_id: userId, updated_at: new Date().toISOString() },
        { onConflict: "device_id" },
      );
  }

  // ── 运动记录 ───────────────────────────────────────────────
  async getWorkout(userId, dateStr) {
    const { data } = await this.sb
      .from("workout_logs")
      .select("*")
      .eq("device_id", userId)
      .eq("date", dateStr)
      .maybeSingle();
    return data || null;
  }

  async saveWorkout(userId, dateStr, workoutData) {
    await this.sb.from("workout_logs").upsert(
      {
        ...workoutData,
        device_id: userId,
        date: dateStr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,date" },
    );
  }

  async getWorkoutRange(userId, startDateStr, endDateStr) {
    const { data } = await this.sb
      .from("workout_logs")
      .select("*")
      .eq("device_id", userId)
      .gte("date", startDateStr)
      .lte("date", endDateStr);
    const result = {};
    (data || []).forEach((row) => (result[row.date] = row));
    return result;
  }

  // ── 睡眠记录 ───────────────────────────────────────────────
  async getSleep(userId, dateStr) {
    const { data } = await this.sb
      .from("sleep_logs")
      .select("*")
      .eq("device_id", userId)
      .eq("date", dateStr)
      .maybeSingle();
    return data || null;
  }

  async saveSleep(userId, dateStr, sleepData) {
    await this.sb.from("sleep_logs").upsert(
      {
        ...sleepData,
        device_id: userId,
        date: dateStr,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,date" },
    );
  }

  async getSleepRange(userId, startDateStr, endDateStr) {
    const { data } = await this.sb
      .from("sleep_logs")
      .select("*")
      .eq("device_id", userId)
      .gte("date", startDateStr)
      .lte("date", endDateStr);
    const result = {};
    (data || []).forEach((row) => (result[row.date] = row));
    return result;
  }

  // ── 周期记录 ───────────────────────────────────────────────
  async getPeriodLog(userId) {
    const { data } = await this.sb
      .from("period_logs")
      .select("data")
      .eq("device_id", userId)
      .maybeSingle();
    return data?.data || [];
  }

  async savePeriodLog(userId, log) {
    await this.sb
      .from("period_logs")
      .upsert(
        { device_id: userId, data: log, updated_at: new Date().toISOString() },
        { onConflict: "device_id" },
      );
  }

  // ── 通用追踪器 ─────────────────────────────────────────────
  async getTrackerData(userId, trackerKey) {
    const { data } = await this.sb
      .from("tracker_logs")
      .select("data")
      .eq("device_id", userId)
      .eq("tracker_key", trackerKey)
      .maybeSingle();
    return data?.data || {};
  }

  async saveTrackerData(userId, trackerKey, data) {
    await this.sb.from("tracker_logs").upsert(
      {
        device_id: userId,
        tracker_key: trackerKey,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "device_id,tracker_key" },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// 初始化：根据配置自动选择 adapter
// ─────────────────────────────────────────────────────────────
(function initStorage() {
  // 从 config.js 读取（如果存在），否则使用 localStorage
  const cfg = window.APP_CONFIG || {};

  if (cfg.SUPABASE_URL && cfg.SUPABASE_KEY) {
    // 云端模式：使用用户自己的 Supabase
    if (typeof supabase === "undefined") {
      console.error("[Storage] 已配置 Supabase 但 SDK 未加载，退回本地模式");
      window.Storage = new LocalStorageAdapter();
      return;
    }
    const sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);
    window.sb = sb; // 保持向后兼容（如果其他地方直接用了 sb）
    window.Storage = new SupabaseAdapter(sb);
  } else {
    // 本地模式
    window.sb = null;
    window.Storage = new LocalStorageAdapter();
  }
})();
