/* ============================================
   TOOLTIP MODULE
   ============================================ */

const Tooltip = (() => {
  const el = document.getElementById('tooltip');

  function show(event, data) {
    const massStr = data.mass >= 1000
      ? `${(data.mass / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
      : `${data.mass.toLocaleString()} g`;

    el.innerHTML = `
      <div class="tooltip-name">${data.name}</div>
      <div class="tooltip-row">
        <span class="tooltip-label">Year</span>
        <span class="tooltip-value accent">${data.year}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Mass</span>
        <span class="tooltip-value">${massStr}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Class</span>
        <span class="tooltip-value">${data.recclass}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Type</span>
        <span class="tooltip-value">${data.group}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Status</span>
        <span class="tooltip-value">${data.fall}</span>
      </div>
      <div class="tooltip-row">
        <span class="tooltip-label">Location</span>
        <span class="tooltip-value">${data.lat.toFixed(2)}°, ${data.lng.toFixed(2)}°</span>
      </div>
    `;

    el.classList.remove('hidden');
    positionTooltip(event);
  }

  function positionTooltip(event) {
    const pad = 16;
    const rect = el.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY - pad;

    if (x + rect.width > window.innerWidth - pad) {
      x = event.clientX - rect.width - pad;
    }
    if (y < pad) {
      y = event.clientY + pad;
    }
    if (y + rect.height > window.innerHeight - pad) {
      y = window.innerHeight - rect.height - pad;
    }

    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  function move(event) {
    if (!el.classList.contains('hidden')) {
      positionTooltip(event);
    }
  }

  function hide() {
    el.classList.add('hidden');
  }

  return { show, move, hide };
})();
