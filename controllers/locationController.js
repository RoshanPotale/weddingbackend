const https = require('https');

const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_LIMIT = 1000;
const RESPONSE_LIMIT_BYTES = 1024 * 1024;
const locationCache = new Map();
const pendingLookups = new Map();

class LocationLookupError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const fetchPostalResponse = (pincode) => new Promise((resolve, reject) => {
  const request = https.get(
    `https://api.postalpincode.in/pincode/${encodeURIComponent(pincode)}`,
    { timeout: REQUEST_TIMEOUT_MS },
    (response) => {
      const chunks = [];
      let totalBytes = 0;

      response.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > RESPONSE_LIMIT_BYTES) {
          response.destroy(new Error('Postal API response exceeded the size limit.'));
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new LocationLookupError(502, 'POSTAL_API_ERROR', 'The location service is temporarily unavailable.'));
          return;
        }

        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new LocationLookupError(502, 'INVALID_POSTAL_RESPONSE', 'The location service returned an invalid response.'));
        }
      });
      response.on('error', reject);
    }
  );

  request.on('timeout', () => {
    const error = new Error('Postal API request timed out.');
    error.code = 'ETIMEDOUT';
    request.destroy(error);
  });
  request.on('error', reject);
});

const resolvePincode = async (pincode) => {
  if (typeof pincode !== 'string' || !PINCODE_PATTERN.test(pincode)) {
    throw new LocationLookupError(400, 'INVALID_PINCODE', 'Enter a valid six-digit Indian PIN code.');
  }

  const cached = locationCache.get(pincode);
  if (cached && cached.expiresAt > Date.now()) return cached.location;
  if (cached) locationCache.delete(pincode);
  if (pendingLookups.has(pincode)) return pendingLookups.get(pincode);

  const lookup = (async () => {
    let response;
    try {
      response = await fetchPostalResponse(pincode);
    } catch (error) {
      if (error instanceof LocationLookupError) throw error;
      if (error.code === 'ETIMEDOUT') {
        throw new LocationLookupError(504, 'POSTAL_API_TIMEOUT', 'The location service took too long to respond. Please try again.');
      }
      throw new LocationLookupError(502, 'POSTAL_API_ERROR', 'The location service is temporarily unavailable.');
    }

    if (!Array.isArray(response) || response.length === 0) {
      throw new LocationLookupError(502, 'INVALID_POSTAL_RESPONSE', 'The location service returned an invalid response.');
    }

    const offices = [];
    for (const result of response) {
      if (result?.Status !== 'Success' || !Array.isArray(result.PostOffice)) {
        throw new LocationLookupError(404, 'PINCODE_NOT_FOUND', 'No post offices were found for this PIN code.');
      }
      offices.push(...result.PostOffice);
    }

    if (!offices.length) {
      throw new LocationLookupError(404, 'PINCODE_NOT_FOUND', 'No post offices were found for this PIN code.');
    }
    if (offices.some((office) => !office || typeof office !== 'object'
      || String(office.Pincode || '').trim() !== pincode)) {
      throw new LocationLookupError(502, 'INCONSISTENT_POSTAL_DATA', 'The location service returned inconsistent PIN code details.');
    }

    const firstOffice = offices[0];
    const requiredLocationValues = [firstOffice.District, firstOffice.State, firstOffice.Country];
    if (requiredLocationValues.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new LocationLookupError(502, 'INCOMPLETE_POSTAL_DATA', 'The location service returned incomplete address details.');
    }

    const uniqueVillages = new Map();
    for (const office of offices) {
      if (typeof office.Name !== 'string' || !office.Name.trim()) {
        throw new LocationLookupError(502, 'INCOMPLETE_POSTAL_DATA', 'The location service returned an invalid post office name.');
      }
      const name = office.Name.trim();
      const normalizedName = name.toLocaleLowerCase('en-IN');
      if (!uniqueVillages.has(normalizedName)) uniqueVillages.set(normalizedName, name);
    }

    const location = {
      pincode,
      city: typeof firstOffice.Block === 'string' ? firstOffice.Block.trim() : '',
      district: firstOffice.District.trim(),
      state: firstOffice.State.trim(),
      country: firstOffice.Country.trim(),
      villages: [...uniqueVillages.values()].sort((left, right) => left.localeCompare(right, 'en-IN')),
    };

    if (locationCache.size >= CACHE_LIMIT) {
      const oldestKey = locationCache.keys().next().value;
      if (oldestKey) locationCache.delete(oldestKey);
    }
    locationCache.set(pincode, { location, expiresAt: Date.now() + CACHE_TTL_MS });
    return location;
  })();

  pendingLookups.set(pincode, lookup);
  try {
    return await lookup;
  } finally {
    pendingLookups.delete(pincode);
  }
};

exports.resolvePincode = resolvePincode;
exports.getLocationByPincode = async (req, res) => {
  try {
    const location = await resolvePincode(req.params.pincode);
    return res.json({ status: 'success', location });
  } catch (error) {
    if (error instanceof LocationLookupError) {
      return res.status(error.status).json({
        status: 'error',
        code: error.code,
        message: error.message,
      });
    }

    console.error('PIN code lookup failed:', error.message);
    return res.status(500).json({
      status: 'error',
      code: 'LOCATION_LOOKUP_FAILED',
      message: 'Unable to look up this PIN code right now. Please try again later.',
    });
  }
};
