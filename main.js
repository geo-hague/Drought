// --- Global State & Config ---
let currentOpacity = 0.7; 

// --- Date Utilities ---
function generateWeeklyTuesdays(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);
  while (current.getUTCDay() !== 2) {
    current.setUTCDate(current.getUTCDate() + 1);
  }
  while (current <= endDate) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    current.setUTCDate(current.getUTCDate() + 7);
  }
  return dates;
}

function formatDate(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isDST(date = new Date()) {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return date.getTimezoneOffset() < stdTimezoneOffset;
}

function getLatestAvailableDate() {
  const now = new Date();
  const isDst = isDST(now);
  const cutoffHourUTC = isDst ? 13 : 14; 
  const utcDay = now.getUTCDay();
  const daysSinceTuesday = (utcDay + 7 - 2) % 7;
  const thisTuesday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  thisTuesday.setUTCDate(thisTuesday.getUTCDate() - daysSinceTuesday);
  const thisThursday = new Date(thisTuesday);
  thisThursday.setUTCDate(thisTuesday.getUTCDate() + 2);
  thisThursday.setUTCHours(cutoffHourUTC, 0, 0, 0);

  if (now < thisThursday) {
    const prevTuesday = new Date(thisTuesday);
    prevTuesday.setUTCDate(thisTuesday.getUTCDate() - 7);
    return formatDate(prevTuesday);
  } else {
    return formatDate(thisTuesday);
  }
}

// --- Map & Styling ---
function getColor(dm) {
  switch (dm) {
    case 4: return '#bd0026';
    case 3: return '#f03b20';
    case 2: return '#fd8d3c';
    case 1: return '#fecc5c';
    case 0: return '#ffffb2';
    default: return '#FFFFFF';
  }
}

function getDroughtCategoryText(dm) {
  switch (dm) {
    case 4: return 'Exceptional Drought';
    case 3: return 'Extreme Drought';
    case 2: return 'Severe Drought';
    case 1: return 'Moderate Drought';
    case 0: return 'Abnormally Dry';
    default: return 'None';
  }
}

// Map Initialization
const map = L.map('map').setView([39.5, -98.5], 4);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

const geojsonLayerGroup = L.layerGroup().addTo(map);

// --- Opacity Control ---
const OpacitySlider = L.Control.extend({
  onAdd: function(map) {
    const container = L.DomUtil.create('div', 'opacity-control-container');
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    container.innerHTML = `
      <label for="opacity-slider">Map Opacity</label>
      <input type="range" id="opacity-slider" min="0" max="1" step="0.1" value="${currentOpacity}">
    `;
    return container;
  }
});

map.addControl(new OpacitySlider({ position: 'topright' }));

document.addEventListener('input', function (e) {
  if (e.target && e.target.id === 'opacity-slider') {
    currentOpacity = parseFloat(e.target.value);
    geojsonLayerGroup.eachLayer(layer => {
      if (layer.setStyle) {
        layer.setStyle({ fillOpacity: currentOpacity });
      }
    });
  }
});

function loadDroughtGeoJSON(date) {
  const dateForUrl = date.replace(/-/g, '');
  const url = `https://droughtmonitor.unl.edu/data/json/usdm_${dateForUrl}.json`;
  const dateObj = new Date(date + 'T00:00:00Z');
  const yyyy = dateObj.getUTCFullYear();
  const month = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  document.getElementById('date-display').innerText = `${yyyy} ${month} ${dd}`;

  fetch(url)
    .then(response => response.json())
    .then(data => {
      geojsonLayerGroup.clearLayers();
      L.geoJSON(data, {
        style: feature => ({
          fillColor: getColor(feature.properties.DM),
          weight: 1,
          color: 'black',
          fillOpacity: currentOpacity,
        }),
        onEachFeature: (feature, layer) => {
          const dm = feature.properties.DM;
          const code = 'D' + dm;
          const desc = getDroughtCategoryText(dm);
          layer.bindPopup(`<strong>${code}</strong> (${desc})`);

          // Hover listeners restored
          layer.on({
            mouseover: (e) => {
              const l = e.target;
              l.setStyle({
                weight: 3,
                color: '#666',
                fillOpacity: Math.min(currentOpacity + 0.2, 1)
              });
              l.bringToFront();
            },
            mouseout: (e) => {
              const l = e.target;
              l.setStyle({
                weight: 1,
                color: 'black',
                fillOpacity: currentOpacity
              });
            }
          });
        }
      }).addTo(geojsonLayerGroup);
    })
    .catch(err => console.error("Data load error:", err));
}

// --- Controls Setup ---
const startDate = new Date(Date.UTC(2000, 0, 4));
const latestAvailableDateStr = getLatestAvailableDate();
const droughtDates = generateWeeklyTuesdays(startDate, new Date(latestAvailableDateStr + 'T00:00:00Z'));

const slider = document.getElementById('slider');
const prevBtn = document.getElementById('prev-week');
const nextBtn = document.getElementById('next-week');

slider.max = droughtDates.length - 1;
slider.value = 0; 

function updateButtonStates() {
  const val = parseInt(slider.value);
  prevBtn.disabled = (val >= parseInt(slider.max));
  nextBtn.disabled = (val <= 0);
}

function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

const debouncedLoad = debounce(() => {
  const reversedIndex = droughtDates.length - 1 - slider.value;
  const dateStr = droughtDates[reversedIndex];
  loadDroughtGeoJSON(dateStr);
  updateDatePickerFromDate(dateStr);
  updateButtonStates();
}, 300);

slider.addEventListener('input', debouncedLoad);

prevBtn.addEventListener('click', () => {
  let currentValue = parseInt(slider.value);
  let maxValue = parseInt(slider.max);
  if (currentValue < maxValue) {
    slider.value = currentValue + 1;
    debouncedLoad(); 
  }
});

nextBtn.addEventListener('click', () => {
  let currentValue = parseInt(slider.value);
  if (currentValue > 0) {
    slider.value = currentValue - 1;
    debouncedLoad();
  }
});

// --- Date Picker Logic ---
const rightPlaceholder = document.getElementById('right-placeholder');
rightPlaceholder.innerHTML = `
  <label>Jump to Date:</label>
  <select id="year-select"></select>
  <select id="month-select"></select>
  <select id="day-select"></select>
`;

const yearSelect = document.getElementById('year-select');
const monthSelect = document.getElementById('month-select');
const daySelect = document.getElementById('day-select');

function populateYears() {
  const years = [...new Set(droughtDates.map(d => d.split('-')[0]))].sort((a,b) => b-a);
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
}

function populateMonths(year) {
  const monthsSet = new Set();
  droughtDates.forEach(d => {
    if(d.startsWith(year)) monthsSet.add(parseInt(d.split('-')[1]) - 1);
  });
  const months = Array.from(monthsSet).sort((a,b) => a-b);
  monthSelect.innerHTML = months.map(m => {
    const name = new Date(Date.UTC(2000, m, 1)).toLocaleString('en-US', {month:'long', timeZone:'UTC'});
    return `<option value="${m}">${name}</option>`;
  }).join('');
}

function populateDays(year, month) {
  const monthStr = String(parseInt(month) + 1).padStart(2, '0');
  const days = droughtDates.filter(d => d.startsWith(`${year}-${monthStr}`));
  daySelect.innerHTML = days.map(d => `<option value="${d}">${d.split('-')[2]}</option>`).join('');
}

function updateDatePickerFromDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  yearSelect.value = y;
  populateMonths(y);
  monthSelect.value = parseInt(m) - 1;
  populateDays(y, parseInt(m) - 1);
  daySelect.value = dateStr;
}

