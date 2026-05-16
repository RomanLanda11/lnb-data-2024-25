const CSV_URL = "public_data/df_players.csv";
const MANIFEST_URL = "public_data/manifest.json";

const CORE_COLUMNS = [
  "Nombre",
  "NombreCompleto",
  "equipo",
  "rival",
  "CantidadPartidosJugados",
  "MinutosJugadosPorPartido",
  "Puntos_suma",
  "RebotesTotales_suma",
  "Asistencias_suma",
  "Valoracion_suma",
  "Puntos_prom_40min",
  "RebotesTotales_prom_40min",
  "Asistencias_prom_40min",
  "USG%",
  "TS%",
  "ORTG",
  "DRTG",
  "game_score_prom"
];

const ADVANCED_COLUMNS = [
  "TOV%",
  "eFG%",
  "ORB%",
  "DRB%",
  "RB%",
  "FTr",
  "3PT%",
  "2PT%",
  "TL%",
  "TS%",
  "USG%",
  "AST/TOVr",
  "game_score_suma",
  "ORTG",
  "DRTG",
  "game_score_prom"
];

const state = {
  headers: [],
  rawRows: [],
  filteredRows: [],
  visibleColumns: [],
  sortKey: null,
  sortDir: "asc",
  page: 1,
  pageSize: 50,
  games: [],
  filteredGames: []
};

const el = {
  year: document.getElementById("year"),
  metricPlayers: document.getElementById("metricPlayers"),
  metricTeams: document.getElementById("metricTeams"),
  metricColumns: document.getElementById("metricColumns"),
  metricGames: document.getElementById("metricGames"),
  playerSearch: document.getElementById("playerSearch"),
  teamFilter: document.getElementById("teamFilter"),
  rivalFilter: document.getElementById("rivalFilter"),
  metricGroupFilter: document.getElementById("metricGroupFilter"),
  resetPlayerFilters: document.getElementById("resetPlayerFilters"),
  toggleColumns: document.getElementById("toggleColumns"),
  columnPanel: document.getElementById("columnPanel"),
  restoreColumns: document.getElementById("restoreColumns"),
  columnOptions: document.getElementById("columnOptions"),
  playerStatus: document.getElementById("playerStatus"),
  playersHead: document.getElementById("playersHead"),
  playersBody: document.getElementById("playersBody"),
  prevPlayers: document.getElementById("prevPlayers"),
  nextPlayers: document.getElementById("nextPlayers"),
  playerPageStatus: document.getElementById("playerPageStatus"),
  playerPageSize: document.getElementById("playerPageSize"),
  gameSearch: document.getElementById("gameSearch"),
  gameTeamFilter: document.getElementById("gameTeamFilter"),
  gameMonthFilter: document.getElementById("gameMonthFilter"),
  resetGameFilters: document.getElementById("resetGameFilters"),
  gameStatus: document.getElementById("gameStatus"),
  gameGrid: document.getElementById("gameGrid")
};

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatNumber(value, digits = 1) {
  const num = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(num)) return value ?? "";
  return num.toLocaleString("es-AR", { maximumFractionDigits: digits });
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((part) => part.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  if (row.some((part) => part.trim() !== "")) rows.push(row);

  const headers = rows.shift() ?? [];
  return {
    headers,
    rows: rows.map((parts) => Object.fromEntries(headers.map((header, index) => [header, parts[index] ?? ""])))
  };
}

function uniqueSorted(rows, key) {
  return [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
}

function setSelectOptions(select, values, label) {
  select.innerHTML = "";
  select.append(new Option(label, ""));
  values.forEach((value) => select.append(new Option(value, value)));
}

function groupColumns(group) {
  if (group === "core") return CORE_COLUMNS.filter((column) => state.headers.includes(column));
  if (group === "sum") return state.headers.filter((column) => column.endsWith("_suma"));
  if (group === "per40") return state.headers.filter((column) => column.endsWith("_prom_40min"));
  if (group === "advanced") return ADVANCED_COLUMNS.filter((column) => state.headers.includes(column));
  return [...state.headers];
}

function resetVisibleColumns() {
  state.visibleColumns = groupColumns(el.metricGroupFilter.value);
  if (state.visibleColumns.length === 0) state.visibleColumns = [...state.headers];
  renderColumnOptions();
}

function renderColumnOptions() {
  el.columnOptions.innerHTML = "";
  state.headers.forEach((header) => {
    const label = document.createElement("label");
    label.className = "check-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.visibleColumns.includes(header);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        state.visibleColumns = [...state.visibleColumns, header];
      } else {
        state.visibleColumns = state.visibleColumns.filter((column) => column !== header);
      }
      if (state.visibleColumns.length === 0) checkbox.checked = true;
      if (state.visibleColumns.length === 0) state.visibleColumns = [header];
      renderPlayers();
    });

    label.append(checkbox, document.createTextNode(header));
    el.columnOptions.append(label);
  });
}

