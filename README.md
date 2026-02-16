# American Restaurant Finder

A BBC-themed web application that finds American restaurants near your current location.

## Features

- Detects your current location via browser geolocation
- Shows today's date, local time, city and country
- Finds 3 nearest American restaurants within 5 km
- Displays address, distance, opening hours and map links
- BBC-inspired clean design with serif headlines and red accents

## Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)

## Installation

```bash
git clone https://github.com/zzan1972-hash/american-restaurant-finder.git
cd american-restaurant-finder
```

## Running

```bash
node server.js
```

Then open your browser and go to:

```
http://localhost:5003
```

Click **"Find American Restaurants"** and allow location access when prompted.

## How It Works

- **Geolocation**: Uses your browser's location API to get your coordinates
- **Reverse Geocoding**: [OpenStreetMap Nominatim](https://nominatim.openstreetmap.org/) to resolve your city and country
- **Restaurant Search**: [Overpass API](https://overpass-api.de/) (OpenStreetMap) to find nearby American/burger/steak restaurants within 5 km
- **No API keys required** — all services used are free and open

## Tech Stack

- Node.js (no dependencies — uses built-in `http` and `https` modules)
- Vanilla HTML/CSS/JavaScript frontend
- OpenStreetMap APIs for geocoding and restaurant data
