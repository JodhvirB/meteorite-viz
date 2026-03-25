/* ============================================
   GLOBE MODULE — Interactive D3 Orthographic Globe
   ============================================ */

const Globe = (() => {
  let svg, g, projection, path, globeCircle;
  let width, height, radius;
  let worldData = null;
  let rotation = [0, -20, 0];
  let onRotateCallbacks = [];

  // Auto-rotate state
  let autoRotate = true;
  let autoRotateSpeed = 0.15;
  let autoRotateTimer = null;
  let lastInteraction = 0;

  function init() {
    const container = document.getElementById('globe-container');
    const rect = container.getBoundingClientRect();
    width = Math.min(rect.width - 10, 620);
    height = Math.min(rect.height - 50, 620);
    radius = Math.min(width, height) / 2 - 8;

    svg = d3.select('#globe')
      .attr('width', width)
      .attr('height', height);

    // Defs for gradients and filters
    const defs = svg.append('defs');

    // Atmosphere glow gradient
    const atmosGrad = defs.append('radialGradient')
      .attr('id', 'atmosphere-gradient')
      .attr('cx', '50%').attr('cy', '50%')
      .attr('r', '50%');
    atmosGrad.append('stop').attr('offset', '85%').attr('stop-color', 'rgba(80,160,255,0)');
    atmosGrad.append('stop').attr('offset', '100%').attr('stop-color', 'rgba(80,160,255,0.12)');

    // Ocean gradient
    const oceanGrad = defs.append('radialGradient')
      .attr('id', 'ocean-gradient')
      .attr('cx', '45%').attr('cy', '40%')
      .attr('r', '55%');
    oceanGrad.append('stop').attr('offset', '0%').attr('stop-color', '#0f2235');
    oceanGrad.append('stop').attr('offset', '100%').attr('stop-color', '#08111e');

    // Glow filter for impacts
    const glow = defs.append('filter')
      .attr('id', 'glow')
      .attr('x', '-50%').attr('y', '-50%')
      .attr('width', '200%').attr('height', '200%');
    glow.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    glow.append('feMerge')
      .selectAll('feMergeNode')
      .data(['blur', 'SourceGraphic'])
      .join('feMergeNode')
      .attr('in', d => d);

    // Projection
    projection = d3.geoOrthographic()
      .scale(radius)
      .translate([width / 2, height / 2])
      .rotate(rotation)
      .clipAngle(90);

    path = d3.geoPath().projection(projection);

    g = svg.append('g');

    // Atmosphere (outer glow ring)
    g.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', radius + 12)
      .attr('fill', 'url(#atmosphere-gradient)');

    // Second atmosphere layer
    g.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', radius + 6)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(80,160,255,0.08)')
      .attr('stroke-width', 8);

    // Ocean
    globeCircle = g.append('circle')
      .attr('cx', width / 2)
      .attr('cy', height / 2)
      .attr('r', radius)
      .attr('fill', 'url(#ocean-gradient)')
      .attr('stroke', 'rgba(80,160,255,0.12)')
      .attr('stroke-width', 0.5);

    // Graticule
    const graticule = d3.geoGraticule().step([15, 15]);
    g.append('path')
      .datum(graticule)
      .attr('class', 'globe-graticule')
      .attr('d', path);

    // Land & borders placeholder
    g.append('g').attr('id', 'land-group');

    // (Impacts rendered on canvas overlay, not SVG)

    // Setup interactions
    setupDrag();
    setupZoom();
    loadWorld();
    startAutoRotate();
  }

  function loadWorld() {
    const worldUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';
    d3.json(worldUrl).then(world => {
      worldData = world;
      const land = topojson.feature(world, world.objects.land);
      const borders = topojson.mesh(world, world.objects.countries, (a, b) => a !== b);

      const landGroup = g.select('#land-group');
      landGroup.append('path')
        .datum(land)
        .attr('class', 'globe-land')
        .attr('d', path);

      landGroup.append('path')
        .datum(borders)
        .attr('class', 'globe-border')
        .attr('d', path);
    });
  }

  function render() {
    projection.rotate(rotation);

    g.select('.globe-graticule').attr('d', path);
    g.select('.globe-land').attr('d', path);
    g.select('.globe-border').attr('d', path);

    // Notify impacts layer
    onRotateCallbacks.forEach(cb => cb(projection, path));
  }

  function setupDrag() {
    let v0, r0, q0;

    const drag = d3.drag()
      .on('start', function(event) {
        autoRotate = false;
        lastInteraction = Date.now();
        v0 = versor.cartesian(projection.invert([event.x, event.y]));
        r0 = projection.rotate();
        q0 = versor(r0);
      })
      .on('drag', function(event) {
        const v1 = versor.cartesian(projection.rotate(r0).invert([event.x, event.y]));
        const q1 = versor.multiply(q0, versor.delta(v0, v1));
        rotation = versor.rotation(q1);
        render();
      })
      .on('end', function() {
        lastInteraction = Date.now();
        // Resume auto-rotate after 3s of inactivity
        setTimeout(() => {
          if (Date.now() - lastInteraction >= 2900) {
            autoRotate = true;
          }
        }, 3000);
      });

    svg.call(drag);
  }

  function setupZoom() {
    const zoom = d3.zoom()
      .scaleExtent([0.5, 5])
      .on('zoom', function(event) {
        const scale = radius * event.transform.k;
        projection.scale(scale);
        globeCircle.attr('r', scale);
        // Update atmosphere circles
        g.select('circle:first-child').attr('r', scale + 12);
        g.selectAll('circle').filter(function(d, i) { return i === 1; }).attr('r', scale + 6);
        render();
      });

    svg.call(zoom)
      .on('dblclick.zoom', null); // disable double-click zoom
  }

  function startAutoRotate() {
    function tick() {
      if (autoRotate) {
        rotation[0] += autoRotateSpeed;
        render();
      }
      autoRotateTimer = requestAnimationFrame(tick);
    }
    tick();
  }

  function onRotate(callback) {
    onRotateCallbacks.push(callback);
  }

  function getProjection() {
    return projection;
  }

  function getPath() {
    return path;
  }

  function getSvg() {
    return svg;
  }

  function getRadius() {
    return radius;
  }

  function getCenter() {
    return [width / 2, height / 2];
  }

  function getWidth() { return width; }
  function getHeight() { return height; }

  return { init, render, onRotate, getProjection, getPath, getSvg, getRadius, getCenter, getWidth, getHeight };
})();


