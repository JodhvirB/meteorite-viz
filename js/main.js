/* ============================================
   MAIN — App initialization & orchestration
   ============================================ */

(async function() {
  try {
    // Load data
    const data = await d3.csv('data/meteorites.csv', d => ({
      name: d.name,
      mass: +d.mass || 0,
      year: +d.year,
      lat: +d.lat,
      lng: +d.lng,
      recclass: d.recclass,
      group: d.group,
      fall: d.fall,
      id: d.id
    }));

    console.log(`Loaded ${data.length} meteorites`);

    // Initialize modules in order
    Globe.init();
    Impacts.init(data);
    Timeline.init(data);
    Filters.init(data);

    // Set initial state — show all meteorites
    Impacts.setMaxYear(2013);

    // Set timeline to the end initially
    Timeline.setYear(2013);

    console.log('Meteorite Impacts visualization initialized!');

  } catch (err) {
    console.error('Failed to initialize:', err);
    document.getElementById('globe-container').innerHTML = `
      <div style="text-align:center;color:#ff6b35;padding:40px;">
        <h2>Failed to load data</h2>
        <p style="color:#8888aa;margin-top:8px;">Please ensure you're running from a local server (not file://)</p>
        <p style="color:#555577;margin-top:4px;font-size:12px;">${err.message}</p>
      </div>
    `;
  }
})();
