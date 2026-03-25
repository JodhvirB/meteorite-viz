/* ============================================
   IMPACTS MODULE — Canvas-based meteorite rendering
   High-performance: draws 32k+ points at 60 FPS
   ============================================ */

const Impacts = (() => {
  let allData = [];
  let filteredData = [];
  let visibleData = [];
  let canvas, ctx;
  let projection;
  let currentMaxYear = 2013;
  let massScale;
  let width, height;

  // Ring animations queue
  let activeRings = [];

  // Hover state
  let hoveredItem = null;
  let lastMouseX = 0, lastMouseY = 0;

  // Stats throttle
  let lastStatsUpdate = 0;

  // Color palette for mass categories
  const MASS_COLORS = {
    tiny:    '#4fc3f7',  // < 100g
    small:   '#29b6f6',  // 100g-1kg
    medium:  '#ffb74d',  // 1kg-100kg
    large:   '#ff7043',  // 100kg-10t
    massive: '#ef5350',  // > 10t
  };

  function getMassCategory(mass) {
    if (mass < 100) return 'tiny';
    if (mass < 1000) return 'small';
    if (mass < 100000) return 'medium';
    if (mass < 10000000) return 'large';
    return 'massive';
  }

  function getColor(mass) {
    return MASS_COLORS[getMassCategory(mass)];
  }

  function getOpacity(mass) {
    if (mass < 100) return 0.4;
    if (mass < 1000) return 0.55;
    if (mass < 100000) return 0.7;
    return 0.85;
  }

  function init(data) {
    allData = data;
    filteredData = data;

    canvas = document.getElementById('impacts-canvas');
    ctx = canvas.getContext('2d');
    projection = Globe.getProjection();

    // Size canvas to match globe SVG
    width = Globe.getWidth();
    height = Globe.getHeight();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.scale(dpr, dpr);

    // Mass → radius scale
    massScale = d3.scaleSqrt()
      .domain([0, 100, 1000, 100000, 10000000, 60000000])
      .range([1.5, 2.5, 4, 7, 12, 20])
      .clamp(true);

    // Listen for globe rotation — redraw canvas
    Globe.onRotate((proj) => {
      projection = proj;
      draw();
    });

    // Mouse events for tooltip hit-testing
    // Listen on the SVG (which has pointer events) and map to canvas coords
    const svgEl = Globe.getSvg().node();
    svgEl.addEventListener('mousemove', onMouseMove);
    svgEl.addEventListener('mouseleave', onMouseLeave);
  }

  function setMaxYear(year) {
    currentMaxYear = year;
    updateVisible();
  }

  function setFilteredData(data) {
    filteredData = data;
    updateVisible();
  }

  function updateVisible() {
    visibleData = filteredData.filter(d => d.year <= currentMaxYear);
    draw();
    updateStats();
  }

  // ---- Main Canvas Draw (called every frame) ----
  function draw() {
    ctx.clearRect(0, 0, width, height);

    const center = Globe.getCenter();
    const r = Globe.getProjection().scale(); // current scale (accounts for zoom)

    // Draw all visible impacts
    for (let i = 0; i < visibleData.length; i++) {
      const d = visibleData[i];
      const coords = projection([d.lng, d.lat]);
      if (!coords) continue;

      // Cull: check if on front of globe
      const dist = d3.geoDistance([d.lng, d.lat], projection.invert(center));
      if (dist > Math.PI / 2) continue;

      const x = coords[0];
      const y = coords[1];
      const radius = massScale(d.mass);
      const color = getColor(d.mass);
      const alpha = getOpacity(d.mass);

      // Highlight hovered item
      const isHovered = hoveredItem && hoveredItem.id === d.id;

      ctx.globalAlpha = isHovered ? 1 : alpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? radius * 1.8 : radius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle stroke
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 2 : 0.5;
      ctx.globalAlpha = isHovered ? 1 : alpha * 0.6;
      ctx.stroke();
    }

    // Draw active ring animations
    drawRings();

    ctx.globalAlpha = 1;
  }

  // ---- Ring Animations ----
  function drawRings() {
    const now = performance.now();
    const remaining = [];

    for (let i = 0; i < activeRings.length; i++) {
      const ring = activeRings[i];
      const elapsed = now - ring.startTime;
      const progress = elapsed / ring.duration;

      if (progress >= 1) continue; // done, don't keep

      // Reproject position (globe may have rotated)
      const coords = projection([ring.lng, ring.lat]);
      if (!coords) { remaining.push(ring); continue; }

      // Check front of globe
      const dist = d3.geoDistance([ring.lng, ring.lat], projection.invert(Globe.getCenter()));
      if (dist > Math.PI / 2) { remaining.push(ring); continue; }

      const x = coords[0];
      const y = coords[1];
      const currentR = ring.startR + (ring.endR - ring.startR) * progress;
      const alpha = (1 - progress) * 0.7;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.max(0.5, 2 * (1 - progress));
      ctx.beginPath();
      ctx.arc(x, y, currentR, 0, Math.PI * 2);
      ctx.stroke();

      remaining.push(ring);
    }

    activeRings = remaining;
  }

  function animateNewImpacts(newData) {
    const now = performance.now();

    for (let i = 0; i < newData.length; i++) {
      const d = newData[i];
      const color = getColor(d.mass);
      const baseR = massScale(d.mass);

      // Ring 1
      activeRings.push({
        lng: d.lng, lat: d.lat, color,
        startR: baseR, endR: baseR * 4,
        startTime: now, duration: 800
      });

      // Ring 2 (delayed)
      activeRings.push({
        lng: d.lng, lat: d.lat, color,
        startR: baseR, endR: baseR * 3,
        startTime: now + 200, duration: 600
      });
    }

    // Cap active rings to prevent memory bloat
    if (activeRings.length > 500) {
      activeRings = activeRings.slice(-300);
    }
  }

  // ---- Tooltip Hit Testing ----
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    const svgRect = Globe.getSvg().node().getBoundingClientRect();
    // Canvas is positioned same as SVG in the wrapper
    const mx = event.clientX - svgRect.left;
    const my = event.clientY - svgRect.top;
    lastMouseX = mx;
    lastMouseY = my;

    const center = Globe.getCenter();
    let closest = null;
    let closestDist = 15; // max hover distance in px

    for (let i = visibleData.length - 1; i >= 0; i--) {
      const d = visibleData[i];
      const coords = projection([d.lng, d.lat]);
      if (!coords) continue;

      const dist = d3.geoDistance([d.lng, d.lat], projection.invert(center));
      if (dist > Math.PI / 2) continue;

      const dx = coords[0] - mx;
      const dy = coords[1] - my;
      const pixelDist = Math.sqrt(dx * dx + dy * dy);
      const hitRadius = Math.max(massScale(d.mass) * 1.5, 8);

      if (pixelDist < hitRadius && pixelDist < closestDist) {
        closest = d;
        closestDist = pixelDist;
      }
    }

    if (closest) {
      hoveredItem = closest;
      Tooltip.show(event, closest);
      canvas.style.cursor = 'pointer';
    } else {
      if (hoveredItem) {
        hoveredItem = null;
        Tooltip.hide();
        canvas.style.cursor = '';
      }
    }
  }

  function onMouseLeave() {
    hoveredItem = null;
    Tooltip.hide();
    canvas.style.cursor = '';
  }

  // ---- Stats ----
  function updateStats() {
    const now = performance.now();
    if (now - lastStatsUpdate < 200) return;
    lastStatsUpdate = now;

    const count = visibleData.length;
    const largest = count > 0
      ? visibleData.reduce((max, d) => d.mass > max.mass ? d : max, visibleData[0])
      : null;

    document.getElementById('stat-count').textContent = count.toLocaleString();
    document.getElementById('stat-largest').textContent = largest
      ? (largest.mass / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

    if (count > 0) {
      const minY = visibleData[0].year;
      const maxY = visibleData[count - 1].year;
      document.getElementById('stat-year').textContent = `${minY}–${maxY}`;
    }
  }

  function getMassScale() { return massScale; }
  function getMassColors() { return MASS_COLORS; }
  function getVisibleData() { return visibleData; }

  return {
    init, setMaxYear, setFilteredData, updateVisible,
    animateNewImpacts, getMassScale, getMassColors,
    getVisibleData, getColor, draw
  };
})();
