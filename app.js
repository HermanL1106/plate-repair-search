const CONFIG = {
  spreadsheetId: "1DpSxO_ugC0tYlEdqMthc-xN8yVgiezsd2N3dIFiWQfc",
  sheetName: "改裝業績",
};

const plateHeaders = ["車牌號碼", "牌照號碼", "車牌", "牌照", "車號"];
const dateHeaders = ["日期", "接待日期", "進廠日期", "開單時間 年/月/日", "工單最後完成時間", "出庫日期", "發票日期"];
const preferredHeaders = [
  "車牌號碼",
  "牌照號碼",
  "車號",
  "日期",
  "接待日期",
  "進廠日期",
  "工單號碼",
  "工單狀態",
  "承修技師",
  "服務專員",
  "聯絡人",
  "電話",
  "待辦事項",
  "需求零件/工單號碼",
  "事項備註",
  "名稱",
  "零件代號",
  "售出金額",
  "料件金額",
];

const state = {
  rows: [],
  source: "",
  lastQuery: "",
};

const els = {
  plateInput: document.querySelector("#plateInput"),
  searchButton: document.querySelector("#searchButton"),
  fileInput: document.querySelector("#fileInput"),
  reloadButton: document.querySelector("#reloadButton"),
  sourceStatus: document.querySelector("#sourceStatus"),
  totalRows: document.querySelector("#totalRows"),
  matchCount: document.querySelector("#matchCount"),
  sheetName: document.querySelector("#sheetName"),
  resultHint: document.querySelector("#resultHint"),
  results: document.querySelector("#results"),
};

function normalizePlate(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function cleanText(value) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function findValue(row, headers) {
  const key = headers.find((header) => cleanText(row[header]));
  return key ? cleanText(row[key]) : "";
}

function rowDate(row) {
  const value = findValue(row.fields, dateHeaders);
  const time = Date.parse(value.replaceAll("/", "-"));
  return Number.isNaN(time) ? 0 : time;
}

function setStatus(text, isError = false) {
  els.sourceStatus.textContent = text;
  els.sourceStatus.classList.toggle("error", isError);
}

function updateSummary(matches = []) {
  els.totalRows.textContent = state.rows.length.toLocaleString("zh-TW");
  els.matchCount.textContent = matches.length.toLocaleString("zh-TW");
  els.sheetName.textContent = CONFIG.sheetName;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function rowsToObjects(matrix, sheetName = CONFIG.sheetName) {
  const headerIndex = matrix.findIndex((row) =>
    row.some((cell) => plateHeaders.includes(cleanText(cell)))
  );
  if (headerIndex === -1) return [];

  const rawHeaders = matrix[headerIndex].map((cell) => cleanText(cell));
  const hasPlate = rawHeaders.some((header) => plateHeaders.includes(header));
  const headers = rawHeaders.map((header, index) => {
    if (header) return header;
    if (hasPlate && index === 0) return "日期";
    if (hasPlate && index === 4) return "金額";
    return `欄位 ${index + 1}`;
  });
  return matrix
    .slice(headerIndex + 1)
    .map((cells, index) => {
      const fields = {};
      headers.forEach((header, cellIndex) => {
        const value = cleanText(cells[cellIndex]);
        if (value) fields[header] = value;
      });
      return {
        sheetName,
        rowNumber: headerIndex + index + 2,
        fields,
        plate: findValue({ fields }, plateHeaders),
      };
    })
    .filter((row) => normalizePlate(row.plate));
}

function loadRows(rows, sourceLabel) {
  state.rows = rows
    .map((row) => ({ ...row, plateKey: normalizePlate(row.plate) }))
    .sort((a, b) => rowDate(b) - rowDate(a));
  state.source = sourceLabel;
  updateSummary([]);
  renderResults([]);
  els.resultHint.textContent = `已載入 ${sourceLabel}，請輸入車牌搜尋。`;
}

async function loadGoogleSheet() {
  setStatus("讀取中");
  const data = await loadSheetMatrix();
  const rows = rowsToObjects(data.matrix, CONFIG.sheetName);
  if (!rows.length) throw new Error(`找不到「${CONFIG.sheetName}」分頁中的車牌欄位。`);
  loadRows(rows, data.sourceLabel);
  setStatus("線上資料");
}

async function loadSheetMatrix() {
  try {
    const table = await loadGoogleTable();
    return {
      matrix: gvizTableToMatrix(table),
      sourceLabel: "Google 試算表最新資料",
    };
  } catch (error) {
    console.warn("Google sheet direct loading failed, trying hosted CSV.", error);
  }

  try {
    return {
      matrix: parseCsv(await loadHostedCsv()),
      sourceLabel: "GitHub 備份資料",
    };
  } catch (error) {
    if (!["localhost", "127.0.0.1"].includes(location.hostname)) throw error;
    const csvText = await loadLocalCsv();
    return {
      matrix: parseCsv(csvText),
      sourceLabel: "本機備份資料",
    };
  }
}

async function loadHostedCsv() {
  if (location.protocol === "file:") throw new Error("Hosted CSV is unavailable from file URLs.");
  if (typeof window.fetch === "function") {
    try {
      const response = await window.fetch(`./data.csv?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`data.csv 讀取失敗：${response.status}`);
      const text = await response.text();
      if (!text.includes("車號")) throw new Error("data.csv 缺少車號欄位。");
      return text;
    } catch (error) {
      console.warn("Hosted CSV fetch failed, trying hosted script.", error);
    }
  }
  return loadHostedDataScript();
}

function loadHostedDataScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("data.js 讀取逾時。"));
    }, 8000);

    script.onload = () => {
      try {
        window.clearTimeout(timeout);
        const text = window.__PLATE_SEARCH_DATA_CSV__ || "";
        delete window.__PLATE_SEARCH_DATA_CSV__;
        script.remove();
        if (!text.includes("車號")) reject(new Error("data.js 缺少車號欄位。"));
        else resolve(text);
      } catch (error) {
        script.remove();
        reject(error);
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("data.js 讀取失敗。"));
    };
    script.src = `./data.js?ts=${Date.now()}`;
    document.body.append(script);
  });
}

function loadGoogleTable() {
  return new Promise((resolve, reject) => {
    const callback = `googleSheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      delete window[callback];
      reject(new Error("Google 試算表讀取逾時，請確認公開權限。"));
    }, 5000);

    window[callback] = (response) => {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callback];
      if (response?.status === "error") {
        reject(new Error(response.errors?.[0]?.detailed_message || "Google 試算表讀取失敗。"));
        return;
      }
      resolve(response.table);
    };

    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callback];
      reject(new Error("無法讀取線上資料。"));
    };

    script.src =
      `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq` +
      `?sheet=${encodeURIComponent(CONFIG.sheetName)}` +
      `&tqx=responseHandler:${callback}`;
    document.body.append(script);
  });
}

