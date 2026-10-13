/*
 * Dotted world map.
 *
 * The world-atlas country shapes (Natural Earth 1:50m, public domain) are drawn
 * once onto a hidden canvas, each country in its own colour, then sampled into
 * an 80 × 30 grid of 4.5° cells (the grid in the design). Each cell remembers
 * which countries cover it, so dots can be coloured by that country's state.
 *
 * Countries too small to fill a cell (Singapore, Vatican City, Tuvalu...) are
 * given the cell at their centre, so every country still has a dot.
 */
(function () {
  const COLS = 80, ROWS = 30, CELL = 4.5;   // degrees per cell
  const LON0 = -180, LAT0 = 83;             // top-left corner of the grid
  const SUB = 8;                            // sample pixels per cell side
  const LAND_MIN = 0.3;                     // share of a cell that must be land to get a dot
  const OWNER_MIN = 0.15;                   // share of a cell a country needs to colour it
  const NO_SHAPE = { TV: [179.2, -8.5] };   // countries missing from the map data: [lon, lat]

  let grid = null;          // Array(ROWS*COLS) of null | { owners: [codes], primary }
  let cellsOf = new Map();  // code -> [cell index]
  let centreOf = new Map(); // code -> [col, row] (fractional)

  const idx = (c, r) => r * COLS + c;

  async function build() {
    const topo = await fetch("data/countries-50m.json").then((r) => r.json());
    const features = topojson.feature(topo, topo.objects.countries).features.filter((f) => f.id !== "010");
    const numToCode = new Map(window.TASTED.list.map((c) => [c.num, c.code]));

    const W = COLS * SUB, H = ROWS * SUB;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const scale = SUB / (CELL * Math.PI / 180);
    const projection = d3.geoEquirectangular().scale(scale).translate([-LON0 / CELL * SUB, LAT0 / CELL * SUB]);
    const path = d3.geoPath(projection, ctx);

    // Each feature gets a unique colour; index 0 is "no country".
    const colourKey = (i) => [(i * 7) % 256, ((i * 7) >> 8) * 30 + 20, 200];
    const byColour = new Map();
    features.forEach((f, i) => {
      const [r, g, b] = colourKey(i + 1);
      byColour.set((r << 16) | (g << 8) | b, numToCode.get(f.id) || null);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.beginPath(); path(f); ctx.fill();
    });
    const px = ctx.getImageData(0, 0, W, H).data;

    grid = new Array(COLS * ROWS).fill(null);
    cellsOf = new Map();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let land = 0;
        const counts = new Map();
        for (let y = r * SUB; y < (r + 1) * SUB; y++) {
          for (let x = c * SUB; x < (c + 1) * SUB; x++) {
            const o = (y * W + x) * 4;
            if (px[o + 3] < 128) continue;
            land++;
            if (px[o + 3] !== 255) continue;
            const code = byColour.get((px[o] << 16) | (px[o + 1] << 8) | px[o + 2]);
            if (code) counts.set(code, (counts.get(code) || 0) + 1);
          }
        }
        if (land / (SUB * SUB) < LAND_MIN) continue;
        const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const owners = ranked.filter(([, n], i) => i === 0 || n / (SUB * SUB) >= OWNER_MIN).map(([code]) => code);
        grid[idx(c, r)] = { owners, primary: owners[0] || null };
        owners.forEach((code) => { if (!cellsOf.has(code)) cellsOf.set(code, []); cellsOf.get(code).push(idx(c, r)); });
      }
    }

    // Centres, and a guaranteed dot for every country.
    const toCell = ([lon, lat]) => [(lon - LON0) / CELL, (LAT0 - lat) / CELL];
    const byCode = d3.group(features.filter((f) => numToCode.has(f.id)), (f) => numToCode.get(f.id));
    window.TASTED.list.forEach(({ code }) => {
      let lonlat = NO_SHAPE[code];
      const fs = byCode.get(code);
      if (fs) {
        // Centre of the country's biggest piece (so e.g. the US centres on the mainland).
        const pieces = fs.flatMap((f) => f.geometry.type === "MultiPolygon"
          ? f.geometry.coordinates.map((p) => ({ type: "Polygon", coordinates: p })) : [f.geometry]);
        const main = pieces.reduce((a, b) => (d3.geoArea(b) > d3.geoArea(a) ? b : a));
        lonlat = d3.geoCentroid(main);
      }
      if (!lonlat) return;
      const [fc, fr] = toCell(lonlat);
      centreOf.set(code, [fc, fr]);
      if (!cellsOf.has(code)) {
        const c = Math.min(COLS - 1, Math.max(0, Math.floor(fc)));
        const r = Math.min(ROWS - 1, Math.max(0, Math.floor(fr)));
        const i = idx(c, r);
        if (!grid[i]) grid[i] = { owners: [], primary: code };
        grid[i].owners.push(code);
        cellsOf.set(code, [i]);
      }
    });
  }

  // "latest" > "tasted" > "land" for a cell, looking at every country that colours it.
  function cellState(cell, latest) {
    let s = "land";
    for (const code of cell.owners) {
      if (code === latest) return "latest";
      if (window.TASTED.isTasted(code)) s = "tasted";
    }
    return s;
  }

  function setupCanvas(canvas, w, h) {
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return ctx;
  }

  function dot(ctx, x, y, d, colour) {
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2); ctx.fill();
  }

  // Centre of a country in (fractional) cell units, for the pulse ring.
  function centre(code) {
    const cells = cellsOf.get(code) || [];
    if (cells.length) {
      const cs = cells.map((i) => i % COLS), rs = cells.map((i) => Math.floor(i / COLS));
      if (Math.max(...cs) - Math.min(...cs) < COLS / 2) {
        return [d3.mean(cs) + 0.5, d3.mean(rs) + 0.5];
      }
    }
    const c = centreOf.get(code);
    return c || [COLS / 2, ROWS / 2];
  }

  /* Home screen map: whole grid. Pitch 4.3px and 3px dots at 390pt wide. */
  function drawWorld(canvas, width, colours) {
    const P = width / COLS, d = P * (3 / 4.3);
    const h = ROWS * P;
    const ctx = setupCanvas(canvas, width, h);
    const latest = window.TASTED.latest();
    grid.forEach((cell, i) => {
      if (!cell) return;
      dot(ctx, (i % COLS) * P, Math.floor(i / COLS) * P, d, colours[cellState(cell, latest)]);
    });
    let pulse = null;
    if (latest) {
      const [c, r] = centre(latest);
      pulse = [c * P - (P - d) / 2, r * P - (P - d) / 2];
    }
    return { height: h, pitch: P, pulse };
  }

  /* Country screen map: a zoomed window of the same grid, centred on the country, wrapping east-west. */
  function drawRegion(canvas, width, focus, colours) {
    const P = 16, d = 10, rows = 14;
    const cols = Math.ceil(width / P) + 1;
    const ctx = setupCanvas(canvas, cols * P, rows * P);
    const [fc, fr] = centre(focus);
    const c0 = Math.round(fc - cols / 2);
    const r0 = Math.max(0, Math.min(ROWS - rows, Math.round(fr - rows / 2)));
    const mine = new Set(cellsOf.get(focus) || []);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const gc = (((c0 + c) % COLS) + COLS) % COLS, gr = r0 + r;
        const i = idx(gc, gr), cell = grid[i];
        if (!cell) continue;
        let colour = colours.land;
        if (mine.has(i)) colour = colours.focus;
        else if (cell.owners.some((code) => window.TASTED.isTasted(code))) colour = colours.tasted;
        dot(ctx, c * P + 3, r * P + 3, d, colour);
      }
    }
    return { canvasWidth: cols * P, pulse: [(fc - c0) * P, (fr - r0) * P] };
  }

  // Which country is under a tap on the home map.
  function hit(x, y, pitch) {
    const c = Math.floor(x / pitch), r = Math.floor(y / pitch);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    const cell = grid[idx(c, r)];
    return cell ? cell.primary : null;
  }

  window.TASTED_DOTS = { build, drawWorld, drawRegion, hit, COLS, ROWS };
})();
