// ═══════════════════════════════════════════════════════════════════
// tracker.js — 身体指标记录模块
// 依赖：Storage, DEVICE_ID, selectedDate, openModal, closeModal
// ═══════════════════════════════════════════════════════════════════

// ── Storage helpers ───────────────────────────────────────────────

async function getTrackerFields() {
  try {
    const raw = await _getSetting("tracker_fields");
    if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
    return _defaultTrackerFields();
  } catch (e) {
    return _defaultTrackerFields();
  }
}

function _defaultTrackerFields() {
  return [
    { id: "waist", name: "腰围", unit: "cm" },
    { id: "hip", name: "臀围", unit: "cm" },
    { id: "thigh", name: "大腿围", unit: "cm" },
  ];
}

async function saveTrackerFields(fields) {
  await _setSetting("tracker_fields", JSON.stringify(fields));
}

async function getTrackerLog(dateStr) {
  try {
    return await Storage.getTrackerData(DEVICE_ID, dateStr);
  } catch (e) {
    return {};
  }
}

async function saveTrackerLog(dateStr, log) {
  await Storage.saveTrackerData(DEVICE_ID, dateStr, log);
}

// 获取最近 N 天的 tracker 记录（用于图表）
async function getTrackerHistory(days) {
  const result = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    try {
      const data = await Storage.getTrackerData(DEVICE_ID, ds);
      if (data && Object.keys(data).length > 0) result[ds] = data;
    } catch (e) {}
  }
  return result;
}

// ── Record modal ──────────────────────────────────────────────────

async function openTrackerModal() {
  const fields = await getTrackerFields();
  const log = await getTrackerLog(selectedDate);
  const d = new Date(selectedDate + "T00:00:00");
  const dateLabel = `${d.getMonth() + 1}月${d.getDate()}日`;

  document.getElementById("trackerModalTitle").textContent =
    `记录 · ${dateLabel}`;

  const weightVal = log["weight"] || "";

  const fieldsHtml = fields
    .map(
      (f) => `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:14px;color:var(--text)">${f.name}</span>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" id="tracker-${f.id}" value="${log[f.id] || ""}"
          placeholder="—"
          style="width:72px;padding:6px 10px;background:var(--surface2);
                 border:1.5px solid var(--border);border-radius:8px;
                 color:var(--text);font-size:15px;font-weight:600;
                 text-align:center;outline:none;
                 font-family:'DM Sans',sans-serif"
          onfocus="this.style.borderColor='var(--accent2)'"
          onblur="this.style.borderColor='var(--border)'"/>
        <span style="font-size:12px;color:var(--text3);min-width:20px">${f.unit}</span>
      </div>
    </div>`,
    )
    .join("");

  document.getElementById("trackerFields").innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;
                padding:10px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:14px;color:var(--text);font-weight:600">体重</span>
      <div style="display:flex;align-items:center;gap:6px">
        <input type="number" id="tracker-weight" value="${weightVal}"
          placeholder="—" step="0.1"
          style="width:72px;padding:6px 10px;background:var(--surface2);
                 border:1.5px solid var(--border);border-radius:8px;
                 color:var(--accent2);font-size:15px;font-weight:700;
                 text-align:center;outline:none;
                 font-family:'DM Sans',sans-serif"
          onfocus="this.style.borderColor='var(--accent2)'"
          onblur="this.style.borderColor='var(--border)'"/>
        <span style="font-size:12px;color:var(--text3);min-width:20px">kg</span>
      </div>
    </div>
    ${fieldsHtml}
    ${
      fields.length === 0
        ? `<div style="font-size:12px;color:var(--text3);text-align:center;padding:16px 0">
           在设置中添加自定义指标
         </div>`
        : ""
    }
  `;

  openModal("trackerModal");
  setTimeout(() => document.getElementById("tracker-weight")?.focus(), 300);
}

async function saveTrackerRecord() {
  const fields = await getTrackerFields();
  const log = {};

  const wv = parseFloat(document.getElementById("tracker-weight")?.value);
  if (wv > 0) {
    log["weight"] = wv;
    await saveWeightValue(selectedDate, wv);
    const wlEl = document.getElementById("wlDisplay");
    if (wlEl) wlEl.textContent = wv.toFixed(1);
  }

  fields.forEach((f) => {
    const v = parseFloat(document.getElementById("tracker-" + f.id)?.value);
    if (v > 0) log[f.id] = v;
  });

  await saveTrackerLog(selectedDate, log);
  closeModal("trackerModal");

  if (typeof renderTrackerChart === "function") renderTrackerChart();
}

// ── Settings: manage custom fields ───────────────────────────────

async function renderTrackerSettings() {
  const container = document.getElementById("trackerSettingsContainer");
  if (!container) return;
  const fields = await getTrackerFields();

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:8px" id="trackerFieldList">
      ${fields
        .map(
          (f, i) => `
        <div style="display:flex;align-items:center;gap:6px" id="tfield-${i}">
          <input value="${f.name}" placeholder="名称"
            onchange="updateTrackerField(${i},'name',this.value)"
            style="flex:1;padding:7px 10px;background:var(--surface);border:1px solid var(--border);
                   border-radius:7px;color:var(--text);font-size:13px;outline:none"/>
          <input value="${f.unit}" placeholder="单位" maxlength="5"
            onchange="updateTrackerField(${i},'unit',this.value)"
            style="width:52px;padding:7px 8px;background:var(--surface);border:1px solid var(--border);
                   border-radius:7px;color:var(--text2);font-size:13px;outline:none;text-align:center"/>
          <button onclick="removeTrackerField(${i})"
            style="width:26px;height:26px;border-radius:50%;background:none;
                   border:1px solid var(--border);color:var(--text3);font-size:14px;cursor:pointer">×</button>
        </div>`,
        )
        .join("")}
    </div>
    <button onclick="addTrackerField()"
      style="width:100%;padding:8px;background:none;border:1.5px dashed var(--border);
             border-radius:8px;color:var(--accent2);font-size:13px;font-weight:600;cursor:pointer">
      ＋ 添加指标
    </button>
  `;
}