function loadLocalCsv() {
  return new Promise((resolve, reject) => {
    const callback = `localSheet_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      script.remove();
      delete window[callback];
      reject(new Error("本機資料讀取逾時。"));
    }, 15000);

    window[callback] = (text, error) => {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callback];
      if (error) reject(new Error(error));
      else resolve(text || "");
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      delete window[callback];
      reject(new Error("本機資料讀取失敗。"));
    };
    script.src = `/api/sheet.js?sheet=${encodeURIComponent(CONFIG.sheetName)}&callback=${callback}`;
    document.body.append(script);
  });
}

function gvizTableToMatrix(table) {
  if (!table?.cols?.length) return [];
  const headers = table.cols.map((col, index) => cleanText(col.label || col.id || `欄位 ${index + 1}`));
  const rows = table.rows.map((row) =>
    table.cols.map((_, index) => {
      const cell = row.c?.[index];
      return cleanText(cell?.f ?? cell?.v ?? "");
    })
  );
  return [headers, ...rows];
}

function search() {
  const query = normalizePlate(els.plateInput.value);
  state.lastQuery = query;
  if (!query) {
    updateSummary([]);
    renderResults([]);
    els.resultHint.textContent = "輸入完整或部分車牌即可搜尋。";
    return;
  }

  const matches = state.rows.filter((row) => row.plateKey.includes(query));
  updateSummary(matches);
  renderResults(matches);
  els.resultHint.textContent = matches.length
    ? `找到 ${matches.length} 筆符合「${els.plateInput.value.trim()}」的資料。`
    : `沒有找到符合「${els.plateInput.value.trim()}」的資料。`;
}

function visibleFields(row) {
  const keys = Object.keys(row.fields);
  const ordered = preferredHeaders.filter((key) => cleanText(row.fields[key]));
  const rest = keys.filter((key) => !ordered.includes(key) && cleanText(row.fields[key]));
  return [...ordered, ...rest].slice(0, 16);
}

function renderResults(matches) {
  if (!state.rows.length) {
    els.results.innerHTML = `<div class="empty-state">尚未載入資料。若線上表無法讀取，請匯入當月 CSV 或 XLSX。</div>`;
    return;
  }

  if (!matches.length) {
    els.results.innerHTML = `<div class="empty-state">尚無結果。</div>`;
    return;
  }

  els.results.innerHTML = matches
    .map((row) => {
      const date = findValue(row.fields, dateHeaders) || "未填日期";
      const fields = visibleFields(row)
        .map(
          (key) => `<div class="field"><b>${escapeHtml(key)}</b><span>${escapeHtml(row.fields[key])}</span></div>`
        )
        .join("");

      return `
        <article class="result-card">
          <div class="result-top">
            <div>
              <div class="plate">${escapeHtml(row.plate)}</div>
              <div class="meta">${escapeHtml(row.sheetName)} 第 ${row.rowNumber} 列</div>
            </div>
            <div class="date">${escapeHtml(date)}</div>
          </div>
          <div class="field-grid">${fields}</div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return cleanText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function handleFile(file) {
  setStatus("匯入中");
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    const rows = rowsToObjects(parseCsv(text), file.name);
    loadRows(rows, file.name);
  } else {
    if (!window.XLSX) throw new Error("XLSX 讀取套件尚未載入，請確認網路連線後重試。");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const targetSheet = workbook.SheetNames.includes(CONFIG.sheetName) ? CONFIG.sheetName : workbook.SheetNames[0];
    const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[targetSheet], { header: 1, defval: "" });
    const rows = rowsToObjects(matrix, targetSheet);
    loadRows(rows, file.name);
  }

  if (!state.rows.length) throw new Error("匯入檔案中找不到車牌欄位。");
  setStatus("匯入資料");
  search();
}

els.searchButton.addEventListener("click", search);
els.plateInput.addEventListener("input", search);
els.reloadButton.addEventListener("click", () => {
  loadGoogleSheet().catch((error) => {
    setStatus("需匯入", true);
    els.resultHint.textContent = error.message;
    renderResults([]);
  });
});
els.fileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await handleFile(file);
  } catch (error) {
    setStatus("匯入失敗", true);
    els.resultHint.textContent = error.message;
    renderResults([]);
  }
});

loadGoogleSheet().catch((error) => {
  setStatus("需匯入", true);
  els.resultHint.textContent = error.message;
  renderResults([]);
});