function sortableValue(value) {
  const raw = String(value ?? "").trim();
  const number = Number(raw.replace(",", "."));
  if (raw !== "" && Number.isFinite(number) && /^-?\d+([.,]\d+)?$/.test(raw)) {
    return { type: "number", value: number };
  }
  return { type: "text", value: normalizeText(raw) };
}

function applyPlayerFilters() {
  const query = normalizeText(el.playerSearch.value.trim());
  const team = el.teamFilter.value;
  const rival = el.rivalFilter.value;

  state.filteredRows = state.rawRows.filter((row) => {
    if (team && row.equipo !== team) return false;
    if (rival && row.rival !== rival) return false;
    if (!query) return true;
    return state.headers.some((header) => normalizeText(row[header]).includes(query));
  });

  applyPlayerSort();
  state.page = 1;
  renderPlayers();
}

function applyPlayerSort() {
  if (!state.sortKey) return;

  state.filteredRows.sort((a, b) => {
    const av = sortableValue(a[state.sortKey]);
    const bv = sortableValue(b[state.sortKey]);
    const direction = state.sortDir === "asc" ? 1 : -1;

    if (av.type === "number" && bv.type === "number") return (av.value - bv.value) * direction;
    return av.value.localeCompare(bv.value, "es") * direction;
  });
}

function renderPlayersHeader() {
  const tr = document.createElement("tr");
  state.visibleColumns.forEach((header) => {
    const th = document.createElement("th");
    const indicator = state.sortKey === header ? (state.sortDir === "asc" ? "▲" : "▼") : "↕";
    th.textContent = header;
    const sort = document.createElement("span");
    sort.className = "sort";
    sort.textContent = indicator;
    th.append(sort);
    th.addEventListener("click", () => {
      if (state.sortKey === header) {
        state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      } else {
        state.sortKey = header;
        state.sortDir = "asc";
      }
      applyPlayerSort();
      renderPlayers();
    });
    tr.append(th);
  });

  el.playersHead.replaceChildren(tr);
}

function renderPlayers() {
  renderPlayersHeader();

  const totalPages = Math.max(1, Math.ceil(state.filteredRows.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const end = Math.min(start + state.pageSize, state.filteredRows.length);
  const rows = state.filteredRows.slice(start, end);

  el.playersBody.innerHTML = "";
  if (rows.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = state.visibleColumns.length;
    td.textContent = "No hay jugadores para los filtros seleccionados.";
    tr.append(td);
    el.playersBody.append(tr);
  } else {
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      state.visibleColumns.forEach((header) => {
        const td = document.createElement("td");
        td.textContent = formatNumber(row[header], header.includes("%") || header.includes("prom") ? 2 : 1);
        tr.append(td);
      });
      el.playersBody.append(tr);
    });
  }

  el.playerStatus.textContent = `${state.filteredRows.length.toLocaleString("es-AR")} jugadores visibles de ${state.rawRows.length.toLocaleString("es-AR")}`;
  el.playerPageStatus.textContent = `Página ${state.page} / ${totalPages} · filas ${state.filteredRows.length ? start + 1 : 0}-${end}`;
  el.prevPlayers.disabled = state.page <= 1;
  el.nextPlayers.disabled = state.page >= totalPages;
}

function parseGameFile(file) {
  const match = file.match(/^(\d+)_(.+) vs (.+) \((\d{3})_(\d{2})_(\d{4}) (\d{2})_(\d{2})\)\.parquet$/);
  if (!match) {
    return {
      id: file,
      home: "",
      away: "",
      dateLabel: "",
      monthKey: "",
      title: file.replace(".parquet", ""),
      file,
      href: `public_data/${encodeURIComponent(file)}`
    };
  }

  const [, id, home, away, day, month, year, hour, minute] = match;
  return {
    id: Number(id),
    home,
    away,
    dateLabel: `${day}/${month}/${year} ${hour}:${minute}`,
    monthKey: `${year}-${month}`,
    title: `${home} vs ${away}`,
    file,
    href: `public_data/${encodeURIComponent(file)}`
  };
}

