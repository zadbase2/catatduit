/**
 * CatatDuit - High-Precision SVG Chart Engine
 * Clean, Non-Overlapping, Zero-AI-Slop Visualizations
 * 1. Donut Chart (Proportional Expenses by Category)
 * 2. Grouped Bar Chart (Daily Income vs Expense with unified tooltip)
 * 3. Area Trend Chart (Daily Spending Curve with crosshair & benchmark lines)
 */

const ChartEngine = {
  // Refined, high-end fintech color palette (Linear / Revolut inspired)
  PALETTE: [
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#F59E0B', // Amber
    '#EC4899', // Pink
    '#8B5CF6', // Purple
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#64748B'  // Slate
  ],

  formatIDR(num) {
    if (num === null || num === undefined || isNaN(num)) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  },

  formatCompactIDR(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'jt';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'k';
    return num.toString();
  },

  // Escape HTML to prevent injection
  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  },

  /**
   * 1. DONUT CHART (Category Expense Distribution)
   * Guaranteed: NO center text clipping, NO overlapping labels, sleek ring
   */
  renderDonutChart(containerId, data = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-title">Belum ada pengeluaran</p>
          <span class="empty-desc">Catat transaksi di tab Chat untuk melihat proporsi kategori.</span>
        </div>
      `;
      return;
    }

    const total = data.reduce((acc, cur) => acc + Number(cur.total || 0), 0);
    if (total === 0) {
      container.innerHTML = `
        <div class="chart-empty-state">
          <p class="empty-title">Total Pengeluaran Rp 0</p>
          <span class="empty-desc">Tidak ada data untuk periode filter ini.</span>
        </div>
      `;
      return;
    }

    const size = 200;
    const strokeWidth = 24;
    const center = size / 2;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedAngle = 0;
    const slices = data.map((item, index) => {
      const percentage = (item.total / total) * 100;
      const strokeDasharray = `${(circumference * percentage) / 100} ${circumference}`;
      const strokeDashoffset = -((circumference * accumulatedAngle) / 100);
      accumulatedAngle += percentage;

      const color = this.PALETTE[index % this.PALETTE.length];
      return {
        ...item,
        color,
        percentage: percentage.toFixed(1),
        strokeDasharray,
        strokeDashoffset
      };
    });

    const svgSlices = slices.map((s, idx) => `
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius}"
        fill="transparent"
        stroke="${s.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${s.strokeDasharray}"
        stroke-dashoffset="${s.strokeDashoffset}"
        class="donut-segment"
        data-index="${idx}"
        data-category="${this.escapeHtml(s.name)}"
        data-amount="${this.formatIDR(s.total)}"
        data-percent="${s.percentage}%"
        style="transition: opacity 0.2s ease, stroke-width 0.2s ease; cursor: pointer;"
      />
    `).join('');

    const legendItems = slices.map((s, idx) => `
      <div class="chart-legend-row" data-index="${idx}">
        <div class="legend-indicator-dot" style="background-color: ${s.color};"></div>
        <span class="legend-emoji-icon">${s.icon || '🏷️'}</span>
        <div class="legend-title-box">
          <span class="legend-cat-title" title="${this.escapeHtml(s.name)}">${this.escapeHtml(s.name)}</span>
          <span class="legend-cat-amount">${this.formatIDR(s.total)}</span>
        </div>
        <span class="legend-pill-percent">${s.percentage}%</span>
      </div>
    `).join('');

    // Font size scaling for center text to prevent overflow
    const totalStr = this.formatIDR(total);
    const centerValFontSize = totalStr.length > 14 ? '12px' : totalStr.length > 11 ? '13px' : '15px';

    container.innerHTML = `
      <div class="donut-chart-layout" style="display: flex; flex-direction: column; align-items: center; width: 100%; gap: 16px;">
        <div class="donut-visual-container" style="position: relative; width: ${size}px; height: ${size}px; min-width: ${size}px; min-height: ${size}px; margin: 0 auto; flex-shrink: 0; display: block;">
          <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="donut-svg-graphic" style="width: ${size}px; height: ${size}px; display: block; overflow: visible;">
            <g transform="rotate(-90 ${center} ${center})">
              ${svgSlices}
            </g>
            <text x="${center}" y="${center - 9}" text-anchor="middle" dominant-baseline="middle" id="donutCoreLabel" style="font-size: 10.5px; font-weight: 700; fill: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px;">TOTAL KELUAR</text>
            <text x="${center}" y="${center + 13}" text-anchor="middle" dominant-baseline="middle" id="donutCoreVal" style="font-size: ${centerValFontSize}; font-weight: 800; fill: var(--text-heading); font-family: var(--font-sans);">${totalStr}</text>
          </svg>
        </div>
        <div class="chart-legend-scrollpane" style="width: 100%; max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          ${legendItems}
        </div>
      </div>
    `;

    // Interactive Hover without layout clipping
    const segments = container.querySelectorAll('.donut-segment');
    const legendRows = container.querySelectorAll('.chart-legend-row');
    const coreLabel = container.querySelector('#donutCoreLabel');
    const coreVal = container.querySelector('#donutCoreVal');

    const setActive = (idx) => {
      segments.forEach((seg, i) => {
        if (i === idx) {
          seg.style.opacity = '1';
          seg.setAttribute('stroke-width', strokeWidth + 4);
          const cat = seg.getAttribute('data-category');
          const amt = seg.getAttribute('data-amount');
          const pct = seg.getAttribute('data-percent');
          if (coreLabel) coreLabel.textContent = cat;
          if (coreVal) {
            coreVal.textContent = `${amt} (${pct})`;
            coreVal.style.fontSize = amt.length > 12 ? '11.5px' : '13.5px';
          }
        } else {
          seg.style.opacity = '0.35';
          seg.setAttribute('stroke-width', strokeWidth);
        }
      });
      legendRows.forEach((row, i) => {
        row.classList.toggle('active', i === idx);
      });
    };

    const resetActive = () => {
      segments.forEach(seg => {
        seg.style.opacity = '1';
        seg.setAttribute('stroke-width', strokeWidth);
      });
      legendRows.forEach(row => row.classList.remove('active'));
      if (coreLabel) coreLabel.textContent = 'TOTAL KELUAR';
      if (coreVal) {
        coreVal.textContent = totalStr;
        coreVal.style.fontSize = centerValFontSize;
      }
    };

    segments.forEach(seg => {
      seg.addEventListener('mouseenter', () => setActive(Number(seg.getAttribute('data-index'))));
      seg.addEventListener('mouseleave', resetActive);
    });

    legendRows.forEach(row => {
      row.addEventListener('mouseenter', () => setActive(Number(row.getAttribute('data-index'))));
      row.addEventListener('mouseleave', resetActive);
    });
  },

  /**
   * 2. GROUPED BAR CHART (Daily Income vs Expense)
   * Built 100% in SVG with clean baseline, Y-axis benchmarks, and unified popover tooltip!
   * NO overlapping HTML tooltips, NO squashed bars.
   */
  renderBarChart(containerId, transactions = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = 7;
    const buckets = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' });
      buckets.push({
        dateStr,
        label: dayName,
        income: 0,
        expense: 0
      });
    }

    transactions.forEach(t => {
      const b = buckets.find(item => item.dateStr === t.transaction_date);
      if (b) {
        if (t.type === 'income') b.income += Number(t.amount || 0);
        else b.expense += Number(t.amount || 0);
      }
    });

    let maxVal = Math.max(...buckets.map(b => Math.max(b.income, b.expense)), 0);
    if (maxVal === 0) maxVal = 100000;

    // SVG Canvas Dimensions
    const svgW = 540;
    const svgH = 200;
    const padLeft = 55;
    const padRight = 15;
    const padTop = 20;
    const padBottom = 30;
    const chartW = svgW - padLeft - padRight;
    const chartH = svgH - padTop - padBottom;

    // Gridlines (3 levels: 0, 50%, 100%)
    const yGridVals = [0, maxVal * 0.5, maxVal];
    const gridLinesHtml = yGridVals.map(val => {
      const y = padTop + chartH - (val / maxVal) * chartH;
      return `
        <line x1="${padLeft}" y1="${y}" x2="${svgW - padRight}" y2="${y}" stroke="var(--border-card)" stroke-dasharray="3 3" stroke-width="1" />
        <text x="${padLeft - 8}" y="${y + 3}" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="end">${this.formatCompactIDR(val)}</text>
      `;
    }).join('');

    // Day Columns and Bars
    const colW = chartW / days;
    const barW = Math.min(14, colW * 0.32);
    const gap = 3;

    let barsSvg = '';
    buckets.forEach((b, idx) => {
      const colCenterX = padLeft + (idx + 0.5) * colW;
      const incH = Math.max(2, (b.income / maxVal) * chartH);
      const expH = Math.max(2, (b.expense / maxVal) * chartH);

      const incX = colCenterX - barW - (gap / 2);
      const expX = colCenterX + (gap / 2);
      const incY = padTop + chartH - incH;
      const expY = padTop + chartH - expH;

      barsSvg += `
        <!-- Interactive Hover Zone for Day -->
        <g class="bar-day-group" data-idx="${idx}" data-date="${b.label}" data-inc="${this.formatIDR(b.income)}" data-exp="${this.formatIDR(b.expense)}">
          <rect x="${padLeft + idx * colW}" y="${padTop}" width="${colW}" height="${chartH}" fill="transparent" class="bar-col-hover-track" />
          
          <!-- Income Bar -->
          <rect x="${incX}" y="${incY}" width="${barW}" height="${incH}" rx="3" ry="3" fill="#10B981" class="chart-bar-rect" />
          
          <!-- Expense Bar -->
          <rect x="${expX}" y="${expY}" width="${barW}" height="${expH}" rx="3" ry="3" fill="#F43F5E" class="chart-bar-rect" />
          
          <!-- X Axis Label -->
          <text x="${colCenterX}" y="${svgH - 10}" fill="var(--text-muted)" font-size="11" text-anchor="middle" font-family="var(--font-sans)">${b.label}</text>
        </g>
      `;
    });

    container.innerHTML = `
      <div class="svg-chart-wrapper">
        <div class="bar-chart-topbar">
          <div class="chart-legend-chips">
            <span class="chip-legend"><span class="chip-dot" style="background:#10B981;"></span> Pemasukan</span>
            <span class="chip-legend"><span class="chip-dot" style="background:#F43F5E;"></span> Pengeluaran</span>
          </div>
          <div class="bar-dynamic-tooltip" id="barDynamicTooltip">
            <span class="tt-hint">Arahkan kursor atau sentuh kolom untuk detail</span>
          </div>
        </div>
        <div class="svg-responsive-container">
          <svg viewBox="0 0 ${svgW} ${svgH}" class="chart-svg-root" preserveAspectRatio="xMidYMid meet">
            ${gridLinesHtml}
            ${barsSvg}
          </svg>
        </div>
      </div>
    `;

    // Tooltip Interaction without element collision
    const dayGroups = container.querySelectorAll('.bar-day-group');
    const tooltipEl = container.querySelector('#barDynamicTooltip');

    dayGroups.forEach(grp => {
      grp.addEventListener('mouseenter', () => {
        const date = grp.getAttribute('data-date');
        const inc = grp.getAttribute('data-inc');
        const exp = grp.getAttribute('data-exp');
        grp.querySelector('.bar-col-hover-track').setAttribute('fill', 'rgba(128, 128, 128, 0.08)');
        if (tooltipEl) {
          tooltipEl.innerHTML = `<strong>${date}</strong>: <span style="color:#10B981; font-weight:600;">+${inc}</span> / <span style="color:#F43F5E; font-weight:600;">-${exp}</span>`;
        }
      });
      grp.addEventListener('mouseleave', () => {
        grp.querySelector('.bar-col-hover-track').setAttribute('fill', 'transparent');
        if (tooltipEl) {
          tooltipEl.innerHTML = `<span class="tt-hint">Arahkan kursor atau sentuh kolom untuk detail</span>`;
        }
      });
    });
  },

  /**
   * 3. AREA TREND CHART (14 Days Spending Curve)
   * Smooth Bezier splines, subtle gradient fill, crosshair indicator
   * NO distorted ellipses, NO overlapping text
   */
  renderTrendChart(containerId, transactions = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const days = 14;
    const points = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      points.push({
        dateStr,
        label: dayLabel,
        amount: 0
      });
    }

    transactions.filter(t => t.type === 'expense').forEach(t => {
      const pt = points.find(p => p.dateStr === t.transaction_date);
      if (pt) pt.amount += Number(t.amount || 0);
    });

    let maxVal = Math.max(...points.map(p => p.amount), 50000);

    const width = 600;
    const height = 190;
    const padLeft = 55;
    const padRight = 20;
    const padTop = 20;
    const padBottom = 30;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;

    // Y Gridlines
    const yGridVals = [0, maxVal * 0.5, maxVal];
    const gridLinesHtml = yGridVals.map(val => {
      const y = padTop + chartH - (val / maxVal) * chartH;
      return `
        <line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border-card)" stroke-dasharray="3 3" stroke-width="1" />
        <text x="${padLeft - 8}" y="${y + 3}" fill="var(--text-muted)" font-size="10" font-family="var(--font-mono)" text-anchor="end">${this.formatCompactIDR(val)}</text>
      `;
    }).join('');

    // Coordinates calculation
    const coords = points.map((p, i) => {
      const x = padLeft + (i / (points.length - 1)) * chartW;
      const y = padTop + chartH - (p.amount / maxVal) * chartH;
      return { x, y, ...p };
    });

    // Catmull-Rom or Monotone Cubic Spline
    let pathD = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 1; i < coords.length; i++) {
      const prev = coords[i - 1];
      const cur = coords[i];
      const cx1 = prev.x + (cur.x - prev.x) / 2;
      const cy1 = prev.y;
      const cx2 = prev.x + (cur.x - prev.x) / 2;
      const cy2 = cur.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${cur.x} ${cur.y}`;
    }

    const areaD = `${pathD} L ${coords[coords.length - 1].x} ${padTop + chartH} L ${coords[0].x} ${padTop + chartH} Z`;

    // Clean dots
    const dotsHtml = coords.map((c, idx) => `
      <g class="trend-pt-group" data-idx="${idx}" data-date="${c.label}" data-val="${this.formatIDR(c.amount)}">
        <circle cx="${c.x}" cy="${c.y}" r="3.5" fill="#3B82F6" stroke="var(--bg-card)" stroke-width="2" class="trend-dot-circle" />
        <rect x="${c.x - (chartW / days / 2)}" y="${padTop}" width="${chartW / days}" height="${chartH}" fill="transparent" class="trend-hover-hitbox" />
      </g>
    `).join('');

    // X Axis key labels (start, middle, end) to prevent overlapping
    const xLabelsHtml = `
      <text x="${coords[0].x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="start" font-family="var(--font-sans)">${coords[0].label}</text>
      <text x="${coords[Math.floor(coords.length / 2)].x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="middle" font-family="var(--font-sans)">${coords[Math.floor(coords.length / 2)].label}</text>
      <text x="${coords[coords.length - 1].x}" y="${height - 8}" fill="var(--text-muted)" font-size="10" text-anchor="end" font-family="var(--font-sans)">${coords[coords.length - 1].label}</text>
    `;

    container.innerHTML = `
      <div class="svg-chart-wrapper">
        <div class="trend-chart-topbar">
          <span class="trend-top-title">Fluktuasi Harian Pengeluaran</span>
          <div class="trend-dynamic-indicator" id="trendHoverIndicator">
            <span class="tt-hint">Sorot titik untuk melihat nominal</span>
          </div>
        </div>
        <div class="svg-responsive-container">
          <svg viewBox="0 0 ${width} ${height}" class="chart-svg-root" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.28"/>
                <stop offset="100%" stop-color="#3B82F6" stop-opacity="0.0"/>
              </linearGradient>
            </defs>
            ${gridLinesHtml}
            <path d="${areaD}" fill="url(#trendAreaGradient)" />
            <path d="${pathD}" fill="none" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            <line id="trendCrosshairLine" x1="0" y1="${padTop}" x2="0" y2="${padTop + chartH}" stroke="var(--primary)" stroke-width="1.5" stroke-dasharray="2 2" style="display:none;" />
            ${dotsHtml}
            ${xLabelsHtml}
          </svg>
        </div>
      </div>
    `;

    // Interactive Hover Indicator
    const ptGroups = container.querySelectorAll('.trend-pt-group');
    const hoverIndicator = container.querySelector('#trendHoverIndicator');
    const crosshair = container.querySelector('#trendCrosshairLine');

    ptGroups.forEach(grp => {
      grp.addEventListener('mouseenter', () => {
        const date = grp.getAttribute('data-date');
        const val = grp.getAttribute('data-val');
        const dot = grp.querySelector('.trend-dot-circle');
        if (dot) dot.setAttribute('r', '6');

        const idx = Number(grp.getAttribute('data-idx'));
        if (crosshair && coords[idx]) {
          crosshair.setAttribute('x1', coords[idx].x);
          crosshair.setAttribute('x2', coords[idx].x);
          crosshair.style.display = 'block';
        }

        if (hoverIndicator) {
          hoverIndicator.innerHTML = `<strong>${date}</strong>: <span style="color:var(--expense); font-weight:700;">${val}</span>`;
        }
      });

      grp.addEventListener('mouseleave', () => {
        const dot = grp.querySelector('.trend-dot-circle');
        if (dot) dot.setAttribute('r', '3.5');
        if (crosshair) crosshair.style.display = 'none';
        if (hoverIndicator) {
          hoverIndicator.innerHTML = `<span class="tt-hint">Sorot titik untuk melihat nominal</span>`;
        }
      });
    });
  }
};

// Global export
window.ChartEngine = ChartEngine;
