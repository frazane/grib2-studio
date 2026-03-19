// ─────────────────────────────────────────────
// Tab switching (editor | tables | templates)
// ─────────────────────────────────────────────
function switchTab(tab) {
  state.tab = tab;
  state.selectedTableId = null;
  state.searchQuery = "";
  document.getElementById("search").value = "";

  document.getElementById("tab-editor").classList.toggle("active", tab === "editor");
  document.getElementById("tab-tables").classList.toggle("active", tab === "tables");
  document.getElementById("tab-templates").classList.toggle("active", tab === "templates");

  const isBrowser = tab === "tables" || tab === "templates";
  document.getElementById("load-grib2-label").style.display = tab === "editor" ? "" : "none";
  document.getElementById("browser-content").style.display = isBrowser ? "flex" : "none";
  document.getElementById("builder-main").style.display   = tab === "editor" ? "flex" : "none";

  if (tab === "editor") {
    renderBuilderSidebar();
    renderBuilderDetail();
  } else {
    renderSidebar();
    renderDetail(null);
  }
}

// ─────────────────────────────────────────────
// Sidebar rendering
// ─────────────────────────────────────────────
function currentTables() {
  if (state.tab === "tables") return state.codeTables;
  if (state.tab === "templates") return state.templateTables;
  return [];
}

function renderSidebar() {
  const sidebar = document.getElementById("sidebar");
  const tables = currentTables();
  const q = state.searchQuery.toLowerCase();

  let html = "";
  tables.forEach(table => {
    // If searching, only show tables that have matching entries
    if (q) {
      const match = matchesQuery(table, q);
      if (!match) return;
    }
    const sel = table.id === state.selectedTableId ? " selected" : "";
    html += `<div class="sidebar-item${sel}" onclick="selectTable('${table.id}')">
      <span class="table-num">${escHtml(table.type)} ${escHtml(table.id)}</span>
      <span class="entry-count">${table.entries.length}</span>
      <span class="table-name">${escHtml(table.title)}</span>
    </div>`;
  });

  sidebar.innerHTML = html || `<div style="padding:12px;color:#aaa">No results</div>`;
}

// ─────────────────────────────────────────────
// Select a table from sidebar
// ─────────────────────────────────────────────
function selectTable(id) {
  state.selectedTableId = id;
  state.searchQuery = "";
  document.getElementById("search").value = "";
  renderSidebar();
  const table = currentTables().find(t => t.id === id);
  renderDetail(table);
}

// ─────────────────────────────────────────────
// Detail panel rendering
// ─────────────────────────────────────────────
function renderDetail(table) {
  const detail = document.getElementById("detail");
  if (!table) {
    detail.innerHTML = `<div id="placeholder">← Select a table from the sidebar</div>`;
    return;
  }

  if (state.tab === "tables") {
    detail.innerHTML = renderCodeTable(table);
  } else {
    detail.innerHTML = renderTemplateTable(table);
  }
}

