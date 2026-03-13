const COINBASE_EPOCH_DATE = "2024-01-01";

const state = {
  from: defaultFrom(),
  to: defaultTo(),
  view: "dashboard",
};

function defaultFrom() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

function defaultTo() {
  return new Date().toISOString().slice(0, 10);
}

function setFlash(message) {
  const flash = document.querySelector("#flash");
  flash.textContent = message;
  flash.classList.toggle("hidden", !message);
}

function formatNumber(value, options = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "");
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    minimumFractionDigits: options.minimumFractionDigits ?? 0,
  }).format(numeric);
}

function formatMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return String(value ?? "");
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numeric);
}

function formatDate(value) {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleString();
}

function tableHtml(rows) {
  if (!rows || rows.length === 0) {
    return '<p class="subtle">No rows.</p>';
  }

  const headers = Object.keys(rows[0]);
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              ${headers.map((header) => `<td>${row[header] ?? ""}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function metricGridHtml(metrics) {
  return `
    <div class="metric-grid">
      ${metrics.map((metric) => `
        <article class="metric">
          <p class="label">${metric.label}</p>
          <p class="number">${metric.value}</p>
        </article>
      `).join("")}
    </div>
  `;
}

function barChartHtml(rows) {
  if (!rows.length) {
    return '<p class="subtle">No chart data.</p>';
  }

  const max = Math.max(...rows.map((row) => row.count), 1);
  return `
    <div class="bar-list">
      ${rows.map((row) => `
        <div class="bar-row">
          <strong>${row.asset}</strong>
          <div class="bar"><span style="width:${(row.count / max) * 100}%"></span></div>
          <span>${formatNumber(row.count, { maximumFractionDigits: 0 })}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function lineChartHtml(rows, xKey, yKey, money = false) {
  if (!rows.length) {
    return '<p class="subtle">No chart data.</p>';
  }

  const width = 640;
  const height = 220;
  const padding = 20;
  const values = rows.map((row) => Number(row[yKey]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const scaleX = (_, index) => padding + (index * ((width - (padding * 2)) / Math.max(rows.length - 1, 1)));
  const scaleY = (value) => {
    if (max === min) {
      return height / 2;
    }
    return height - padding - (((value - min) / (max - min)) * (height - (padding * 2)));
  };
  const path = rows
    .map((row, index) => `${index === 0 ? "M" : "L"} ${scaleX(row, index)} ${scaleY(Number(row[yKey]))}`)
    .join(" ");
  const last = rows[rows.length - 1];

  return `
    <div class="line-chart">
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line class="axis" x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}"></line>
        <line class="axis" x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}"></line>
        <path d="${path}"></path>
      </svg>
      <p class="subtle">Latest ${xKey}: ${last[xKey]} | ${money ? formatMoney(last[yKey]) : formatNumber(last[yKey])}</p>
    </div>
  `;
}

async function api(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }
    url.searchParams.set(key, value);
  }

  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }

  return body;
}

async function loadHealth() {
  const data = await api("/api/health");
  document.querySelector("#health-status").textContent = `DB ${formatDate(data.databaseTime)}`;
}

async function loadDashboard() {
  const data = await api("/api/dashboard/summary", { from: state.from, to: state.to });

  document.querySelector("#dashboard-cards").innerHTML = [
    { label: "Non-zero balances", value: formatNumber(data.balances.nonZeroAssets, { maximumFractionDigits: 0 }) },
    { label: "Transactions", value: formatNumber(data.transactions.total, { maximumFractionDigits: 0 }) },
    { label: "Lots", value: formatNumber(data.lots.totalLots, { maximumFractionDigits: 0 }) },
    { label: "Realized gains", value: formatMoney(data.gains.totals.gain) },
  ].map((card) => `
    <article class="card">
      <p class="eyebrow">${card.label}</p>
      <p class="value">${card.value}</p>
    </article>
  `).join("");

  document.querySelector("#dashboard-asset-bars").innerHTML = barChartHtml(data.transactions.byAsset);
  document.querySelector("#dashboard-group-chart").innerHTML = lineChartHtml(data.transactions.grouped, "month", "total", true);
  document.querySelector("#dashboard-recent-transactions").innerHTML = tableHtml(
    data.transactions.recent.map((row) => ({
      timestamp: formatDate(row.timestamp),
      asset: row.asset,
      type: row.type,
      quantity: formatNumber(row.num_quantity),
      total: formatMoney(row.num_total),
      fee: formatMoney(row.num_fee),
    })),
  );
  document.querySelector("#dashboard-gains-groups").innerHTML = tableHtml(
    data.gains.grouped.map((row) => ({
      group: row.group,
      trades: row.trades,
      gains: formatMoney(row.gains),
      basis: formatMoney(row.basis),
      proceeds: formatMoney(row.proceeds),
    })),
  );
}

async function loadTransactions(formData = new FormData(document.querySelector("#transactions-form"))) {
  const params = {
    from: state.from,
    to: state.to,
    asset: formData.get("asset"),
    classifier: formData.get("classifier"),
    paired: formData.get("paired") ? "true" : undefined,
  };

  const [rows, grouped] = await Promise.all([
    api("/api/coinbase/transactions", params),
    api("/api/coinbase/transactions/group", { ...params, interval: "month" }),
  ]);

  document.querySelector("#transactions-chart").innerHTML = lineChartHtml(grouped, "month", "total", true);
  document.querySelector("#transactions-table").innerHTML = tableHtml(rows.map((row) => ({
    timestamp: formatDate(row.timestamp),
    asset: row.asset,
    type: row.type,
    quantity: formatNumber(row.num_quantity),
    price: formatMoney(row.num_price_at_tx),
    total: formatMoney(row.num_total),
    fee: formatMoney(row.num_fee),
    notes: row.notes,
  })));
}

async function loadBalances(formData = new FormData(document.querySelector("#balances-form"))) {
  const asset = formData.get("asset");
  const balances = await api("/api/coinbase/balances", { to: state.to, currentSnapshot: "true" });
  document.querySelector("#balances-table").innerHTML = tableHtml(balances.map((row) => ({
    asset: row.asset,
    balance: formatNumber(row.balance, { maximumFractionDigits: 8 }),
    timestamp: formatDate(row.timestamp),
    tx_id: row.tx_id,
  })));

  if (!asset) {
    document.querySelector("#balance-trace-chart").innerHTML = '<p class="subtle">Choose an asset to load a trace.</p>';
    document.querySelector("#balance-trace-table").innerHTML = "";
    return;
  }

  const trace = await api("/api/coinbase/balances/trace", { asset, to: state.to });
  document.querySelector("#balance-trace-chart").innerHTML = lineChartHtml(
    trace.map((row) => ({ timestamp: new Date(row.timestamp).toISOString().slice(0, 10), balance: row.balance })),
    "timestamp",
    "balance",
    false,
  );
  document.querySelector("#balance-trace-table").innerHTML = tableHtml(trace.map((row) => ({
    timestamp: formatDate(row.timestamp),
    balance: formatNumber(row.balance, { maximumFractionDigits: 8 }),
    tx_id: row.tx_id,
    notes: row.notes,
  })));
}

async function loadLots(formData = new FormData(document.querySelector("#lots-form"))) {
  const asset = formData.get("asset");
  if (!asset) {
    document.querySelector("#lots-summary").innerHTML = '<p class="subtle">Enter an asset to analyze lots.</p>';
    document.querySelector("#lots-compare").innerHTML = "";
    document.querySelector("#lots-table").innerHTML = "";
    return;
  }

  const accounting = formData.get("accounting") || "FIFO";
  const [lots, compare] = await Promise.all([
    api("/api/coinbase/lots", { asset, accounting, from: state.from, to: state.to }),
    api("/api/coinbase/lots/compare", { asset, from: state.from, to: state.to }),
  ]);

  document.querySelector("#lots-summary").innerHTML = metricGridHtml([
    { label: "Remaining balance", value: formatNumber(lots.balance, { maximumFractionDigits: 8 }) },
    { label: "Cost basis", value: formatMoney(lots.totals.totalCostBasis) },
    { label: "Proceeds", value: formatMoney(lots.totals.totalProceeds) },
    { label: "Net gain", value: formatMoney(lots.totals.totalGain) },
  ]);
  document.querySelector("#lots-compare").innerHTML = tableHtml(
    Object.entries(compare).map(([method, totals]) => ({
      accounting: method,
      proceeds: formatMoney(totals.totalProceeds),
      basis: formatMoney(totals.totalCostBasis),
      gain: formatMoney(totals.totalGain),
      short_term: formatMoney(totals.shortTerm),
      long_term: formatMoney(totals.longTerm),
    })),
  );
  document.querySelector("#lots-table").innerHTML = tableHtml(lots.lots.map((row) => ({
    sold: formatDate(row.sold),
    acquired: formatDate(row.acquired),
    size: formatNumber(row.size, { maximumFractionDigits: 8 }),
    basis: formatMoney(row.basis),
    proceeds: formatMoney(row.proceeds),
    gain: formatMoney(row.gain),
    term: row.term,
  })));
}

async function loadGains(formData = new FormData(document.querySelector("#gains-form"))) {
  const params = {
    from: state.from,
    to: state.to,
    assets: formData.get("assets"),
    crypto: formData.get("crypto") ? "true" : undefined,
    zero: formData.get("zero") ? "true" : undefined,
  };

  const [rows, grouped] = await Promise.all([
    api("/api/cointracker/gains", params),
    api("/api/cointracker/gains/group", params),
  ]);

  document.querySelector("#gains-summary").innerHTML = metricGridHtml([
    { label: "Groups", value: formatNumber(grouped.rows.length, { maximumFractionDigits: 0 }) },
    { label: "Trades", value: formatNumber(grouped.totals.trades, { maximumFractionDigits: 0 }) },
    { label: "Basis", value: formatMoney(grouped.totals.cost_basis) },
    { label: "Realized gain", value: formatMoney(grouped.totals.gain) },
  ]);
  document.querySelector("#gains-group-table").innerHTML = tableHtml(grouped.rows.map((row) => ({
    group: row.group,
    trades: row.trades,
    gains: formatMoney(row.gains),
    avg_gain: formatMoney(row.avg_gain),
    roi_basis: formatNumber(Number(row.roi_basis) * 100) + "%",
  })));
  document.querySelector("#gains-table").innerHTML = tableHtml(rows.map((row) => ({
    asset: row.asset_name,
    received: formatDate(row.received_date),
    sold: formatDate(row.date_sold),
    amount: formatNumber(row.asset_amount, { maximumFractionDigits: 8 }),
    basis: formatMoney(row.cost_basis_usd),
    proceeds: formatMoney(row.proceeds_usd),
    gain: formatMoney(row.gain_usd),
    type: row.type,
  })));
}

function activateView(view) {
  state.view = view;
  document.querySelector("#view-title").textContent = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    balances: "Balances",
    lots: "Lots",
    gains: "Capital Gains",
  }[view];

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });
  document.querySelectorAll(".view").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.viewPanel === view);
  });
}

async function refreshActiveView() {
  setFlash("");

  try {
    await loadHealth();
    if (state.view === "dashboard") {
      await loadDashboard();
    } else if (state.view === "transactions") {
      await loadTransactions();
    } else if (state.view === "balances") {
      await loadBalances();
    } else if (state.view === "lots") {
      await loadLots();
    } else if (state.view === "gains") {
      await loadGains();
    }
  } catch (error) {
    setFlash(error instanceof Error ? error.message : String(error));
  }
}

function wireForms() {
  const globalFromInput = document.querySelector("#global-from");
  const globalToInput = document.querySelector("#global-to");
  const applyRangeButton = document.querySelector("#apply-range");
  const coinbaseEpochButton = document.querySelector("#set-coinbase-epoch");

  globalFromInput.value = state.from;
  globalToInput.value = state.to;

  applyRangeButton.addEventListener("click", async () => {
    state.from = globalFromInput.value;
    state.to = globalToInput.value;
    await refreshActiveView();
  });

  coinbaseEpochButton.addEventListener("click", async () => {
    globalFromInput.value = COINBASE_EPOCH_DATE;
    state.from = COINBASE_EPOCH_DATE;
    state.to = globalToInput.value;
    await refreshActiveView();
  });

  document.querySelectorAll(".nav-link").forEach((button) => {
    button.addEventListener("click", async () => {
      activateView(button.dataset.view);
      await refreshActiveView();
    });
  });

  document.querySelector("#transactions-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadTransactions(new FormData(event.currentTarget));
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
    }
  });

  document.querySelector("#balances-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadBalances(new FormData(event.currentTarget));
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
    }
  });

  document.querySelector("#lots-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadLots(new FormData(event.currentTarget));
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
    }
  });

  document.querySelector("#gains-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await loadGains(new FormData(event.currentTarget));
    } catch (error) {
      setFlash(error instanceof Error ? error.message : String(error));
    }
  });
}

wireForms();
refreshActiveView();
