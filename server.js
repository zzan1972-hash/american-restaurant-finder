const http = require('http');
const https = require('https');

function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Reverse geocode using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lon) {
  try {
    const data = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en`);
    const json = JSON.parse(data);
    return {
      city: json.address.city || json.address.town || json.address.village || json.address.suburb || 'Unknown',
      country: json.address.country || 'Unknown',
      countryCode: json.address.country_code || '',
    };
  } catch {
    return { city: 'Unknown', country: 'Unknown', countryCode: '' };
  }
}

// Find American restaurants nearby using Overpass API (OpenStreetMap)
async function findRestaurants(lat, lon) {
  try {
    const radius = 5000; // 5 km
    const query = `
      [out:json][timeout:10];
      (
        node["amenity"="restaurant"]["cuisine"~"american|burger|steak",i](around:${radius},${lat},${lon});
        node["amenity"="fast_food"]["cuisine"~"american|burger|steak",i](around:${radius},${lat},${lon});
      );
      out body 20;
    `.trim();
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    const data = await fetch(url);
    const json = JSON.parse(data);

    const restaurants = json.elements
      .filter(el => el.tags && el.tags.name)
      .map(el => {
        const dlat = (el.lat - lat) * 111320;
        const dlon = (el.lon - lon) * 111320 * Math.cos(lat * Math.PI / 180);
        const dist = Math.sqrt(dlat * dlat + dlon * dlon);
        return {
          name: el.tags.name,
          cuisine: el.tags.cuisine || 'American',
          address: el.tags['addr:street']
            ? `${el.tags['addr:housenumber'] || ''} ${el.tags['addr:street']}`.trim()
            : (el.tags['addr:full'] || 'Address not listed'),
          distance: (dist / 1000).toFixed(1),
          lat: el.lat,
          lon: el.lon,
          phone: el.tags.phone || null,
          website: el.tags.website || null,
          opening_hours: el.tags.opening_hours || null,
        };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3);

    return restaurants;
  } catch {
    return [];
  }
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>American Restaurant Finder</title>
  <link href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@300;400;500;600;700;800&family=Lora:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Libre Franklin', Arial, Helvetica, sans-serif;
      background: #f6f6f6;
      color: #222;
      min-height: 100vh;
    }

    /* BBC-style top bar */
    .topbar {
      background: #222;
      padding: 0;
      height: 48px;
      display: flex;
      align-items: center;
      padding-left: 24px;
    }
    .topbar-logo {
      background: #fff;
      color: #222;
      font-weight: 800;
      font-size: 0.75rem;
      padding: 4px 6px;
      letter-spacing: 1px;
      margin-right: 24px;
      display: flex;
      gap: 3px;
    }
    .topbar-logo span {
      background: #222;
      color: #fff;
      padding: 2px 5px;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .topbar-nav { display: flex; gap: 0; height: 100%; }
    .topbar-nav a {
      color: #fff;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 400;
      padding: 0 16px;
      display: flex;
      align-items: center;
      height: 100%;
      transition: background 0.2s;
      border-bottom: 3px solid transparent;
    }
    .topbar-nav a:hover { background: #444; }
    .topbar-nav a.active { border-bottom: 3px solid #bb1919; }

    /* BBC-style red accent bar */
    .accent-bar {
      background: #bb1919;
      height: 4px;
    }

    /* Header */
    .header {
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      padding: 32px 24px 28px;
      max-width: 1024px;
      margin: 0 auto;
    }
    .header h1 {
      font-family: 'Lora', Georgia, serif;
      font-size: 2.4rem;
      font-weight: 700;
      color: #222;
      line-height: 1.2;
      margin-bottom: 8px;
    }
    .header p {
      font-size: 1rem;
      color: #555;
      line-height: 1.5;
    }

    /* Main content */
    .main {
      max-width: 1024px;
      margin: 0 auto;
      padding: 32px 24px;
    }

    /* Location prompt */
    .location-prompt {
      background: #fff;
      border: 1px solid #e0e0e0;
      padding: 40px;
      text-align: center;
      margin-bottom: 24px;
    }
    .location-prompt p {
      font-size: 1rem;
      color: #555;
      margin-bottom: 20px;
      line-height: 1.5;
    }

    /* BBC-style button */
    .btn {
      background: #bb1919;
      color: #fff;
      border: none;
      padding: 14px 32px;
      font-size: 1rem;
      font-weight: 600;
      font-family: 'Libre Franklin', Arial, sans-serif;
      cursor: pointer;
      transition: background 0.2s;
      letter-spacing: 0.2px;
    }
    .btn:hover { background: #9a1010; }
    .btn:disabled { background: #999; cursor: wait; }

    /* Info strip */
    .info-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1px;
      background: #e0e0e0;
      margin-bottom: 24px;
    }
    .info-item {
      background: #fff;
      padding: 20px 24px;
    }
    .info-item .label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #777;
      font-weight: 600;
      margin-bottom: 6px;
    }
    .info-item .value {
      font-family: 'Lora', Georgia, serif;
      font-size: 1.2rem;
      font-weight: 600;
      color: #222;
    }

    /* Restaurant cards */
    .results-heading {
      font-family: 'Lora', Georgia, serif;
      font-size: 1.4rem;
      font-weight: 700;
      color: #222;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e0e0e0;
    }
    .restaurant-card {
      background: #fff;
      border: 1px solid #e0e0e0;
      padding: 24px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      transition: border-color 0.2s;
    }
    .restaurant-card:hover {
      border-color: #bb1919;
    }
    .restaurant-info { flex: 1; }
    .restaurant-name {
      font-family: 'Lora', Georgia, serif;
      font-size: 1.2rem;
      font-weight: 700;
      color: #222;
      margin-bottom: 6px;
    }
    .restaurant-cuisine {
      display: inline-block;
      background: #f0f0f0;
      color: #555;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 3px 10px;
      margin-bottom: 10px;
    }
    .restaurant-detail {
      font-size: 0.9rem;
      color: #555;
      line-height: 1.6;
    }
    .restaurant-detail strong { color: #333; }
    .restaurant-distance {
      text-align: right;
      min-width: 80px;
      padding-left: 20px;
    }
    .restaurant-distance .dist-val {
      font-size: 1.6rem;
      font-weight: 700;
      color: #bb1919;
    }
    .restaurant-distance .dist-unit {
      font-size: 0.75rem;
      color: #777;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .restaurant-link {
      display: inline-block;
      margin-top: 8px;
      color: #bb1919;
      font-size: 0.85rem;
      font-weight: 600;
      text-decoration: none;
    }
    .restaurant-link:hover { text-decoration: underline; }

    /* No results */
    .no-results {
      background: #fff;
      border: 1px solid #e0e0e0;
      padding: 40px;
      text-align: center;
      color: #555;
    }

    /* Footer */
    .footer {
      background: #222;
      color: rgba(255,255,255,0.5);
      text-align: center;
      padding: 24px;
      font-size: 0.8rem;
      margin-top: 48px;
    }

    .hidden { display: none; }

    /* Rank badge */
    .rank {
      width: 28px;
      height: 28px;
      background: #bb1919;
      color: #fff;
      font-weight: 700;
      font-size: 0.85rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      flex-shrink: 0;
    }
    .restaurant-card { display: flex; }
    .card-body { display: flex; justify-content: space-between; flex: 1; }
  </style>
</head>
<body>

  <div class="topbar">
    <div class="topbar-logo">
      <span>A</span><span>R</span><span>F</span>
    </div>
    <div class="topbar-nav">
      <a href="#" class="active">Home</a>
      <a href="#">About</a>
      <a href="#">Contact</a>
    </div>
  </div>
  <div class="accent-bar"></div>

  <div class="header">
    <h1>American Restaurant Finder</h1>
    <p>Discover the best American restaurants near your current location</p>
  </div>

  <div class="main">
    <div id="prompt" class="location-prompt">
      <p>Allow location access to find American restaurants within 5 km of where you are.</p>
      <button class="btn" id="findBtn" onclick="findRestaurants()">Find American Restaurants</button>
    </div>

    <div id="info" class="info-strip hidden"></div>
    <div id="results" class="hidden"></div>
  </div>

  <footer class="footer">
    &copy; 2026 American Restaurant Finder
  </footer>

  <script>
    function findRestaurants() {
      const btn = document.getElementById('findBtn');
      btn.disabled = true;
      btn.textContent = 'Locating you...';

      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        btn.disabled = false;
        btn.textContent = 'Find American Restaurants';
        return;
      }

      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        btn.textContent = 'Searching restaurants...';

        try {
          const res = await fetch('/api/find?lat=' + latitude + '&lon=' + longitude);
          const data = await res.json();

          // Show info strip
          const info = document.getElementById('info');
          info.innerHTML =
            '<div class="info-item">' +
              '<div class="label">Date</div>' +
              '<div class="value">' + data.date + '</div>' +
            '</div>' +
            '<div class="info-item">' +
              '<div class="label">Local Time</div>' +
              '<div class="value">' + data.time + '</div>' +
            '</div>' +
            '<div class="info-item">' +
              '<div class="label">City</div>' +
              '<div class="value">' + data.location.city + '</div>' +
            '</div>' +
            '<div class="info-item">' +
              '<div class="label">Country</div>' +
              '<div class="value">' + data.location.country + '</div>' +
            '</div>';
          info.classList.remove('hidden');

          // Show results
          const results = document.getElementById('results');
          if (data.restaurants.length === 0) {
            results.innerHTML =
              '<h2 class="results-heading">Recommended Restaurants</h2>' +
              '<div class="no-results">' +
                '<p>No American restaurants found within 5 km of your location.<br>Try searching from a different area.</p>' +
              '</div>';
          } else {
            let cards = '<h2 class="results-heading">Recommended Restaurants Near You</h2>';
            data.restaurants.forEach(function(r, i) {
              let details = '<div class="restaurant-detail">';
              details += '<strong>Address:</strong> ' + r.address;
              if (r.phone) details += '<br><strong>Phone:</strong> ' + r.phone;
              if (r.opening_hours) details += '<br><strong>Hours:</strong> ' + r.opening_hours;
              details += '</div>';

              let link = '';
              if (r.website) {
                link = '<a class="restaurant-link" href="' + r.website + '" target="_blank">Visit website &#8250;</a>';
              } else {
                link = '<a class="restaurant-link" href="https://www.google.com/maps/search/?api=1&query=' + r.lat + ',' + r.lon + '" target="_blank">View on map &#8250;</a>';
              }

              cards +=
                '<div class="restaurant-card">' +
                  '<div class="rank">' + (i + 1) + '</div>' +
                  '<div class="card-body">' +
                    '<div class="restaurant-info">' +
                      '<div class="restaurant-name">' + r.name + '</div>' +
                      '<div class="restaurant-cuisine">' + r.cuisine + '</div>' +
                      details +
                      link +
                    '</div>' +
                    '<div class="restaurant-distance">' +
                      '<div class="dist-val">' + r.distance + '</div>' +
                      '<div class="dist-unit">km away</div>' +
                    '</div>' +
                  '</div>' +
                '</div>';
            });
            results.innerHTML = cards;
          }
          results.classList.remove('hidden');

          // Update button
          document.getElementById('prompt').querySelector('p').textContent =
            'Showing results for ' + data.location.city + ', ' + data.location.country;
          btn.textContent = 'Search Again';
          btn.disabled = false;
        } catch (err) {
          console.error(err);
          btn.textContent = 'Find American Restaurants';
          btn.disabled = false;
        }
      }, function(err) {
        alert('Location access denied. Please enable location services and try again.');
        btn.textContent = 'Find American Restaurants';
        btn.disabled = false;
      });
    }
  </script>

</body>
</html>`;

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/find') {
    const lat = parseFloat(url.searchParams.get('lat'));
    const lon = parseFloat(url.searchParams.get('lon'));

    if (isNaN(lat) || isNaN(lon)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid coordinates' }));
      return;
    }

    const [location, restaurants] = await Promise.all([
      reverseGeocode(lat, lon),
      findRestaurants(lat, lon),
    ]);

    const now = new Date();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      date: now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      location,
      restaurants,
    }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }
});

server.listen(5003, () => {
  console.log('American Restaurant Finder running at http://localhost:5003');
});
