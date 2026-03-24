/* ============================================
   IMPACTS MODULE — Meteorite rendering & animations
   ============================================ */

const Impacts = (() => {
  let allData = [];
  let filteredData = [];
  let visibleData = [];
  let impactsLayer;
  let projection, path;
  let currentMaxYear = 2013;
  let massScale, colorScale;

  // Color palette for mass categories
  const MASS_COLORS = {
    tiny:    '#4fc3f7',  // light blue — < 100g
    small:   '#29b6f6',  // blue — 100g-1kg
    medium:  '#ffb74d',  // orange — 1kg-100kg
    large:   '#ff7043',  // red-orange — 100kg-10t
    massive: '#ef5350',  // red — > 10t
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

  function init(data) {
    allData = data;
    filteredData = data;
    impactsLayer = d3.select('#impacts-layer');
    projection = Globe.getProjection();
    path = Globe.getPath();

    // Mass → radius scale (sqrt for area perception)
    massScale = d3.scaleSqrt()
      .domain([0, 100, 1000, 100000, 10000000, 60000000])
      .range([1.5, 2.5, 4, 7, 12, 20])
      .clamp(true);

    // Listen for globe rotation
    Globe.onRotate((proj, p) => {
      projection = proj;
      path = p;
      updatePositions();
    });
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
    renderImpacts();
    updateStats();
  }

  function renderImpacts() {
    const impacts = impactsLayer.selectAll('.impact')
      .data(visibleData, d => d.id);

    // EXIT
    impacts.exit()
      .transition().duration(300)
      .attr('r', 0)
      .attr('opacity', 0)
      .remove();

    // ENTER
    const enter = impacts.enter()
      .append('circle')
      .attr('class', 'impact')
      .attr('r', 0)
      .attr('opacity', 0)
      .attr('fill', d => getColor(d.mass))
      .attr('stroke', d => getColor(d.mass))
      .attr('stroke-width', 0.5)
      .attr('stroke-opacity', 0.6)
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('r', massScale(d.mass) * 1.8)
          .attr('opacity', 1)
          .attr('stroke-width', 2);
        Tooltip.show(event, d);
      })
      .on('mousemove', function(event) {
        Tooltip.move(event);
      })
      .on('mouseleave', function(event, d) {
        const visible = isVisible(d);
        d3.select(this)
          .transition().duration(200)
          .attr('r', visible ? massScale(d.mass) : 0)
          .attr('opacity', visible ? getOpacity(d) : 0)
          .attr('stroke-width', 0.5);
        Tooltip.hide();
      });

    // Merge enter + update
    const merged = enter.merge(impacts);

    merged
      .transition().duration(400)
      .attr('cx', d => {
        const coords = projection([d.lng, d.lat]);
        return coords ? coords[0] : -999;
      })
      .attr('cy', d => {
        const coords = projection([d.lng, d.lat]);
        return coords ? coords[1] : -999;
      })
      .attr('r', d => isVisible(d) ? massScale(d.mass) : 0)
      .attr('opacity', d => isVisible(d) ? getOpacity(d) : 0)
      .attr('fill', d => getColor(d.mass));
  }

  function updatePositions() {
    impactsLayer.selectAll('.impact')
      .attr('cx', d => {
        const coords = projection([d.lng, d.lat]);
        return coords ? coords[0] : -999;
      })
      .attr('cy', d => {
        const coords = projection([d.lng, d.lat]);
        return coords ? coords[1] : -999;
      })
      .attr('r', d => isVisible(d) ? massScale(d.mass) : 0)
      .attr('opacity', d => isVisible(d) ? getOpacity(d) : 0);
  }

  function isVisible(d) {
    const coords = [d.lng, d.lat];
    const dist = d3.geoDistance(coords, projection.invert(Globe.getCenter()));
    return dist < Math.PI / 2;
  }

  function getOpacity(d) {
    // Slightly transparent for smaller, more opaque for larger
    const base = d.mass < 100 ? 0.4 : d.mass < 1000 ? 0.55 : d.mass < 100000 ? 0.7 : 0.85;
    return base;
  }

  // Animate impact "landing" effect
  function animateNewImpacts(newData) {
    const svg = Globe.getSvg();
    const ringLayer = svg.select('#impacts-layer');

    newData.forEach(d => {
      if (!isVisible(d)) return;
      const coords = projection([d.lng, d.lat]);
      if (!coords) return;

      const color = getColor(d.mass);
      const maxR = massScale(d.mass) * 4;

      // Expanding ring 1
      ringLayer.append('circle')
        .attr('class', 'impact-ring')
        .attr('cx', coords[0])
        .attr('cy', coords[1])
        .attr('r', massScale(d.mass))
        .attr('stroke', color)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8)
        .transition().duration(800).ease(d3.easeQuadOut)
        .attr('r', maxR)
        .attr('stroke-width', 0.5)
        .attr('stroke-opacity', 0)
        .remove();

      // Expanding ring 2 (delayed)
      ringLayer.append('circle')
        .attr('class', 'impact-ring')
        .attr('cx', coords[0])
        .attr('cy', coords[1])
        .attr('r', massScale(d.mass))
        .attr('stroke', color)
        .attr('stroke-width', 1.5)
        .attr('stroke-opacity', 0)
        .transition().delay(200).duration(600).ease(d3.easeQuadOut)
        .attr('stroke-opacity', 0.5)
        .transition().duration(500)
        .attr('r', maxR * 0.7)
        .attr('stroke-opacity', 0)
        .remove();
    });
  }

  function updateStats() {
    const count = visibleData.length;
    const largest = visibleData.length > 0
      ? visibleData.reduce((max, d) => d.mass > max.mass ? d : max, visibleData[0])
      : null;

    document.getElementById('stat-count').textContent = count.toLocaleString();
    document.getElementById('stat-largest').textContent = largest
      ? (largest.mass / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })
      : '—';

    if (visibleData.length > 0) {
      const minY = visibleData[0].year;
      const maxY = visibleData[visibleData.length - 1].year;
      document.getElementById('stat-year').textContent = `${minY}–${maxY}`;
    }
  }

  function getMassScale() { return massScale; }
  function getMassColors() { return MASS_COLORS; }
  function getVisibleData() { return visibleData; }

  return {
    init, setMaxYear, setFilteredData, updateVisible,
    animateNewImpacts, getMassScale, getMassColors,
    getVisibleData, getColor, renderImpacts
  };
})();