function renderCodeTable(table) {
  let html = `<h2>${escHtml(table.type)} ${escHtml(table.id)} — ${escHtml(table.title)}</h2>
    <div class="subtitle">${table.entries.length} entries</div>
    <table>
      <thead><tr>
        <th style="width:100px">Code</th>
        <th>Meaning</th>
        <th style="width:90px">Status</th>
      </tr></thead>
      <tbody>`;

  let lastSubTitle = null;
  table.entries.forEach(e => {
    if (e.subTitle && e.subTitle !== lastSubTitle) {
      lastSubTitle = e.subTitle;
      html += `<tr class="group-header"><td colspan="3">${escHtml(e.subTitle)}</td></tr>`;
    }
    const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
    html += `<tr>
      <td><code>${escHtml(e.code)}</code></td>
      <td>${escHtml(e.meaning)}</td>
      <td class="${statusCls}">${escHtml(e.status)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

function renderTemplateTable(table) {
  let html = `<h2>${escHtml(table.type)} ${escHtml(table.id)} — ${escHtml(table.title)}</h2>
    <div class="subtitle">${table.entries.length} octets/fields</div>
    <table>
      <thead><tr>
        <th style="width:90px">Octet(s)</th>
        <th>Contents</th>
        <th style="width:180px">Note / Reference</th>
        <th style="width:80px">Status</th>
      </tr></thead>
      <tbody>`;

  table.entries.forEach(e => {
    // Build reference cell: code table link, flag table link, note
    let ref = "";
    if (e.codeTable) {
      ref += `Code table: <a class="ref-link" onclick="goToTable('${escAttr(e.codeTable)}','tables')">${escHtml(e.codeTable)}</a>`;
    }
    if (e.flagTable) {
      if (ref) ref += "<br>";
      ref += `Flag table: <a class="ref-link" onclick="goToTable('${escAttr(e.flagTable)}','tables')">${escHtml(e.flagTable)}</a>`;
    }
    if (e.note && !e.codeTable && !e.flagTable) {
      ref = escHtml(e.note);
    } else if (e.note) {
      ref += `<br><small>${escHtml(e.note)}</small>`;
    }

    const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
    html += `<tr>
      <td><code>${escHtml(e.octetNo)}</code></td>
      <td>${escHtml(e.contents)}</td>
      <td>${ref}</td>
      <td class="${statusCls}">${escHtml(e.status)}</td>
    </tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// ─────────────────────────────────────────────
// Cross-reference navigation
// ─────────────────────────────────────────────
function goToTable(id, tab) {
  if (state.tab !== tab) {
    switchTab(tab);
  }
  state.selectedTableId = id;
  state.searchQuery = "";
  document.getElementById("search").value = "";
  renderSidebar();
  const table = currentTables().find(t => t.id === id);
  if (table) {
    renderDetail(table);
    // Scroll sidebar item into view
    setTimeout(() => {
      const items = document.querySelectorAll(".sidebar-item.selected");
      if (items[0]) items[0].scrollIntoView({ block: "nearest" });
    }, 50);
  } else {
    renderDetail(null);
    document.getElementById("detail").innerHTML =
      `<div style="padding:20px;color:#c00">Table ${escHtml(id)} not found.</div>`;
  }
}

// ─────────────────────────────────────────────
// Search
// ─────────────────────────────────────────────
function onSearch(query) {
  state.searchQuery = query.trim();

  if (!state.searchQuery) {
    state.selectedTableId = null;
    renderSidebar();
    renderDetail(null);
    return;
  }

  state.selectedTableId = null;
  renderSidebar();
  renderSearchResults(state.searchQuery);
}

function renderSearchResults(query) {
  const q = query.toLowerCase();
  const detail = document.getElementById("detail");

  // Gather hits from code/flag tables
  let codeHits = [];
  state.codeTables.forEach(table => {
    table.entries.forEach(e => {
      const haystack = [table.type, table.id, table.title, e.code || "", e.meaning || ""].join(" ").toLowerCase();
      if (haystack.includes(q)) codeHits.push({ table, entry: e });
    });
  });

  // Gather hits from template tables
  let templateHits = [];
  state.templateTables.forEach(table => {
    table.entries.forEach(e => {
      const haystack = [table.type, table.id, table.title, e.contents || "", e.note || ""].join(" ").toLowerCase();
      if (haystack.includes(q)) templateHits.push({ table, entry: e });
    });
  });

  const totalHits = codeHits.length + templateHits.length;
  if (!totalHits) {
    detail.innerHTML = `<div style="padding:20px;color:#aaa">No results for "${escHtml(query)}"</div>`;
    return;
  }

  let html = `<h3 style="margin-bottom:12px">${totalHits} result${totalHits !== 1 ? "s" : ""} for "${escHtml(query)}"</h3>`;

  if (codeHits.length > 0) {
    html += `<h4 style="margin:12px 0 6px;color:#555">Code &amp; Flag Tables (${codeHits.length})</h4>
      <table><thead><tr>
        <th style="width:140px">Table</th>
        <th style="width:90px">Code</th>
        <th>Meaning</th>
        <th style="width:90px">Status</th>
      </tr></thead><tbody>`;
    codeHits.forEach(({ table, entry: e }) => {
      const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
      const tableRef = `<a class="ref-link" onclick="goToTable('${escAttr(table.id)}','tables')">${escHtml(table.type)} ${escHtml(table.id)}</a>`;
      html += `<tr>
        <td>${tableRef}<br><small>${escHtml(table.title)}</small></td>
        <td><code>${escHtml(e.code)}</code></td>
        <td>${highlight(escHtml(e.meaning), query)}</td>
        <td class="${statusCls}">${escHtml(e.status)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  if (templateHits.length > 0) {
    html += `<h4 style="margin:16px 0 6px;color:#555">Templates (${templateHits.length})</h4>
      <table><thead><tr>
        <th style="width:140px">Table</th>
        <th style="width:80px">Octet(s)</th>
        <th>Contents</th>
        <th style="width:90px">Status</th>
      </tr></thead><tbody>`;
    templateHits.forEach(({ table, entry: e }) => {
      const statusCls = e.status === "Deprecated" ? "status-deprecated" : "status-operational";
      const tableRef = `<a class="ref-link" onclick="goToTable('${escAttr(table.id)}','templates')">${escHtml(table.type)} ${escHtml(table.id)}</a>`;
      html += `<tr>
        <td>${tableRef}<br><small>${escHtml(table.title)}</small></td>
        <td><code>${escHtml(e.octetNo)}</code></td>
        <td>${highlight(escHtml(e.contents), query)}</td>
        <td class="${statusCls}">${escHtml(e.status)}</td>
      </tr>`;
    });
    html += `</tbody></table>`;
  }

  detail.innerHTML = html;
}

// escHtml, escAttr, highlight, matchesQuery are in js/utils.js
