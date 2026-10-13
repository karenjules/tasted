/*
 * Everything is saved on the phone in localStorage under one key:
 *
 *   { "version": 1,
 *     "countries": {
 *       "JP": { "tasted": true, "dishes": ["Tonkotsu ramen"], "firstTasted": "2026-10-11",
 *               "where": "Ichiran", "heat": 3, "wishlist": false, "tastedAt": "2026-10-11T19:02:00.000Z" }
 *     },
 *     "lastExport": "2026-10-13T09:00:00.000Z" }
 *
 * Keys are ISO 3166-1 alpha-2 codes. Countries you've never touched aren't stored.
 */
(function () {
  const KEY = "tasted.v1";
  const LIST = window.TASTED_COUNTRIES.map(([code, num, name, continent, region]) => ({ code, num, name, continent, region }));
  const BY_CODE = new Map(LIST.map((c) => [c.code, c]));
  const listeners = [];

  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function clean(e) {
    e = e || {};
    return {
      tasted: !!e.tasted,
      dishes: Array.isArray(e.dishes) ? e.dishes.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 50) : [],
      firstTasted: /^\d{4}-\d{2}-\d{2}$/.test(e.firstTasted) ? e.firstTasted : null,
      where: typeof e.where === "string" ? e.where.slice(0, 60) : "",
      heat: Number.isInteger(e.heat) && e.heat >= 0 && e.heat <= 5 ? e.heat : 0,
      wishlist: !!e.wishlist,
      tastedAt: typeof e.tastedAt === "string" ? e.tastedAt : null,
    };
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (raw && raw.countries) {
        const countries = {};
        Object.entries(raw.countries).forEach(([c, e]) => { if (BY_CODE.has(c)) countries[c] = clean(e); });
        return { version: 1, countries, lastExport: raw.lastExport || null };
      }
    } catch (e) { /* start fresh */ }
    return { version: 1, countries: {}, lastExport: null };
  }

  let state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn(e); } };
  const emit = (change) => listeners.forEach((fn) => fn(change));

  const S = {
    list: LIST,
    total: LIST.length,
    continents: window.TASTED_CONTINENTS,
    country: (code) => BY_CODE.get(code),
    get: (code) => clean(state.countries[code]),
    isTasted: (code) => !!(state.countries[code] && state.countries[code].tasted),
    onChange: (fn) => listeners.push(fn),
    today,

    tastedList() { return LIST.filter((c) => this.isTasted(c.code)); },
    count() { return this.tastedList().length; },

    continentStats() {
      return this.continents.map((name) => {
        const all = LIST.filter((c) => c.continent === name);
        return { name, total: all.length, done: all.filter((c) => this.isTasted(c.code)).length };
      });
    },

    // Most recently tasted country: latest "first tasted" date, then most recently marked.
    latest() {
      let best = null;
      this.tastedList().forEach((c) => {
        const e = state.countries[c.code];
        const k = (e.firstTasted || "") + "|" + (e.tastedAt || "");
        if (!best || k > best.k) best = { code: c.code, k };
      });
      return best ? best.code : null;
    },

    thisMonth() {
      const m = today().slice(0, 7);
      return this.tastedList().filter((c) => (state.countries[c.code].firstTasted || "").startsWith(m)).length;
    },

    wishlist() {
      return LIST.filter((c) => state.countries[c.code] && state.countries[c.code].wishlist && !this.isTasted(c.code));
    },

    update(code, patch, meta) {
      if (!BY_CODE.has(code)) return;
      const before = clean(state.countries[code]);
      const next = clean({ ...before, ...patch });
      if (next.tasted && !before.tasted) {
        next.tastedAt = new Date().toISOString();
        if (!next.firstTasted) next.firstTasted = today();
      }
      state.countries[code] = next;
      save();
      emit({ code, before, after: next, ...(meta || {}) });
    },

    setTasted(code, on) { this.update(code, { tasted: on }); },

    lastExport: () => state.lastExport,
    markExported() { state.lastExport = new Date().toISOString(); save(); emit({ type: "export" }); },

    backupJSON() {
      const countries = {};
      Object.keys(state.countries).sort().forEach((c) => { countries[c] = state.countries[c]; });
      return JSON.stringify({ app: "Tasted", version: 1, exportedAt: new Date().toISOString(), tasted: this.count(), countries }, null, 2);
    },

    // Replaces everything with the backup. Returns how many countries are tasted afterwards.
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || typeof data.countries !== "object" || Array.isArray(data.countries)) {
        throw new Error("That file isn't a Tasted backup.");
      }
      const countries = {};
      Object.entries(data.countries).forEach(([c, e]) => {
        const code = String(c).toUpperCase();
        if (BY_CODE.has(code)) countries[code] = clean(e);
      });
      state.countries = countries;
      save();
      emit({ type: "import" });
      return this.count();
    },
  };

  window.TASTED = S;
})();
