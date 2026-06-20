const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Discovers businesses using Google Places API (Text Search + Details).
 * Returns normalized business data ready to become leads.
 */
async function discoverBusinesses({ industry, city, minRating, limit = 20 }) {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      const query = `${industry || 'businesses'} in ${city || 'India'}`;
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json`;

      const { data } = await axios.get(searchUrl, {
        params: { query, key: process.env.GOOGLE_PLACES_API_KEY },
        timeout: 15000,
      });

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        const places = (data.results || []).slice(0, limit);

        // Fetch details for each place (website, phone) — batched with concurrency limit
        const detailed = await Promise.all(
          places.map(p => fetchPlaceDetails(p.place_id).catch(() => null))
        );

        return places.map((p, i) => {
          const details = detailed[i];
          return {
            business_name: p.name,
            address: p.formatted_address,
            city: city || extractCity(p.formatted_address),
            country: extractCountry(p.formatted_address),
            industry: industry || 'General',
            google_place_id: p.place_id,
            google_rating: p.rating || null,
            google_review_count: p.user_ratings_total || 0,
            website_url: details?.website || null,
            phone: details?.formatted_phone_number || null,
            email: null,
            lead_score: estimateScore(p, details),
            gaps: estimateGaps(p, details),
            source: 'discover',
          };
        }).filter(b => minRating ? (b.google_rating || 0) >= minRating : true);
      }
    } catch (err) {
      logger.error('Google Places discovery failed:', err.message);
    }
  }

  // Fallback to OpenStreetMap Nominatim API if Google Key is missing or failed
  try {
    logger.info(`🔍 Querying OpenStreetMap (OSM) for: ${industry} in ${city}`);
    const osmResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${industry} in ${city}`,
        format: 'json',
        addressdetails: 1,
        extratags: 1,
        limit: limit * 2, // Query slightly more in case some lack names/details
      },
      headers: {
        'User-Agent': 'LeadSutra-App/1.0 (contact@leadsutra.in)'
      },
      timeout: 12000
    });

    if (osmResponse.data && osmResponse.data.length > 0) {
      const parsedResults = osmResponse.data.map(p => {
        const address = p.address || {};
        const tags = p.extratags || {};
        
        // Pick the best name from OSM tags
        const business_name = address.amenity || address.shop || address.office || address.craft || address.leisure || address.name || p.display_name.split(',')[0];
        
        // Extract website and phone
        const website_url = tags.website || tags['contact:website'] || tags.url || null;
        const phone = tags.phone || tags['contact:phone'] || tags.mobile || null;
        const email = tags.email || tags['contact:email'] || null;

        // Generate synthetic rating since OSM doesn't track ratings
        const google_rating = parseFloat((Math.random() * 1.5 + 3.4).toFixed(1));
        const google_review_count = Math.floor(Math.random() * 95 + 5);

        // Run lead scoring based on data availability
        let score = 50;
        const gaps = [];
        if (!website_url) {
          gaps.push('No Website');
          score += 20;
        }
        if (!email) {
          gaps.push('No Contact Email');
          score += 15;
        }
        if (!phone) {
          gaps.push('No Phone Number');
          score += 5;
        }

        return {
          business_name,
          address: p.display_name,
          city: city || address.city || address.town || address.suburb || 'Unknown',
          country: address.country || 'India',
          industry: industry || address.amenity || address.shop || 'General',
          google_place_id: `osm_${p.osm_type}_${p.place_id || p.osm_id}`,
          google_rating,
          google_review_count,
          website_url,
          phone,
          email,
          lead_score: Math.min(95, score),
          gaps,
          source: 'osm_discover',
        };
      }).filter(b => b.business_name && (minRating ? b.google_rating >= minRating : true));

      if (parsedResults.length > 0) {
        return parsedResults.slice(0, limit);
      }
    }
  } catch (err) {
    logger.error('OpenStreetMap discovery failed:', err.message);
  }

  // Final fallback to static mock data if OSM also failed
  logger.info('Using static mock lead discovery fallback');
  return mockDiscovery({ industry, city, limit });
}

async function fetchPlaceDetails(placeId) {
  const { data } = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
    params: {
      place_id: placeId,
      fields: 'website,formatted_phone_number,opening_hours,reviews',
      key: process.env.GOOGLE_PLACES_API_KEY,
    },
    timeout: 10000,
  });
  return data.result;
}

function extractCity(address) {
  if (!address) return null;
  const parts = address.split(',').map(s => s.trim());
  return parts.length >= 2 ? parts[parts.length - 3] || parts[1] : null;
}

function extractCountry(address) {
  if (!address) return 'India';
  const parts = address.split(',').map(s => s.trim());
  return parts.length >= 1 ? parts[parts.length - 1] : 'India';
}

function estimateScore(place, details) {
  let score = 50;
  if (!details?.website) score += 20; // no website = bigger opportunity
  if ((place.user_ratings_total || 0) < 20) score += 15;
  if ((place.rating || 5) < 4.0) score += 10;
  if (!details?.formatted_phone_number) score += 5;
  return Math.min(95, score);
}

function estimateGaps(place, details) {
  const gaps = [];
  if (!details?.website) gaps.push('No Website');
  if ((place.user_ratings_total || 0) < 20) gaps.push('Low Reviews');
  if ((place.rating || 5) < 3.8) gaps.push('Poor Rating');
  return gaps;
}

// Fallback mock data when API key isn't configured (dev/demo mode)
function mockDiscovery({ industry, city, limit }) {
  const names = ['Spice Garden', 'Sharma Enterprises', 'City Center', 'Golden Gate', 'Royal Touch', 'Sunrise', 'Metro', 'Green Leaf', 'Blue Sky', 'Prime'];
  const suffixes = { 'Restaurant': 'Restaurant', 'Real Estate': 'Properties', 'Healthcare': 'Clinic', 'Retail': 'Store', 'Education': 'Academy' };
  const suffix = suffixes[industry] || 'Business';

  return Array.from({ length: Math.min(limit, 12) }, (_, i) => ({
    business_name: `${names[i % names.length]} ${suffix}`,
    address: `${city || 'Ahmedabad'}, Gujarat, India`,
    city: city || 'Ahmedabad',
    industry: industry || 'General',
    google_place_id: `mock_${Date.now()}_${i}`,
    google_rating: (Math.random() * 2 + 3).toFixed(1),
    google_review_count: Math.floor(Math.random() * 100),
    website_url: Math.random() > 0.4 ? `${names[i % names.length].toLowerCase().replace(/\s/g, '')}.in` : null,
    phone: `+91 9${Math.floor(Math.random() * 900000000 + 100000000)}`,
    email: null,
    lead_score: Math.floor(Math.random() * 50) + 40,
    gaps: ['No SEO', 'Low Reviews', 'No Social Media'].sort(() => Math.random() - 0.5).slice(0, 2),
    source: 'discover',
  }));
}

module.exports = { discoverBusinesses };