/* ============================================
   VERSOR — Quaternion rotation helper
   Adapted from https://github.com/d3/versor
   ============================================ */

const versor = (function() {
  function versor(e) {
    const l = e[0] * Math.PI / 180,
          p = e[1] * Math.PI / 180 / 2,
          g = e[2] * Math.PI / 180 / 2,
          sl = Math.sin(l / 2), cl = Math.cos(l / 2),
          sp = Math.sin(p), cp = Math.cos(p),
          sg = Math.sin(g), cg = Math.cos(g);
    return [
      cl * cp * cg + sl * sp * sg,
      sl * cp * cg - cl * sp * sg,
      cl * sp * cg + sl * cp * sg,
      cl * cp * sg - sl * sp * cg
    ];
  }

  versor.cartesian = function(e) {
    const l = e[0] * Math.PI / 180, p = e[1] * Math.PI / 180;
    return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
  };

  versor.rotation = function(q) {
    return [
      Math.atan2(2 * (q[0] * q[1] + q[2] * q[3]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) * 180 / Math.PI,
      Math.asin(Math.max(-1, Math.min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * 180 / Math.PI,
      Math.atan2(2 * (q[0] * q[3] + q[1] * q[2]), 1 - 2 * (q[2] * q[2] + q[3] * q[3])) * 180 / Math.PI
    ];
  };

  versor.delta = function(v0, v1) {
    const w = cross(v0, v1),
          l = Math.sqrt(dot(w, w));
    if (!l) return [1, 0, 0, 0];
    const t = Math.acos(Math.max(-1, Math.min(1, dot(v0, v1)))) / 2,
          s = Math.sin(t) / l;
    return [Math.cos(t), w[2] * s, -w[1] * s, w[0] * s];
  };

  versor.multiply = function(a, b) {
    return [
      a[0]*b[0] - a[1]*b[1] - a[2]*b[2] - a[3]*b[3],
      a[0]*b[1] + a[1]*b[0] + a[2]*b[3] - a[3]*b[2],
      a[0]*b[2] - a[1]*b[3] + a[2]*b[0] + a[3]*b[1],
      a[0]*b[3] + a[1]*b[2] - a[2]*b[1] + a[3]*b[0]
    ];
  };

  function cross(a, b) {
    return [a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2], a[0]*b[1] - a[1]*b[0]];
  }

  function dot(a, b) {
    return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
  }

  return versor;
})();
