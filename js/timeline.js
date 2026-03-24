/* ============================================
   TIMELINE MODULE — Animated timeline with histogram
   ============================================ */

const Timeline = (() => {
  let svg, xScale, histogramData;
  let allData = [];
  let currentYear = 860;
  let minYear = 860;
  let maxYear = 2013;
  let isPlaying = false;
  let playSpeed = 1;
  let playTimer = null;
  let width, height;
  let handle, progressBar;
  let brush;
  let brushRange = null;
  const margin = { top: 2, right: 10, bottom: 20, left: 10 };
  const barHeight = 40;

  function init(data) {
    allData = data;

    // Compute histogram bins by decade
    const decades = d3.range(800, 2020, 10);
    histogramData = decades.map(decade => ({
      decade,
      count: data.filter(d => d.year >= decade && d.year < decade + 10).length
    }));

    const wrapper = document.getElementById('timeline-svg-wrapper');
    width = wrapper.clientWidth - margin.left - margin.right;
    height = barHeight + margin.top + margin.bottom;

    svg = d3.select('#timeline-svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    xScale = d3.scaleLinear()
      .domain([minYear, maxYear])
      .range([0, width])
      .clamp(true);

    const yMax = d3.max(histogramData, d => d.count);
    const yScale = d3.scaleLinear()
      .domain([0, yMax])
      .range([barHeight, 0]);

    // Background track
    svg.append('rect')
      .attr('class', 'timeline-bar-bg')
      .attr('x', 0).attr('y', 0)
      .attr('width', width)
      .attr('height', barHeight);

    // Histogram bars
    const barW = Math.max(1, width / histogramData.length - 0.5);
    svg.selectAll('.timeline-histogram-bar')
      .data(histogramData)
      .join('rect')
      .attr('class', 'timeline-histogram-bar')
      .attr('x', d => xScale(d.decade))
      .attr('y', d => yScale(d.count))
      .attr('width', barW)
      .attr('height', d => barHeight - yScale(d.count));

    // Progress fill
    progressBar = svg.append('rect')
      .attr('class', 'timeline-bar')
      .attr('x', 0).attr('y', 0)
      .attr('width', xScale(currentYear))
      .attr('height', barHeight);

    // Brush for range selection
    brush = d3.brushX()
      .extent([[0, 0], [width, barHeight]])
      .on('brush', onBrush)
      .on('end', onBrushEnd);

    svg.append('g')
      .attr('class', 'timeline-brush')
      .call(brush);

    // Handle (draggable circle)
    handle = svg.append('circle')
      .attr('class', 'timeline-handle')
      .attr('cx', xScale(currentYear))
      .attr('cy', barHeight / 2)
      .attr('r', 7)
      .call(d3.drag()
        .on('start', () => { pause(); })
        .on('drag', onHandleDrag)
      );

    // Tick labels
    const ticks = d3.range(1000, 2100, 200);
    svg.selectAll('.timeline-tick-label')
      .data(ticks)
      .join('text')
      .attr('class', 'timeline-tick-label')
      .attr('x', d => xScale(d))
      .attr('y', barHeight + 14)
      .attr('text-anchor', 'middle')
      .text(d => d);

    // Setup controls
    setupControls();
    updateYearDisplay();
  }

  function setupControls() {
    document.getElementById('play-btn').addEventListener('click', togglePlay);

    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        playSpeed = parseInt(this.dataset.speed);
      });
    });
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }

  function play() {
    isPlaying = true;
    document.getElementById('play-icon').style.display = 'none';
    document.getElementById('pause-icon').style.display = 'block';

    if (currentYear >= maxYear) {
      currentYear = minYear;
    }

    let lastTime = performance.now();

    function tick(now) {
      if (!isPlaying) return;

      const dt = now - lastTime;
      lastTime = now;

      // Years per second based on speed
      const yearsPerSec = playSpeed * 30;
      const advance = (dt / 1000) * yearsPerSec;

      const prevYear = Math.floor(currentYear);
      currentYear = Math.min(currentYear + advance, maxYear);
      const newYear = Math.floor(currentYear);

      // Animate new impacts
      if (newYear > prevYear) {
        const newImpacts = allData.filter(d =>
          d.year > prevYear && d.year <= newYear
        );
        if (newImpacts.length > 0 && newImpacts.length < 200) {
          Impacts.animateNewImpacts(newImpacts);
        }
      }

      updateTimeline();
      Impacts.setMaxYear(Math.floor(currentYear));

      if (currentYear >= maxYear) {
        pause();
        return;
      }

      playTimer = requestAnimationFrame(tick);
    }

    playTimer = requestAnimationFrame(tick);
  }

  function pause() {
    isPlaying = false;
    document.getElementById('play-icon').style.display = 'block';
    document.getElementById('pause-icon').style.display = 'none';
    if (playTimer) {
      cancelAnimationFrame(playTimer);
      playTimer = null;
    }
  }

  function onHandleDrag(event) {
    const year = Math.round(xScale.invert(Math.max(0, Math.min(width, event.x))));
    currentYear = Math.max(minYear, Math.min(maxYear, year));
    updateTimeline();
    Impacts.setMaxYear(Math.floor(currentYear));
  }

  function onBrush(event) {
    if (!event.selection) return;
    const [x0, x1] = event.selection;
    const y0 = Math.round(xScale.invert(x0));
    const y1 = Math.round(xScale.invert(x1));
    brushRange = [y0, y1];

    // Highlight active histogram bars
    svg.selectAll('.timeline-histogram-bar')
      .classed('active', d => d.decade >= y0 && d.decade <= y1);
  }

  function onBrushEnd(event) {
    if (!event.selection) {
      brushRange = null;
      svg.selectAll('.timeline-histogram-bar').classed('active', false);
      // Reset to show all within current year
      Filters.applyFilters();
      return;
    }
    Filters.applyFilters();
  }

  function updateTimeline() {
    const x = xScale(currentYear);
    handle.attr('cx', x);
    progressBar.attr('width', x);
    updateYearDisplay();

    // Highlight histogram bars up to current year
    if (!brushRange) {
      svg.selectAll('.timeline-histogram-bar')
        .classed('active', d => d.decade <= currentYear);
    }
  }

  function updateYearDisplay() {
    document.getElementById('current-year-display').textContent = Math.floor(currentYear);
  }

  function setYear(year) {
    currentYear = year;
    updateTimeline();
    Impacts.setMaxYear(Math.floor(currentYear));
  }

  function getBrushRange() {
    return brushRange;
  }

  function getCurrentYear() {
    return Math.floor(currentYear);
  }

  return { init, play, pause, setYear, getBrushRange, getCurrentYear };
})();
