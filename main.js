// Generate weekly Tuesdays from startDate to endDate
function generateWeeklyTuesdays(startDate, endDate) {
  const dates = [];
  let current = new Date(startDate);

  // Align to Tuesday if startDate isn't Tuesday
  while (current.getUTCDay() !== 2) {
    current.setUTCDate(current.getUTCDate() + 1);
  }

  while (current <= endDate) {
    const yyyy = current.getUTCFullYear();
    const mm = String(current.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(current.getUTCDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);

    // Advance one week
    current.setUTCDate(current.getUTCDate() + 7);
  }

  return dates;
}

// Format Date object as 'YYYY-MM-DD' in UTC
function formatDate(date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// DST check for ET timezone (approximate)
function isDST(date = new Date()) {
  const jan = new Date(date.getFullYear(), 0, 1);
  const jul = new Date(date.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return date.getTimezoneOffset() < stdTimezoneOffset;
}

// Determine latest available Tuesday date based on UTC time and ET 9 AM cutoff with DST adjustment
function getLatestAvailableDate() {
  const now = new Date();

  const isDst = isDST(now);
  const cutoffHourUTC = isDst ? 13 : 14; // 9 AM ET in UTC

  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon, 2=Tue, ...
  const daysSinceTuesday = (utcDay + 7 - 2) % 7;

  // Most recent Tuesday at UTC midnight
  const thisTuesday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  thisTuesday.setUTCDate(thisTuesday.getUTCDate() - daysSinceTuesday);

  // Thursday after that Tuesday at cutoff hour UTC
  const thisThursday = new Date(thisTuesday);
  thisThursday.setUTCDate(thisTuesday.getUTCDate() + 2);
  thisThursday.setUTCHours(cutoffHourUTC, 0, 0, 0);

  if (now < thisThursday) {
    // Before Thursday 9 AM ET => use previous Tuesday
    const prevTuesday = new Date(thisTuesday);
    prevTuesday.setUTCDate(thisTuesday.getUTCDate() - 7);
    return formatDate(prevTuesday);
  } else {
    // On/after Thursday 9 AM ET => use this Tuesday
    return formatDate(thisTuesday);
  }
}


// Color function for drought categories based on numeric DM property
function getColor(dm) {
  switch (dm) {
    case 4: return '#bd0026'; // D4 - Exceptional Drought
    case 3: return '#f03b20'; // D3 - Extreme Drought
    case 2: return '#fd8d3c'; // D2 - Severe Drought
    case 1: return '#fecc5c'; // D1 - Moderate Drought
    case 0: return '#ffffb2'; // D0 - Abnormally Dry
    case -1: return '#FFFFCC'; // None / No drought (assuming -1 or something)
    default: return '#FFFFFF'; // Unknown / No data
  }
}

// Get descriptive text for drought category by DM code
function getDroughtCategoryText(dm) {
  switch (dm) {
    case 4: return 'Exceptional Drought';
    case 3: return 'Extreme Drought';
    case 2: return 'Severe Drought';
    case 1: return 'Moderate Drought';
    case 0: return 'Abnormally Dry';
    case -1: return 'None';
    default: return 'Unknown';
  }
}

// Load GeoJSON for a given date string (YYYY-MM-DD)
function loadDroughtGeoJSON(date) {
  const dateForUrl = date.replace(/-/g, '');
  const url = `https://droughtmonitor.unl.edu/data/json/usdm_${dateForUrl}.json`;
  const dateObj = new Date(date + 'T00:00:00Z'); // Parse as UTC
  const yyyy = dateObj.getUTCFullYear();
  const month = dateObj.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });
  const dd = String(dateObj.getUTCDate()).padStart(2, '0');
  document.getElementById('date-display').innerText = `${yyyy} ${month} ${dd}`;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        throw new Error('GeoJSON not found for date: ' + date);
      }
      return response.json();
    })
    .then(data => {
      geojsonLayerGroup.clearLayers();
      L.geoJSON(data, {
        style: feature => ({
          fillColor: getColor(feature.properties.DM),
          weight: 1,
          color: 'black',
          fillOpacity: 0.7,
        }),
        onEachFeature: (feature, layer) => {
          const dm = feature.properties.DM;
          const code = dm !== undefined ? 'D' + dm : 'Unknown';
          const desc = getDroughtCategoryText(dm);
          const popupContent = `<strong>${code}</strong> (${desc})`;

          let hoverTimeout;

          layer.on('mouseover', function (e) {
            hoverTimeout = setTimeout(() => {
              layer.bindPopup(popupContent).openPopup(e.latlng);
            }, 300); // 300ms delay
          });
        
          layer.on('mouseout', function () {
            clearTimeout(hoverTimeout);
            layer.closePopup();
          });
        }
,
      }).addTo(geojsonLayerGroup);
    })
    .catch(error => {
      console.error(error);
      geojsonLayerGroup.clearLayers();
    });
}