function updateSliderForDate(dateStr) {
  const index = droughtDates.indexOf(dateStr);
  if (index >= 0) {
    slider.value = droughtDates.length - 1 - index;
    updateButtonStates();
  }
}

yearSelect.addEventListener('change', () => {
  populateMonths(yearSelect.value);
  monthSelect.dispatchEvent(new Event('change'));
});

monthSelect.addEventListener('change', () => {
  populateDays(yearSelect.value, monthSelect.value);
  daySelect.dispatchEvent(new Event('change'));
});

daySelect.addEventListener('change', () => {
  loadDroughtGeoJSON(daySelect.value);
  updateSliderForDate(daySelect.value);
});

// --- Init ---
function createLegend() {
  const legendEl = document.getElementById('legend');
  const categories = [
    { dm: 4, label: 'D4 - Exceptional' },
    { dm: 3, label: 'D3 - Extreme' },
    { dm: 2, label: 'D2 - Severe' },
    { dm: 1, label: 'D1 - Moderate' },
    { dm: 0, label: 'D0 - Abnormally Dry' }
  ];
  legendEl.innerHTML = categories.map(cat => `
    <div class="legend-item">
      <div class="legend-color-box" style="background:${getColor(cat.dm)}"></div>
      <span>${cat.label}</span>
    </div>
  `).join('');
}

createLegend();
populateYears();
updateDatePickerFromDate(latestAvailableDateStr);
loadDroughtGeoJSON(latestAvailableDateStr);
updateButtonStates();

document.getElementById('slider-label-left').innerText = droughtDates[0].split('-')[0];
document.getElementById('slider-label-right').innerText = latestAvailableDateStr.split('-')[0];
document.getElementById('date-range').innerText = `Available: ${droughtDates[0]} to ${latestAvailableDateStr}`;