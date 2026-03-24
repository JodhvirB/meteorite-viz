/* ============================================
   FILTERS MODULE — Classification & mass filters
   ============================================ */

const Filters = (() => {
  let allData = [];
  let activeGroups = new Set(['Stony', 'Iron', 'Stony-Iron', 'Unknown']);
  let massRange = [0, Infinity];
  let fallFilter = 'all'; // 'all', 'Fell', 'Found'

  const GROUP_COLORS = {
    'Stony':       '#29b6f6',
    'Iron':        '#ff7043',
    'Stony-Iron':  '#ffb74d',
    'Unknown':     '#888899'
  };

  const MASS_PRESETS = [
    { label: 'All sizes', min: 0, max: Infinity },
    { label: '< 100g (tiny)', min: 0, max: 100 },
    { label: '100g – 1kg', min: 100, max: 1000 },
    { label: '1kg – 100kg', min: 1000, max: 100000 },
    { label: '100kg – 10t', min: 100000, max: 10000000 },
    { label: '> 10 tonnes', min: 10000000, max: Infinity },
  ];

  function init(data) {
    allData = data;
    buildFilterPanel();
    buildLegend();
  }

  function buildFilterPanel() {
    const container = document.getElementById('filter-controls');
    container.innerHTML = '';

    // Classification filters
    const classGroup = document.createElement('div');
    classGroup.className = 'filter-group';
    classGroup.innerHTML = '<div class="filter-label">Classification</div>';

    Object.entries(GROUP_COLORS).forEach(([group, color]) => {
      const count = allData.filter(d => d.group === group).length;
      const btn = document.createElement('button');
      btn.className = 'filter-btn active';
      btn.dataset.group = group;
      btn.innerHTML = `<span class="filter-dot" style="background:${color}"></span>${group} <span style="color:var(--text-muted);font-size:10px">(${count.toLocaleString()})</span>`;
      btn.addEventListener('click', () => toggleGroup(group, btn));
      classGroup.appendChild(btn);
    });
    container.appendChild(classGroup);

    // Mass filter
    const massGroup = document.createElement('div');
    massGroup.className = 'filter-group';
    massGroup.innerHTML = '<div class="filter-label">Mass Range</div>';

    MASS_PRESETS.forEach((preset, i) => {
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (i === 0 ? ' active' : '');
      btn.dataset.massIdx = i;
      btn.textContent = preset.label;
      btn.addEventListener('click', () => selectMassPreset(i, btn));
      massGroup.appendChild(btn);
    });
    container.appendChild(massGroup);

    // Fall/Found filter
    const fallGroup = document.createElement('div');
    fallGroup.className = 'filter-group';
    fallGroup.innerHTML = '<div class="filter-label">Observation</div>';

    ['all', 'Fell', 'Found'].forEach(type => {
      const label = type === 'all' ? 'All' : type;
      const count = type === 'all' ? allData.length : allData.filter(d => d.fall === type).length;
      const btn = document.createElement('button');
      btn.className = 'filter-btn' + (type === 'all' ? ' active' : '');
      btn.dataset.fall = type;
      btn.textContent = `${label} (${count.toLocaleString()})`;
      btn.addEventListener('click', () => selectFall(type, btn));
      fallGroup.appendChild(btn);
    });
    container.appendChild(fallGroup);

    // Reset button
    document.getElementById('reset-filters').addEventListener('click', resetAll);
  }

  function buildLegend() {
    // Mass legend
    const massLegend = document.getElementById('mass-legend');
    const massCategories = [
      { label: '< 100g', size: 3, color: '#4fc3f7' },
      { label: '100g – 1kg', size: 5, color: '#29b6f6' },
      { label: '1kg – 100kg', size: 8, color: '#ffb74d' },
      { label: '100kg – 10t', size: 14, color: '#ff7043' },
      { label: '> 10 tonnes', size: 22, color: '#ef5350' },
    ];

    massLegend.innerHTML = '';
    massCategories.forEach(cat => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-circle" style="width:${cat.size}px;height:${cat.size}px;background:${cat.color}"></span>
        <span>${cat.label}</span>
      `;
      massLegend.appendChild(item);
    });

    // Classification legend
    const classLegend = document.getElementById('class-legend');
    classLegend.innerHTML = '';
    Object.entries(GROUP_COLORS).forEach(([group, color]) => {
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-circle" style="width:8px;height:8px;background:${color}"></span>
        <span>${group}</span>
      `;
      classLegend.appendChild(item);
    });
  }

  function toggleGroup(group, btn) {
    if (activeGroups.has(group)) {
      if (activeGroups.size <= 1) return; // Keep at least one
      activeGroups.delete(group);
      btn.classList.remove('active');
    } else {
      activeGroups.add(group);
      btn.classList.add('active');
    }
    applyFilters();
  }

  function selectMassPreset(idx, btn) {
    document.querySelectorAll('[data-mass-idx]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    massRange = [MASS_PRESETS[idx].min, MASS_PRESETS[idx].max];
    applyFilters();
  }

  function selectFall(type, btn) {
    document.querySelectorAll('[data-fall]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fallFilter = type;
    applyFilters();
  }

  function applyFilters() {
    let filtered = allData.filter(d => {
      if (!activeGroups.has(d.group)) return false;
      if (d.mass < massRange[0] || d.mass >= massRange[1]) return false;
      if (fallFilter !== 'all' && d.fall !== fallFilter) return false;
      return true;
    });

    // Apply brush range if active
    const brushRange = Timeline.getBrushRange();
    if (brushRange) {
      filtered = filtered.filter(d => d.year >= brushRange[0] && d.year <= brushRange[1]);
    }

    Impacts.setFilteredData(filtered);
  }

  function resetAll() {
    activeGroups = new Set(['Stony', 'Iron', 'Stony-Iron', 'Unknown']);
    massRange = [0, Infinity];
    fallFilter = 'all';

    document.querySelectorAll('.filter-btn[data-group]').forEach(b => b.classList.add('active'));
    document.querySelectorAll('[data-mass-idx]').forEach((b, i) => {
      b.classList.toggle('active', i === 0);
    });
    document.querySelectorAll('[data-fall]').forEach(b => {
      b.classList.toggle('active', b.dataset.fall === 'all');
    });

    applyFilters();
  }

  return { init, applyFilters };
})();
