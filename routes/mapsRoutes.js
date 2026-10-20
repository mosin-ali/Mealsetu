const express = require('express');
const router  = express.Router();
const https   = require('https');

const KEY = 'AIzaSyCgJ0v4LEJaPxZUQR20A56GpBeFa8cf3LQ';

function googleGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => (raw += chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function nominatimReverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(lat)}` +
    `&lon=${encodeURIComponent(lng)}&format=jsonv2&addressdetails=1`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MealSetu/1.0' },
  });
  if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

  const data = await response.json();
  const address = data.address || {};
  const address_components = [];
  const addComponent = (value, ...types) => {
    if (value) address_components.push({ long_name: value, short_name: value, types });
  };

  addComponent(address.house_number || address.building, 'street_number');
  addComponent(address.road || address.pedestrian || address.path, 'route');
  addComponent(address.suburb || address.neighbourhood, 'sublocality_level_1');
  addComponent(address.city_district, 'sublocality');
  addComponent(address.city || address.town || address.village, 'locality');
  addComponent(address.county, 'administrative_area_level_2');
  addComponent(address.postcode, 'postal_code');

  return {
    status: address_components.length ? 'OK' : 'ZERO_RESULTS',
    results: address_components.length ? [{
      formatted_address: data.display_name || '',
      address_components,
      geometry: { location: { lat: Number(lat), lng: Number(lng) } },
    }] : [],
  };
}

// GET /api/maps/geocode/reverse?lat=&lng=
router.get('/geocode/reverse', async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ status: 'INVALID_REQUEST', results: [] });
  try {
    const data = await googleGet(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${KEY}&language=en`
    );
    if (data.status === 'OK' && data.results?.length) {
      return res.json(data);
    }

    const fallback = await nominatimReverseGeocode(lat, lng);
    res.json(fallback);
  } catch {
    try {
      const fallback = await nominatimReverseGeocode(lat, lng);
      res.json(fallback);
    } catch {
      res.status(502).json({ status: 'ERROR', results: [] });
    }
  }
});

// GET /api/maps/geocode?address=   (forward geocode for typed address fallback)
router.get('/geocode', async (req, res) => {
  const { address } = req.query;
  if (!address) return res.status(400).json({ status: 'INVALID_REQUEST', results: [] });
  try {
    const data = await googleGet(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${KEY}&region=in&language=en`
    );
    res.json(data);
  } catch {
    res.status(502).json({ status: 'ERROR', results: [] });
  }
});

// GET /api/maps/places/autocomplete?input=
router.get('/places/autocomplete', async (req, res) => {
  const { input } = req.query;
  if (!input) return res.status(400).json({ status: 'INVALID_REQUEST', predictions: [] });
  try {
    const data = await googleGet(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${KEY}&components=country:in&language=en`
    );
    res.json(data);
  } catch {
    res.status(502).json({ status: 'ERROR', predictions: [] });
  }
});

// GET /api/maps/places/details?place_id=
router.get('/places/details', async (req, res) => {
  const { place_id } = req.query;
  if (!place_id) return res.status(400).json({ status: 'INVALID_REQUEST' });
  try {
    const data = await googleGet(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(place_id)}&key=${KEY}&fields=geometry,address_components,name&language=en`
    );
    res.json(data);
  } catch {
    res.status(502).json({ status: 'ERROR' });
  }
});

module.exports = router;