// Debounce helper function
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function createLegend() {
  const legendEl = document.getElementById('legend');
  const categories = [
    { dm: 4, label: 'D4 - Exceptional Drought' },
    { dm: 3, label: 'D3 - Extreme Drought' },
    { dm: 2, label: 'D2 - Severe Drought' },
    { dm: 1, label: 'D1 - Moderate Drought' },
    { dm: 0, label: 'D0 - Abnormally Dry' }
  ];

  legendEl.innerHTML = ''; // Clear existing

  categories.forEach(cat => {
    const item = document.createElement('div');
    item.className = 'legend-item';

    const colorBox = document.createElement('div');
    colorBox.className = 'legend-color-box';
    colorBox.style.backgroundColor = getColor(cat.dm);

    const label = document.createElement('span');
    label.textContent = cat.label;

    item.appendChild(colorBox);
    item.appendChild(label);
    legendEl.appendChild(item);
  });
}

// Initialize map
const map = L.map('map').setView([39.5, -98.5], 4);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors',
}).addTo(map);

const geojsonLayerGroup = L.layerGroup().addTo(map);

// Call it once after the map initializes
createLegend();

// Prepare dates and slider
const startDate = new Date(Date.UTC(2000, 0, 4)); // 2000-01-04 UTC Tuesday
const latestAvailableDateStr = getLatestAvailableDate();
const latestAvailableDate = new Date(latestAvailableDateStr + 'T00:00:00Z');

const droughtDates = generateWeeklyTuesdays(startDate, latestAvailableDate);

document.getElementById('date-range').innerText =
  `Data available from ${droughtDates[0]} to ${droughtDates[droughtDates.length - 1]}.`;

const slider = document.getElementById('slider');
slider.max = droughtDates.length - 1;
slider.value = 0; // start on latest date (rightmost)

// Reverse slider direction with debounce: only load when slider stops moving for 300ms
const debouncedLoad = debounce(() => {
  const reversedIndex = droughtDates.length - 1 - slider.value;
  loadDroughtGeoJSON(droughtDates[reversedIndex]);
  updateDatePickerFromDate(droughtDates[reversedIndex]);
}, 300);

slider.addEventListener('input', debouncedLoad);

// Initial load: show latest available date (right side)
loadDroughtGeoJSON(latestAvailableDateStr);

// --- Date picker implementation ---

const rightPlaceholder = document.getElementById('right-placeholder');

// Insert Year/Month/Day dropdowns
rightPlaceholder.innerHTML = `
  <select id="year-select" style="margin-bottom:6px;"></select>
  <select id="month-select" style="margin-bottom:6px;"></select>
  <select id="day-select"></select>
`;

const firstYear = new Date(droughtDates[0]).getUTCFullYear();
const lastYear = new Date(droughtDates[droughtDates.length - 1]).getUTCFullYear();

document.getElementById('slider-label-left').innerText = firstYear;
document.getElementById('slider-label-right').innerText = lastYear;



