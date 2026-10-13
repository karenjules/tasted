(function () {
  const T = window.TASTED;
  const DOTS = window.TASTED_DOTS;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const fold = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const pct = (n) => Math.round((n / T.total) * 100);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const COLOURS = {
    world: { land: "#5A3B2A", tasted: "#FF4F1A", latest: "#FF8B2B" },
    region: { land: "#4E3324", tasted: "#7A2A12", focus: "#FF8B2B" },
  };
  const FLAME_PATH = "M12 2.5c.8 3.6 5.5 5.6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4.2 2.2-6.6 1 1.1 1.6 2.3 1.8 3.6C11.6 8.2 11.6 5.2 12 2.5z";
  const CHECK_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF4F1A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const PLUS_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2F1B12" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const CHEVRON = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2F1B12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  document.addEventListener("gesturestart", (e) => e.preventDefault());
  let mapReady = false;

  /* ================= Routing ================= */
  // #/  (map)   #/list   #/stats   #/c/JP  (country)
  let route = { screen: "map" };
  let lastTab = "map";
  let navigatedInApp = false;

  function parse() {
    const h = location.hash.replace(/^#\/?/, "");
    const m = h.match(/^c\/([A-Z]{2})$/);
    if (m && T.country(m[1])) return { screen: "country", code: m[1] };
    if (h === "list" || h === "stats") return { screen: h };
    return { screen: "map" };
  }
  function go(hash) { navigatedInApp = true; location.hash = hash; }
  function show() {
    route = parse();
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "screen-" + route.screen));
    document.body.classList.toggle("detail-open", route.screen === "country");
    $("theme-color").setAttribute("content", route.screen === "country" ? "#2F1B12" : "#F1DFC3");
    if (route.screen !== "country") {
      lastTab = route.screen;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === route.screen));
    }
    render();
  }
  window.addEventListener("hashchange", show);

  function render() {
    if (route.screen === "map") renderMap();
    else if (route.screen === "list") renderList();
    else if (route.screen === "stats") renderStats();
    else if (route.screen === "country") renderDetail(route.code);
  }

  /* ================= Map (home) ================= */
  let worldPitch = 4.3;
  function renderMap() {
    const n = T.count();
    $("hero-num").textContent = n;
    $("hero-total").textContent = T.total;
    const month = T.thisMonth();
    $("sticker").hidden = month === 0;
    $("sticker").textContent = `+${month} this month`;
    $("map-explored").textContent = `${pct(n)}% EXPLORED`;

    if (mapReady) {
      const cardW = $("world").parentElement.clientWidth;
      const width = cardW - 6;  // 344 inside a 350 card, as designed
      const { height, pitch, pulse } = DOTS.drawWorld($("world-canvas"), width, COLOURS.world);
      worldPitch = pitch;
      Object.assign($("world").style, { width: width + "px", height: height + "px" });
      const p = $("world-pulse");
      p.hidden = !pulse;
      if (pulse) { p.style.left = pulse[0] + "px"; p.style.top = pulse[1] + "px"; }
    }

    $("continent-cards").innerHTML = T.continentStats().map((c) => `
      <button class="cont-card" data-cont="${c.name}">
        <div class="cont-name">${c.name}</div>
        <div class="cont-count"><b>${c.done}</b>/${c.total}</div>
        <div class="bar"><div style="width:${Math.max(2, Math.round((c.done / c.total) * 100))}%"></div></div>
      </button>`).join("");

    const latest = T.latest();
    const card = $("latest");
    if (latest) {
      const c = T.country(latest), e = T.get(latest);
      const dish = e.dishes[0] ? ", " + softLower(e.dishes[0]) : "";
      card.dataset.code = latest;
      card.innerHTML = `
        <div class="tile latest-tile">${latest}</div>
        <div class="latest-text">
          <div class="latest-label">LATEST · ${ago(e.firstTasted)}</div>
          <div class="latest-title">${esc(c.name + dish)}</div>
        </div>${CHEVRON}`;
    } else {
      card.dataset.code = "";
      card.innerHTML = `
        <div class="tile on">${PLUS_SVG.replace('width="14" height="14"', 'width="20" height="20"')}</div>
        <div class="latest-text">
          <div class="latest-label">START YOUR PASSPORT</div>
          <div class="latest-title">Log your first country</div>
        </div>${CHEVRON}`;
    }
  }
  // "Tonkotsu ramen" -> "tonkotsu ramen" (but leaves "BBQ" alone), as in the design.
  const softLower = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  function ago(ymd) {
    if (!ymd) return "RECENTLY";
    const [y, m, d] = ymd.split("-").map(Number);
    const now = new Date();
    const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(y, m - 1, d)) / 86400000);
    if (days === 0) return "TODAY";
    if (days === 1) return "YESTERDAY";
    if (days > 1 && days <= 30) return `${days} DAYS AGO`;
    return fmtDate(ymd).toUpperCase();
  }

  $("map-search").addEventListener("click", () => openListSearch());
  $("continent-cards").addEventListener("click", (e) => {
    const b = e.target.closest(".cont-card");
    if (!b) return;
    listState.cont = b.dataset.cont; listState.seg = "all"; listState.q = ""; $("search").value = "";
    $("list-body").scrollTop = 0;
    go("#/list");
  });
  $("latest").addEventListener("click", () => {
    const code = $("latest").dataset.code;
    code ? go("#/c/" + code) : openListSearch();
  });
  $("world-canvas").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const code = DOTS.hit(e.clientX - r.left, e.clientY - r.top, worldPitch);
    if (code) go("#/c/" + code);
  });

  /* ================= List ================= */
  const listState = { q: "", seg: "all", cont: "All" };

  function renderList() {
    const n = T.count();
    $("list-count").textContent = `${n} TASTED · ${T.total - n} TO GO`;
    $("list-pct").textContent = pct(n) + "%";
    $("search").placeholder = `Search ${T.total} countries`;
    document.querySelectorAll("#segs button").forEach((b) => b.classList.toggle("on", b.dataset.seg === listState.seg));
    $("chips").innerHTML = ["All", ...T.continents].map((c) =>
      `<button type="button" class="chip${listState.cont === c ? " on" : ""}" data-cont="${c}">${c}</button>`).join("");

    const needle = fold(listState.q.trim());
    const stats = new Map(T.continentStats().map((s) => [s.name, s]));
    const html = T.continents.filter((c) => listState.cont === "All" || listState.cont === c).map((cont) => {
      const s = stats.get(cont);
      const items = T.list.filter((c) => {
        if (c.continent !== cont) return false;
        const on = T.isTasted(c.code);
        if (listState.seg === "tasted" && !on) return false;
        if (listState.seg === "todo" && on) return false;
        return !needle || fold(c.name).includes(needle) || c.code.toLowerCase() === needle;
      });
      if (!items.length) return "";
      return `
        <div class="sec-head">
          <span>${cont.toUpperCase()}</span>
          <div class="sec-bar"><div style="width:${Math.max(2, Math.round((s.done / s.total) * 100))}%"></div></div>
          <span class="sec-count">${s.done}/${s.total}</span>
        </div>${items.map(rowHTML).join("")}`;
    }).join("");
    $("list-body").innerHTML = html || `
      <div class="empty">
        <div class="empty-title">Nothing on the menu</div>
        <div class="empty-sub">Try another search or filter</div>
      </div>`;
  }

  function rowHTML(c) {
    const e = T.get(c.code), on = e.tasted;
    const sub = on ? (e.dishes.join(", ") || "Tasted") : "Not tasted yet";
    return `
      <div class="row${on ? " on" : ""}">
        <button class="row-main" data-open="${c.code}">
          <div class="tile${on ? " on" : ""}">${c.code}</div>
          <div class="row-text">
            <div class="row-name">${esc(c.name)}</div>
            <div class="row-sub">${esc(sub)}</div>
          </div>
        </button>
        <button type="button" class="check-btn" data-toggle="${c.code}" aria-pressed="${on}"
          aria-label="${on ? "Remove " + esc(c.name) + " from tasted" : "Mark " + esc(c.name) + " as tasted"}">
          <span class="check${on ? " on" : ""}">${on ? CHECK_SVG : PLUS_SVG}</span>
        </button>
      </div>`;
  }

  let popCode = null;
  $("list-body").addEventListener("click", (e) => {
    const open = e.target.closest("[data-open]");
    if (open) return go("#/c/" + open.dataset.open);
    const t = e.target.closest("[data-toggle]");
    if (t) {
      const code = t.dataset.toggle, on = !T.isTasted(code);
      popCode = on ? code : null;
      T.setTasted(code, on);
      if (on) toast(`${T.country(code).name} tasted`);
    }
  });
  $("search").addEventListener("input", (e) => { listState.q = e.target.value; renderList(); });
  $("search").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("segs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    listState.seg = b.dataset.seg; renderList(); $("list-body").scrollTop = 0;
  });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    listState.cont = b.dataset.cont; renderList(); $("list-body").scrollTop = 0;
  });
  $("list-body").addEventListener("scroll", () => { if (document.activeElement === $("search")) $("search").blur(); }, { passive: true });

  function openListSearch() {
    if (route.screen !== "list") {
      navigatedInApp = true;
      history.pushState(null, "", "#/list");
      show();
    }
    $("search").focus();
  }

  /* ================= Country detail ================= */
  let armedDish = null;

  function renderDetail(code) {
    const c = T.country(code), e = T.get(code);
    const latest = T.latest() === code;

    const tile = $("d-tile");
    tile.textContent = code;
    tile.className = "tile tile-lg" + (latest ? " latest-tile" : e.tasted ? " on" : "");
    const h1 = $("d-name");
    h1.textContent = c.name;
    h1.className = c.name.length > 20 ? "xlong" : c.name.length > 11 ? "long" : "";
    $("d-region").textContent = `${c.continent.toUpperCase()} · ${c.region.toUpperCase()}`;

    const pill = $("d-toggle");
    pill.classList.toggle("on", e.tasted);
    pill.setAttribute("aria-pressed", e.tasted);
    $("d-toggle-label").textContent = e.tasted ? "Tasted" : "Mark tasted";

    $("d-dish-label").textContent = `WHAT YOU ATE · ${e.dishes.length}`;
    $("d-dishes").innerHTML = e.dishes.map((d, i) =>
      `<button type="button" class="dish${armedDish === i ? " armed" : ""}" data-dish="${i}" aria-label="${esc(d)}${armedDish === i ? ", tap again to remove" : ""}">${esc(d)}<span class="x" aria-hidden="true">×</span></button>`).join("");

    const dateText = $("d-date-text");
    dateText.textContent = e.firstTasted ? fmtDate(e.firstTasted) : "Add date";
    dateText.classList.toggle("empty-val", !e.firstTasted);
    if (document.activeElement !== $("d-date")) $("d-date").value = e.firstTasted || "";
    if (document.activeElement !== $("d-where")) $("d-where").value = e.where;

    $("d-flames").innerHTML = [1, 2, 3, 4, 5].map((n) => {
      const on = n <= e.heat;
      return `<button type="button" data-heat="${n}" aria-label="Heat ${n} of 5" aria-pressed="${on}">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="${on ? "#FF4F1A" : "none"}" stroke="${on ? "#FF4F1A" : "#A0806A"}" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="${FLAME_PATH}"/></svg></button>`;
    }).join("");

    const wish = $("detail-wish");
    wish.classList.toggle("on", e.wishlist);
    wish.setAttribute("aria-pressed", e.wishlist);
    wish.setAttribute("aria-label", e.wishlist ? `Remove ${c.name} from your list` : `Add ${c.name} to your list`);
    $("detail-share").setAttribute("aria-label", "Share " + c.name);

    if (mapReady) {
      const W = $("detail-map").clientWidth;
      const { canvasWidth, pulse } = DOTS.drawRegion($("detail-canvas"), W, code, COLOURS.region);
      const left = (W - canvasWidth) / 2;
      $("detail-canvas").style.left = left + "px";
      $("detail-pulse").style.left = left + pulse[0] + "px";
      $("detail-pulse").style.top = pulse[1] + "px";
    }
  }

  const cur = () => route.code;
  function back() {
    armedDish = null;
    if (navigatedInApp && history.length > 1) history.back();
    else { navigatedInApp = true; location.hash = lastTab === "map" ? "#/" : "#/" + lastTab; }
  }
  $("detail-back").addEventListener("click", back);
  $("d-toggle").addEventListener("click", () => T.setTasted(cur(), !T.isTasted(cur())));
  $("detail-wish").addEventListener("click", () => {
    const on = !T.get(cur()).wishlist;
    T.update(cur(), { wishlist: on });
    const tasted = T.isTasted(cur());
    toast(on ? (tasted ? "Bookmarked" : "Added to Up next") : (tasted ? "Bookmark removed" : "Removed from Up next"));
  });
  $("detail-share").addEventListener("click", async () => {
    const c = T.country(cur()), e = T.get(cur());
    const text = e.tasted
      ? `I've tasted ${c.name}${e.dishes.length ? ": " + e.dishes.join(", ") : ""}. ${T.count()} of ${T.total} countries on my food passport.`
      : `${c.name} is next on my food passport.`;
    try {
      if (navigator.share) await navigator.share({ title: "Tasted", text });
      else { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
    } catch (err) { /* share sheet dismissed */ }
  });
  $("d-dishes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-dish]"); if (!b) return;
    const i = Number(b.dataset.dish);
    if (armedDish === i) {
      const dishes = T.get(cur()).dishes.filter((_, j) => j !== i);
      armedDish = null;
      T.update(cur(), { dishes });
    } else { armedDish = i; renderDetail(cur()); }
  });
  document.addEventListener("click", (e) => {
    if (armedDish !== null && !e.target.closest("[data-dish]") && route.screen === "country") { armedDish = null; renderDetail(cur()); }
  });
  $("d-dish-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("d-dish-input"), v = input.value.trim();
    if (!v) return input.focus();
    input.value = "";
    T.update(cur(), { dishes: [...T.get(cur()).dishes, v] });
  });
  $("d-date").addEventListener("change", (e) => T.update(cur(), { firstTasted: e.target.value || null }));
  $("d-where").addEventListener("input", (e) => T.update(cur(), { where: e.target.value }, { quiet: true }));
  $("d-where").addEventListener("keydown", (e) => { if (e.key === "Enter") e.target.blur(); });
  $("d-flames").addEventListener("click", (e) => {
    const b = e.target.closest("[data-heat]"); if (!b) return;
    const n = Number(b.dataset.heat);
    T.update(cur(), { heat: T.get(cur()).heat === n ? 0 : n });
  });
  $("d-save").addEventListener("click", () => {
    const code = cur();
    const pending = $("d-dish-input").value.trim();
    if (pending) { $("d-dish-input").value = ""; T.update(code, { dishes: [...T.get(code).dishes, pending] }); }
    if (!T.isTasted(code)) T.setTasted(code, true);
    document.activeElement && document.activeElement.blur();
    toast(`${T.country(code).name} saved to your passport`);
    back();
  });

  /* ================= Stats ================= */
  function renderStats() {
    const n = T.count();
    $("stats-pct").textContent = pct(n) + "%";
    $("stats-sub").innerHTML = `${n} of ${T.total}<br>countries tasted`;
    let cells = "";
    for (let i = 0; i < T.total; i++) cells += `<i${i < n ? ' class="on"' : ""}></i>`;
    $("cells").innerHTML = cells;
    $("bars").innerHTML = T.continentStats().map((c) => `
      <div class="bar-row">
        <div class="bar-name">${c.name}</div>
        <div class="big-bar"><div style="width:${Math.max(3, Math.round((c.done / c.total) * 100))}%"></div></div>
        <div class="bar-count">${c.done}/${c.total}</div>
      </div>`).join("");
    const wish = T.wishlist();
    $("up-next").innerHTML = wish.length
      ? wish.map((c) => `<button class="next-chip" data-open="${c.code}"><span>${c.code}</span>${esc(c.name)}</button>`).join("")
      : `<div class="note">Tap the bookmark on any country and it'll show up here.</div>`;
    renderBackupNote();
  }
  $("up-next").addEventListener("click", (e) => {
    const b = e.target.closest("[data-open]"); if (b) go("#/c/" + b.dataset.open);
  });

  function renderBackupNote() {
    const last = T.lastExport();
    if (!last) {
      $("backup-note").textContent = T.count()
        ? "Your passport only lives on this phone. Export a backup to Files now and then."
        : "Your passport only lives on this phone. Export a backup now and then.";
      return;
    }
    const days = Math.floor((Date.now() - new Date(last)) / 86400000);
    const when = days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
    $("backup-note").textContent = `Last exported ${when}.` + (days >= 30 ? " Time for a fresh backup?" : "");
  }

  $("btn-export").addEventListener("click", async () => {
    const name = `tasted-backup-${T.today()}.json`;
    const file = new File([T.backupJSON()], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Tasted backup" });
        T.markExported();
        toast("Backup exported");
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(file);
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    T.markExported();
    toast("Backup downloaded");
  });
  $("import-file").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      JSON.parse(text);
      const n = T.count();
      if (n && !confirm(`Replace your passport (${n} ${n === 1 ? "country" : "countries"}) with this backup?`)) return;
      const restored = T.importJSON(text);
      toast(`Restored ${restored} ${restored === 1 ? "country" : "countries"}`);
    } catch (err) {
      toast(err instanceof SyntaxError ? "That file isn't a Tasted backup" : err.message);
    }
  });

  /* ================= Tab bar ================= */
  $("tabbar").addEventListener("click", (e) => {
    const t = e.target.closest(".tab");
    if (t) go(t.dataset.tab === "map" ? "#/" : "#/" + t.dataset.tab);
  });
  $("fab").addEventListener("click", () => openListSearch());

  /* ================= Toast ================= */
  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg; t.hidden = false;
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ================= Wire up ================= */
  T.onChange((change) => {
    if (change.quiet) return;
    render();
    if (popCode && route.screen === "list") {
      const el = document.querySelector(`[data-toggle="${popCode}"] .check`);
      if (el) el.classList.add("pop");
      popCode = null;
    }
  });
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 120); });

  show();
  DOTS.build().then(() => { mapReady = true; render(); }).catch((e) => { console.error(e); toast("Couldn't load the map"); });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    if (navigator.serviceWorker.controller) {
      let reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
    }
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(console.warn));
  }
})();
