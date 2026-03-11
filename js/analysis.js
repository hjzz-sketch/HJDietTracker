// ═══════════════════════════════════════════════════════════════════
// analysis.js — 分析模块
// 依赖：sb, DEVICE_ID, _dayDataCache, getDayData, getWeight,
//       getProfile, openModal, statsRange, chartRange（index.html 全局）
// ═══════════════════════════════════════════════════════════════════

async function renderStats() {
  const card = document.getElementById("statsCard");
  const profile = await getProfile();
  let days = 0,
    totK = 0,
    totP = 0,
    totF = 0,
    totC = 0;
  for (let i = 0; i < statsRange; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayData = _dayDataCache[ds] || (await getDayData(ds));
    _dayDataCache[ds] = dayData;
    if (!Object.values(dayData).some((arr) => arr.length > 0)) continue;
    days++;
    Object.values(dayData).forEach((arr) =>
      arr.forEach((item) => {
        const f = item.weight / 100;
        totP += item.protein * f;
        totF += item.fat * f;
        totC += item.carb * f;
        totK += item.kcal * f;
      }),
    );
  }
  if (!days) {
    card.innerHTML =
      '<div style="color:var(--text3);font-size:13px">暂无数据，先去记录吧！</div>';
    return;
  }
  const avgK = totK / days,
    avgP = totP / days,
    avgF = totF / days,
    avgC = totC / days;
  card.innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:10px">近 ${statsRange} 天 · 有记录 ${days} 天</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div class="preview-chip"><div class="pv" style="color:var(--cal)">${Math.round(avgK)}</div><div class="pl">千卡 (目标${profile.calTarget})</div></div>
      <div class="preview-chip"><div class="pv" style="color:var(--protein)">${avgP.toFixed(1)}g</div><div class="pl">蛋白质 (目标${profile.protTarget}g)</div></div>
      <div class="preview-chip"><div class="pv" style="color:var(--fat)">${avgF.toFixed(1)}g</div><div class="pl">脂肪 (目标${profile.fatTarget}g)</div></div>
      <div class="preview-chip"><div class="pv" style="color:var(--carb)">${avgC.toFixed(1)}g</div><div class="pl">碳水 (目标${profile.carbTarget}g)</div></div>
    </div>`;
}

function setStatsRange(n, btn) {
  statsRange = n;
  document
    .querySelectorAll("#statsRangeSeg .seg-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderStats();
}

async function setChartRange(n, btn) {
  chartRange = n;
  document
    .querySelectorAll("#chartRangeSeg .seg-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  await drawChart();
}

async function drawChart() {
  const canvas = document.getElementById("trendChart");
  if (!canvas) return;
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

  // ── Collect data (original logic unchanged) ───────────────────────
  const labels = [],
    kcals = [],
    weights = [];
  const today = new Date();
  for (let i = chartRange - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    labels.push(d.getMonth() + 1 + "/" + d.getDate());
    let k = 0;
    const dayData = _dayDataCache[ds] || (await getDayData(ds));
    _dayDataCache[ds] = dayData;
    if (Object.values(dayData).some((arr) => arr.length > 0)) {
      Object.values(dayData).forEach((arr) =>
        arr.forEach((item) => {
          k += (item.kcal * item.weight) / 100;
        }),
      );
    }
    kcals.push(Math.round(k) || null);
    const wt = await getWeight(ds);
    weights.push(wt || null);
  }

  // ── Layout ────────────────────────────────────────────────────────
  const pad = { top: 20, right: 40, bottom: 28, left: 44 };
  const cW = W - pad.left - pad.right,
    cH = H - pad.top - pad.bottom;
  const n = labels.length;
  function xPos(i) {
    return pad.left + (i / Math.max(n - 1, 1)) * cW;
  }

  // ── Y-axis scales ─────────────────────────────────────────────────
  const validK = kcals.filter((v) => v !== null);
  const validW = weights.filter((v) => v !== null);

  // Calorie axis: nice 100-step ticks
  let calMin = 800,
    calMax = 2200;
  if (validK.length) {
    calMin = Math.max(0, Math.floor(Math.min(...validK) / 100) * 100 - 100);
    calMax = Math.ceil(Math.max(...validK) / 100) * 100 + 100;
  }
  const calSpan = calMax - calMin || 1;
  const calStep = calMax - calMin > 600 ? 200 : 100;
  function calToY(v) {
    return pad.top + cH * (1 - (v - calMin) / calSpan);
  }

  // Weight axis: tight range, 0.5kg steps
  let wtMin = 45,
    wtMax = 75;
  if (validW.length) {
    wtMin = Math.floor(Math.min(...validW) * 2) / 2 - 0.5;
    wtMax = Math.ceil(Math.max(...validW) * 2) / 2 + 0.5;
  }
  const wtSpan = wtMax - wtMin || 1;
  function wtToY(v) {
    return pad.top + cH * (1 - (v - wtMin) / wtSpan);
  }

  // ── Grid lines (driven by cal ticks) ─────────────────────────────
  ctx.strokeStyle = "#2a2a2a";
  ctx.lineWidth = 1;
  for (
    let v = Math.ceil(calMin / calStep) * calStep;
    v <= calMax;
    v += calStep
  ) {
    const y = calToY(v);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + cW, y);
    ctx.stroke();
  }

  // ── Left Y axis labels (calories) ────────────────────────────────
  ctx.fillStyle = "#666";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "right";
  for (
    let v = Math.ceil(calMin / calStep) * calStep;
    v <= calMax;
    v += calStep
  ) {
    ctx.fillText(v, pad.left - 4, calToY(v) + 4);
  }

  // ── Right Y axis labels (weight) ──────────────────────────────────
  if (validW.length) {
    ctx.fillStyle = "#3a6a7a";
    ctx.textAlign = "left";
    const wtStep = wtMax - wtMin <= 3 ? 0.5 : 1;
    for (
      let v = Math.ceil(wtMin / wtStep) * wtStep;
      v <= wtMax;
      v = Math.round((v + wtStep) * 10) / 10
    ) {
      const y = wtToY(v);
      if (y < pad.top - 2 || y > H - pad.bottom + 2) continue;
      ctx.fillText(v % 1 === 0 ? v : v.toFixed(1), pad.left + cW + 4, y + 4);
    }
  }

  // ── Calorie line ──────────────────────────────────────────────────
  if (validK.length) {
    // Target dashed line
    const profile = await getProfile();
    if (profile.calTarget) {
      const ty = calToY(profile.calTarget);
      ctx.strokeStyle = "rgba(200,240,96,0.2)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(pad.left, ty);
      ctx.lineTo(pad.left + cW, ty);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Line
    ctx.strokeStyle = "#c8f060";
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    let firstK = true;
    for (let i = 0; i < kcals.length; i++) {
      if (kcals[i] === null) continue;
      const x = xPos(i),
        y = calToY(kcals[i]);
      if (firstK) {
        ctx.moveTo(x, y);
        firstK = false;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // Dots
    for (let i = 0; i < kcals.length; i++) {
      if (kcals[i] === null) continue;
      ctx.fillStyle = "#c8f060";
      ctx.beginPath();
      ctx.arc(xPos(i), calToY(kcals[i]), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── Weight line ───────────────────────────────────────────────────
  if (validW.length) {
    ctx.strokeStyle = "#60c8f0";
    ctx.lineWidth = 2;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    let firstW = true;
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] === null) continue;
      const x = xPos(i),
        y = wtToY(weights[i]);
      if (firstW) {
        ctx.moveTo(x, y);
        firstW = false;
      } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (let i = 0; i < weights.length; i++) {
      if (weights[i] === null) continue;
      ctx.fillStyle = "#60c8f0";
      ctx.beginPath();
      ctx.arc(xPos(i), wtToY(weights[i]), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── X labels ─────────────────────────────────────────────────────
  ctx.fillStyle = "#555";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  const step = Math.ceil(n / 7);
  for (let i = 0; i < labels.length; i++) {
    if (i % step === 0 || i === n - 1) ctx.fillText(labels[i], xPos(i), H - 6);
  }

  // ── Weight tooltip on hover / tap ─────────────────────────────────
  const wrap = canvas.parentElement;
  wrap.style.position = "relative";

  // Inject tooltip CSS once
  if (!document.getElementById("_wtTooltipStyle")) {
    const s = document.createElement("style");
    s.id = "_wtTooltipStyle";
    s.textContent = `
      .wt-tooltip{position:absolute;background:#1e1e1e;border:1px solid #333;
        border-radius:9px;padding:7px 12px;pointer-events:none;opacity:0;
        transition:opacity .15s;z-index:20;white-space:nowrap;
        box-shadow:0 4px 16px rgba(0,0,0,.5)}
      .wt-tooltip.show{opacity:1}
      .wt-tooltip .tt-d{font-size:11px;color:#666;margin-bottom:3px}
      .wt-tooltip .tt-v{font-size:18px;font-weight:700;color:#60c8f0}
      .wt-tooltip .tt-u{font-size:11px;color:#888;margin-left:2px}
    `;
    document.head.appendChild(s);
  }

  let tip = wrap.querySelector(".wt-tooltip");
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "wt-tooltip";
    tip.innerHTML =
      '<div class="tt-d"></div><div><span class="tt-v"></span><span class="tt-u">kg</span></div>';
    wrap.appendChild(tip);
  }

  function showTip(clientX) {
    const r = canvas.getBoundingClientRect();
    const mx = clientX - r.left;
    let best = -1,
      bestDist = Infinity;
    weights.forEach((v, i) => {
      if (v === null) return;
      const d = Math.abs(mx - xPos(i));
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    if (best === -1 || bestDist > (cW / n) * 1.2) {
      tip.classList.remove("show");
      return;
    }
    tip.querySelector(".tt-d").textContent = labels[best];
    tip.querySelector(".tt-v").textContent = weights[best].toFixed(1);
    const ty = wtToY(weights[best]);
    let left = xPos(best) - 46,
      top = ty - 60;
    if (left < 0) left = 2;
    if (left + 92 > W) left = W - 94;
    if (top < 4) top = ty + 10;
    tip.style.left = left + "px";
    tip.style.top = top + "px";
    tip.classList.add("show");
  }

  // Bind once per chart render using a flag on the canvas element
  if (!canvas._tipBound) {
    canvas._tipBound = true;
    canvas.addEventListener("mousemove", (e) => showTip(e.clientX));
    canvas.addEventListener("mouseleave", () => tip.classList.remove("show"));
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        showTip(e.touches[0].clientX);
      },
      { passive: false },
    );
    canvas.addEventListener("touchend", () =>
      setTimeout(() => tip.classList.remove("show"), 1800),
    );
  }
}

async function runAnalysis() {
  const apiKey = document.getElementById("apiKeyInput").value.trim();
  if (!apiKey) {
    alert("请先输入 DeepSeek API Key");
    return;
  }
  await sb
    .from("settings")
    .upsert(
      { device_id: DEVICE_ID, key: "apikey", value: apiKey },
      { onConflict: "device_id,key" },
    );

  openModal("aiModal");
  document.getElementById("analysisResult").innerHTML =
    '<div style="color:var(--text3);text-align:center;padding:40px 0"><span class="spinner"></span><br><br><span style="font-size:13px">分析中…</span></div>';

  const profile = await getProfile();
  let summary = `用户信息：身高${profile.height}cm，体重${profile.weight}kg，目标热量${profile.calTarget}kcal/天，蛋白质${profile.protTarget}g，脂肪${profile.fatTarget}g，碳水${profile.carbTarget}g。\n\n最近7天饮食记录：\n`;
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayData = _dayDataCache[ds] || (await getDayData(ds));
    _dayDataCache[ds] = dayData;
    if (!Object.values(dayData).some((arr) => arr.length > 0)) {
      summary += `${ds}: 无记录\n`;
      continue;
    }
    let totP = 0,
      totF = 0,
      totC = 0,
      totK = 0;
    let foods = [];
    Object.entries(dayData).forEach(([, arr]) =>
      arr.forEach((item) => {
        const f = item.weight / 100;
        totP += item.protein * f;
        totF += item.fat * f;
        totC += item.carb * f;
        totK += item.kcal * f;
        foods.push(`${item.name}${item.weight}g`);
      }),
    );
    summary += `${ds}: 热量${Math.round(totK)}kcal，蛋白质${totP.toFixed(1)}g，脂肪${totF.toFixed(1)}g，碳水${totC.toFixed(1)}g。食物：${foods.join("、") || "无"}。\n`;
  }

  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content:
              "你是一位专业营养师，根据用户的饮食记录给出简洁、实用的分析和建议。用中文回答，语气亲切专业。分析热量、三大营养素的达标情况，指出饮食模式的优缺点，给出3条具体可行的改进建议。控制在300字以内。",
          },
          { role: "user", content: summary },
        ],
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);
    document.getElementById("analysisResult").innerHTML =
      data.choices[0].message.content
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br>");
  } catch (e) {
    document.getElementById("analysisResult").textContent =
      "分析失败：" + e.message;
  }
}

// ═══════════════════════════════════════════════════════════════════
// AI 食物估算（addModal 内）
// ═══════════════════════════════════════════════════════════════════

function toggleAiEstimate() {
  const panel = document.getElementById("aiEstimatePanel");
  const btn = document.getElementById("aiEstimateToggle");
  const isOpen = panel.style.display !== "none";
  panel.style.display = isOpen ? "none" : "";
  btn.style.borderColor = isOpen ? "var(--border)" : "var(--accent2)";
  btn.style.color = isOpen ? "var(--accent2)" : "var(--accent2)";
  if (!isOpen) {
    // Hide food list while AI panel is open
    document.getElementById("foodSearch").value = "";
    filterFoods();
    setTimeout(() => document.getElementById("aiEstimateInput")?.focus(), 100);
  }
}

async function _getApiKey() {
  // Try input first (user just typed it on analysis tab)
  const inputEl = document.getElementById("apiKeyInput");
  if (inputEl?.value.trim()) return inputEl.value.trim();
  // Then try saved in settings
  try {
    const { data } = await sb
      .from("settings")
      .select("value")
      .eq("device_id", DEVICE_ID)
      .eq("key", "apikey")
      .maybeSingle();
    return data?.value || null;
  } catch (e) {
    return null;
  }
}

let _aiEstimateItems = []; // last AI result items

async function runAiEstimate() {
  const desc = document.getElementById("aiEstimateInput")?.value.trim();
  if (!desc) return;

  const apiKey = await _getApiKey();
  if (!apiKey) {
    document.getElementById("aiEstimateResult").style.display = "";
    document.getElementById("aiEstimateResult").innerHTML =
      '<div style="color:#f06060;font-size:12px">请先在「分析」页面输入 DeepSeek API Key</div>';
    return;
  }

  const btn = document.getElementById("aiEstimateBtn");
  btn.disabled = true;
  btn.textContent = "估算中…";
  document.getElementById("aiEstimateResult").style.display = "";
  document.getElementById("aiEstimateResult").innerHTML =
    '<div style="color:var(--text3);font-size:12px;text-align:center;padding:8px">✦ 分析中…</div>';

  const prompt = `用户描述了一餐的食物：「${desc}」

请将其拆分成若干食物条目，每个条目估算其营养信息（每100g的营养素 + 估算克重）。

必须严格按以下JSON格式返回，不要有任何其他文字：
[
  {
    "name": "食物名称",
    "weight": 估算克重（数字）,
    "protein": 每100g蛋白质g（数字）,
    "fat": 每100g脂肪g（数字）,
    "carb": 每100g碳水g（数字）,
    "kcal": 每100g热量kcal（数字）
  }
]`;

  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: "你是营养数据专家，只返回JSON，不返回任何其他内容。",
          },
          { role: "user", content: prompt },
        ],
      }),
    });
    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    let raw = data.choices[0].message.content.trim();
    // Strip markdown code fences if present
    raw = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
    _aiEstimateItems = JSON.parse(raw);
    _renderAiEstimateResult();
  } catch (e) {
    document.getElementById("aiEstimateResult").innerHTML =
      `<div style="color:#f06060;font-size:12px">估算失败：${e.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "重新估算";
  }
}

function _renderAiEstimateResult() {
  const el = document.getElementById("aiEstimateResult");
  if (!_aiEstimateItems.length) {
    el.innerHTML =
      '<div style="color:var(--text3);font-size:12px">未能解析结果，请重试</div>';
    return;
  }

  const rows = _aiEstimateItems
    .map((item, i) => {
      const totK = Math.round((item.kcal * item.weight) / 100);
      const totP = ((item.protein * item.weight) / 100).toFixed(1);
      const totF = ((item.fat * item.weight) / 100).toFixed(1);
      const totC = ((item.carb * item.weight) / 100).toFixed(1);
      return `
      <div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;
                  justify-content:space-between;align-items:flex-start;gap:8px">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:3px">${item.name}</div>
          <div style="font-size:11px;color:var(--text3)">
            <span style="color:var(--protein)">蛋白${totP}g</span> ·
            <span style="color:var(--fat)">脂肪${totF}g</span> ·
            <span style="color:var(--carb)">碳水${totC}g</span> ·
            <span style="color:var(--accent)">${totK}kcal</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
          <input type="number" value="${item.weight}" min="1"
            onchange="_aiEstimateItems[${i}].weight=+this.value;_renderAiEstimateResult()"
            style="width:56px;padding:4px 6px;background:var(--surface);border:1px solid var(--border);
                   border-radius:6px;color:var(--text);font-size:13px;text-align:center;outline:none"/>
          <span style="font-size:11px;color:var(--text3)">g</span>
        </div>
      </div>`;
    })
    .join("");

  // Totals
  const totK = Math.round(
    _aiEstimateItems.reduce((s, i) => s + (i.kcal * i.weight) / 100, 0),
  );
  const totP = _aiEstimateItems
    .reduce((s, i) => s + (i.protein * i.weight) / 100, 0)
    .toFixed(1);
  const totF = _aiEstimateItems
    .reduce((s, i) => s + (i.fat * i.weight) / 100, 0)
    .toFixed(1);
  const totC = _aiEstimateItems
    .reduce((s, i) => s + (i.carb * i.weight) / 100, 0)
    .toFixed(1);

  el.innerHTML = `
    <div style="font-size:11px;color:var(--accent2);font-weight:600;margin-bottom:6px">✦ AI 估算结果（可调整克重）</div>
    ${rows}
    <div style="padding:8px 0 4px;display:flex;gap:12px;font-size:12px;flex-wrap:wrap">
      <span style="color:var(--text3)">合计：</span>
      <span style="color:var(--protein)">蛋白 ${totP}g</span>
      <span style="color:var(--fat)">脂肪 ${totF}g</span>
      <span style="color:var(--carb)">碳水 ${totC}g</span>
      <span style="color:var(--accent)">${totK} kcal</span>
    </div>
    <button onclick="confirmAiEstimate()"
      style="width:100%;margin-top:8px;padding:11px;background:var(--accent);
             border:none;border-radius:8px;color:#000;font-size:14px;
             font-weight:700;cursor:pointer">
      ✓ 全部加入餐食
    </button>
  `;
}

async function confirmAiEstimate() {
  if (!_aiEstimateItems.length) return;
  // Add each item to the current meal
  for (const item of _aiEstimateItems) {
    const entry = {
      name: item.name,
      weight: item.weight,
      protein: item.protein,
      fat: item.fat,
      carb: item.carb,
      kcal: item.kcal,
    };
    // Use the same addItem mechanism from diet.js
    if (typeof _addItemToMeal === "function") {
      await _addItemToMeal(entry);
    }
  }
  // Close modal and refresh
  closeModal("addModal");
  // Reset panel
  _aiEstimateItems = [];
  document.getElementById("aiEstimatePanel").style.display = "none";
  document.getElementById("aiEstimateResult").style.display = "none";
  document.getElementById("aiEstimateInput").value = "";
  document.getElementById("aiEstimateToggle").style.borderColor =
    "var(--border)";
  await renderTodayTab();
}