function monthLabel(key) {
  if (!key) return "";
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

function applyGameFilters() {
  const query = normalizeText(el.gameSearch.value.trim());
  const team = el.gameTeamFilter.value;
  const month = el.gameMonthFilter.value;

  state.filteredGames = state.games.filter((game) => {
    if (team && game.home !== team && game.away !== team) return false;
    if (month && game.monthKey !== month) return false;
    if (!query) return true;
    return normalizeText(`${game.id} ${game.title} ${game.dateLabel} ${game.file}`).includes(query);
  });

  renderGames();
}

function renderGames() {
  el.gameStatus.textContent = `${state.filteredGames.length.toLocaleString("es-AR")} partidos visibles de ${state.games.length.toLocaleString("es-AR")}`;
  el.gameGrid.innerHTML = "";

  if (state.filteredGames.length === 0) {
    const empty = document.createElement("article");
    empty.className = "game-card";
    empty.textContent = "No hay partidos para los filtros seleccionados.";
    el.gameGrid.append(empty);
    return;
  }

  state.filteredGames.slice(0, 72).forEach((game) => {
    const card = document.createElement("article");
    card.className = "game-card";

    const title = document.createElement("strong");
    title.textContent = game.title;

    const meta = document.createElement("span");
    meta.textContent = `#${game.id} · ${game.dateLabel}`;

    const file = document.createElement("span");
    file.textContent = game.file;

    const link = document.createElement("a");
    link.className = "button button-ghost";
    link.href = game.href;
    link.download = game.file;
    link.textContent = "Descargar parquet";

    card.append(title, meta, file, link);
    el.gameGrid.append(card);
  });

  if (state.filteredGames.length > 72) {
    const more = document.createElement("article");
    more.className = "game-card";
    more.textContent = `Mostrando 72 resultados. Ajustá la búsqueda para acotar los ${state.filteredGames.length.toLocaleString("es-AR")} partidos encontrados.`;
    el.gameGrid.append(more);
  }
}

async function loadPlayers() {
  const response = await fetch(CSV_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar ${CSV_URL}`);
  const parsed = parseCSV(await response.text());

  state.headers = parsed.headers;
  state.rawRows = parsed.rows;
  state.filteredRows = [...state.rawRows];
  resetVisibleColumns();

  setSelectOptions(el.teamFilter, uniqueSorted(state.rawRows, "equipo"), "Todos");
  setSelectOptions(el.rivalFilter, uniqueSorted(state.rawRows, "rival"), "Todos");

  el.metricPlayers.textContent = state.rawRows.length.toLocaleString("es-AR");
  el.metricTeams.textContent = uniqueSorted(state.rawRows, "equipo").length.toLocaleString("es-AR");
  el.metricColumns.textContent = state.headers.length.toLocaleString("es-AR");

  renderPlayers();
}

async function loadGames() {
  const response = await fetch(MANIFEST_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo cargar ${MANIFEST_URL}`);
  const manifest = await response.json();
  state.games = manifest.files.map(parseGameFile).sort((a, b) => a.id - b.id);
  state.filteredGames = [...state.games];

  const teams = [...new Set(state.games.flatMap((game) => [game.home, game.away]).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "es"));
  const months = [...new Set(state.games.map((game) => game.monthKey).filter(Boolean))].sort();

  setSelectOptions(el.gameTeamFilter, teams, "Todos");
  el.gameMonthFilter.innerHTML = "";
  el.gameMonthFilter.append(new Option("Todos", ""));
  months.forEach((month) => el.gameMonthFilter.append(new Option(monthLabel(month), month)));

  el.metricGames.textContent = state.games.length.toLocaleString("es-AR");
  renderGames();
}

function bindEvents() {
  el.playerSearch.addEventListener("input", applyPlayerFilters);
  el.teamFilter.addEventListener("change", applyPlayerFilters);
  el.rivalFilter.addEventListener("change", applyPlayerFilters);
  el.metricGroupFilter.addEventListener("change", () => {
    resetVisibleColumns();
    renderPlayers();
  });
  el.resetPlayerFilters.addEventListener("click", () => {
    el.playerSearch.value = "";
    el.teamFilter.value = "";
    el.rivalFilter.value = "";
    el.metricGroupFilter.value = "all";
    resetVisibleColumns();
    applyPlayerFilters();
  });
  el.toggleColumns.addEventListener("click", () => {
    const isHidden = el.columnPanel.hidden;
    el.columnPanel.hidden = !isHidden;
    el.toggleColumns.setAttribute("aria-expanded", String(isHidden));
  });
  el.restoreColumns.addEventListener("click", () => {
    resetVisibleColumns();
    renderPlayers();
  });
  el.prevPlayers.addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    renderPlayers();
  });
  el.nextPlayers.addEventListener("click", () => {
    state.page += 1;
    renderPlayers();
  });
  el.playerPageSize.addEventListener("change", () => {
    state.pageSize = Number(el.playerPageSize.value);
    state.page = 1;
    renderPlayers();
  });

  el.gameSearch.addEventListener("input", applyGameFilters);
  el.gameTeamFilter.addEventListener("change", applyGameFilters);
  el.gameMonthFilter.addEventListener("change", applyGameFilters);
  el.resetGameFilters.addEventListener("click", () => {
    el.gameSearch.value = "";
    el.gameTeamFilter.value = "";
    el.gameMonthFilter.value = "";
    applyGameFilters();
  });
}

async function init() {
  el.year.textContent = new Date().getFullYear();
  bindEvents();

  try {
    await Promise.all([loadPlayers(), loadGames()]);
  } catch (error) {
    console.error(error);
    el.playerStatus.textContent = "No se pudo cargar el dataset. Revisá que los archivos públicos estén disponibles en GitHub Pages.";
    el.gameStatus.textContent = "No se pudo cargar el manifiesto de partidos.";
  }
}

init();