const yearSelect = document.getElementById('year-select');
const monthSelect = document.getElementById('month-select');
const daySelect = document.getElementById('day-select');

function populateYears() {
  const yearsSet = new Set(droughtDates.map(d => new Date(d).getUTCFullYear()));
  const years = Array.from(yearsSet).sort((a, b) => b - a);

  yearSelect.innerHTML = '';
  years.forEach(year => {
    const option = document.createElement('option');
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });
}

function populateMonths(year) {
  monthSelect.innerHTML = '';
  const monthsSet = new Set(
    droughtDates
      .filter(d => new Date(d).getUTCFullYear() === +year)
      .map(d => new Date(d).getUTCMonth())
  );
  const months = Array.from(monthsSet).sort((a, b) => a - b);

  months.forEach(month => {
    const option = document.createElement('option');
    option.value = String(month);
    const monthName = new Date(Date.UTC(2000, month, 1)).toLocaleString('en-US', {
      month: 'long',
      timeZone: 'UTC',
    });
    option.textContent = monthName;
    monthSelect.appendChild(option);
  });
}


function populateDays(year, month) {
  daySelect.innerHTML = '';
  const days = droughtDates.filter(d => {
    const date = new Date(d);
    return date.getUTCFullYear() === +year && date.getUTCMonth() === +month;
  });

  days.forEach(d => {
    const dateObj = new Date(d);
    const dayNum = String(dateObj.getUTCDate()).padStart(2, '0');
    const option = document.createElement('option');
    option.value = d;
    option.textContent = dayNum; // Only day number here
    daySelect.appendChild(option);
  });
}

function updateDatePickerFromDate(dateStr) {
  const dateObj = new Date(dateStr);
  const year = dateObj.getUTCFullYear();
  const month = dateObj.getUTCMonth();

  // Set year and repopulate months
  if (yearSelect.value !== String(year)) {
    yearSelect.value = String(year);
    populateMonths(year);
  } else {
    populateMonths(year); // still need to repopulate in case different date
  }

  // Explicitly set month after repopulating
  monthSelect.value = String(month);

  // Populate days and set correct day
  populateDays(year, month);
  daySelect.value = dateStr;
}


// Event listeners for dropdown changes

yearSelect.addEventListener('change', () => {
  const selectedYear = +yearSelect.value;
  populateMonths(selectedYear);

  // Auto-select first month on year change
  if (monthSelect.options.length > 0) {
    monthSelect.selectedIndex = 0;
    populateDays(selectedYear, +monthSelect.value);

    if (daySelect.options.length > 0) {
      daySelect.selectedIndex = 0;
      loadDroughtGeoJSON(daySelect.value);

      // Update slider to match selected date
      updateSliderForDate(daySelect.value);
    }
  }
});

monthSelect.addEventListener('change', () => {
  const selectedYear = +yearSelect.value;
  const selectedMonth = +monthSelect.value;
  populateDays(selectedYear, selectedMonth);

  // Auto-select first day on month change
  if (daySelect.options.length > 0) {
    daySelect.selectedIndex = 0;
    loadDroughtGeoJSON(daySelect.value);

    // Update slider to match selected date
    updateSliderForDate(daySelect.value);
  }
});

daySelect.addEventListener('change', () => {
  loadDroughtGeoJSON(daySelect.value);

  // Update slider to match selected date
  updateSliderForDate(daySelect.value);
});

// Update slider position based on selected date
function updateSliderForDate(dateStr) {
  const index = droughtDates.indexOf(dateStr);
  if (index >= 0) {
    slider.value = droughtDates.length - 1 - index;
  }
}

// Initialize date picker dropdowns on page load
populateYears();
populateMonths(+yearSelect.value);
populateDays(+yearSelect.value, +monthSelect.value);

// Set date picker to latest available date initially
updateDatePickerFromDate(latestAvailableDateStr);