let _trackerFieldsCache = null;

async function _getFieldsCache() {
  if (!_trackerFieldsCache) _trackerFieldsCache = await getTrackerFields();
  return _trackerFieldsCache;
}

function updateTrackerField(i, key, val) {
  if (_trackerFieldsCache) _trackerFieldsCache[i][key] = val;
}

async function addTrackerField() {
  const fields = await _getFieldsCache();
  const id = "field_" + Date.now();
  fields.push({ id, name: "", unit: "" });
  await saveTrackerFields(fields);
  _trackerFieldsCache = fields;
  renderTrackerSettings();
}

async function removeTrackerField(i) {
  const fields = await _getFieldsCache();
  fields.splice(i, 1);
  await saveTrackerFields(fields);
  _trackerFieldsCache = fields;
  renderTrackerSettings();
}

async function flushTrackerFields() {
  if (_trackerFieldsCache) {
    await saveTrackerFields(_trackerFieldsCache);
    _trackerFieldsCache = null;
  }
}

// ── Analysis page: tracker trend chart ───────────────────────────

let _trackerChartRange = 30;

async function renderTrackerChart() {
  const canvas = document.getElementById("trackerChart");
  if (!canvas) return;
  const fields = await getTrackerFields();
  if (fields.length === 0) {
    document.getElementById("trackerChartWrap").innerHTML =
      '<div style="color:var(--text3);font-size:13px;text-align:center;padding:24px">在设置中添加自定义指标后这里会显示趋势</div>';
    return;
  }

  const colors = [
    "#f06060",
    "#f0c060",
    "#60c8f0",
    "#c8f060",
    "#c060f0",
    "#60f0a0",
  ];
  const legend = document.getElementById("trackerChartLegend");
  if (legend) {
    legend.innerHTML = fields
      .map(
        (f, i) => `
      <div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--text2)">
        <div style="width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]}"></div>
        ${f.name}
      </div>`,
      )
      .join("");
  }

  const history = await getTrackerHistory(_trackerChartRange);
  const labels = [];
  const seriesData = fields.map(() => []);

  for (let i = _trackerChartRange - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    labels.push(d.getMonth() + 1 + "/" + d.getDate());
    const log = history[ds] || {};
    fields.forEach((f, fi) => {
      seriesData[fi].push(log[f.id] != null ? log[f.id] : null);
    });
  }

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width) return;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  const W = rect.width,
    H = rect.height;
  ctx.clearRect(0, 0, W, H);

  const pad = { top: 16, right: 16, bottom: 28, left: 44 };
  const cW = W - pad.left - pad.right,
    cH = H - pad.top - pad.bottom;
  const n = labels.length;
  function xPos(i) {
    return pad.left + (i / Math.max(n - 1, 1)) * cW;
  }

  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + cH * (i / 4);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
  }

  const allVals = seriesData.flat().filter((v) => v !== null);
  if (!allVals.length) {
    ctx.fillStyle = "#555";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("暂无数据", W / 2, H / 2);
    return;
  }
  const minV = Math.min(...allVals) * 0.97;
  const maxV = Math.max(...allVals) * 1.03 || minV + 10;

  ctx.fillStyle = "#555";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i++) {
    const v = minV + (maxV - minV) * (1 - i / 4);
    ctx.fillText(v.toFixed(1), pad.left - 4, pad.top + cH * (i / 4) + 4);
  }

  seriesData.forEach((series, si) => {
    const color = colors[si % colors.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.setLineDash([]);
    ctx.beginPath();
    let first = true;
    series.forEach((v, i) => {
      if (v === null) {
        first = true;
        return;
      }
      const x = xPos(i),
        y = pad.top + cH * (1 - (v - minV) / (maxV - minV || 1));
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();
    series.forEach((v, i) => {
      if (v === null) return;
      const x = xPos(i),
        y = pad.top + cH * (1 - (v - minV) / (maxV - minV || 1));
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.fillStyle = "#555";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  const step = Math.ceil(n / 7);
  for (let i = 0; i < labels.length; i++) {
    if (i % step === 0 || i === n - 1) ctx.fillText(labels[i], xPos(i), H - 6);
  }
}

async function setTrackerChartRange(n, btn) {
  _trackerChartRange = n;
  document
    .querySelectorAll("#trackerRangeSeg .seg-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  await renderTrackerChart();
}
