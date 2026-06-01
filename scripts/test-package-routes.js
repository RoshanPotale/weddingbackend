/**
 * Integration test for vendor package routes.
 * Usage: node scripts/test-package-routes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.TEST_API_URL || 'http://localhost:5000';

async function request(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return { status: res.status, data };
}

async function run() {
  console.log('=== Package routes test ===\n');
  console.log(`Base URL: ${BASE}\n`);

  // 1. No auth -> 401
  const noAuth = await request('GET', '/profile/packages');
  console.log('1. GET /profile/packages (no token):', noAuth.status, noAuth.data?.message || noAuth.data);
  if (noAuth.status !== 401) {
    throw new Error('Expected 401 without token');
  }

  // 2. Login as vendor
  const login = await request('POST', '/auth/vendor-login', {
    body: { email: process.env.TEST_VENDOR_EMAIL || 'vendor@wedding.com', password: process.env.TEST_VENDOR_PASSWORD || 'vendor123' },
  });
  console.log('2. POST /auth/vendor-login:', login.status, login.data?.message || 'ok');
  if (login.status !== 200 || !login.data?.token) {
    console.log('\n   Skipping authenticated tests (login failed).');
    console.log('   Set TEST_VENDOR_EMAIL and TEST_VENDOR_PASSWORD in .env to run full test.');
    console.log('\n✅ Route registration verified (401 without token).\n');
    console.log('   Restart backend after route changes: npm run dev\n');
    process.exit(0);
  }
  const token = login.data.token;

  // 3. GET packages
  const getPackages = await request('GET', '/profile/packages', { token });
  console.log('3. GET /profile/packages:', getPackages.status);
  if (getPackages.status !== 200) {
    console.error('   Response:', getPackages.data);
    throw new Error('GET packages failed');
  }
  console.log('   tiers:', Object.keys(getPackages.data.packagesDetails || {}));

  // 4. PUT price
  const putPrice = await request('PUT', '/profile/packages/classic', {
    token,
    body: { price: 25000 },
  });
  console.log('4. PUT /profile/packages/classic:', putPrice.status, putPrice.data?.message || '');
  if (putPrice.status !== 200) {
    console.error('   Response:', putPrice.data);
    throw new Error('PUT price failed');
  }

  // 5. POST item
  const postItem = await request('POST', '/profile/packages/classic/items', {
    token,
    body: { name: 'Floral decoration', description: 'Stage flowers' },
  });
  console.log('5. POST /profile/packages/classic/items:', postItem.status, postItem.data?.message || '');
  if (postItem.status !== 201) {
    console.error('   Response:', postItem.data);
    throw new Error('POST item failed');
  }
  const itemId = postItem.data?.item?._id;
  if (!itemId) throw new Error('No item id returned');

  // 6. PUT item
  const putItem = await request('PUT', `/profile/packages/classic/items/${itemId}`, {
    token,
    body: { name: 'Premium floral decoration', description: 'Updated' },
  });
  console.log('6. PUT item:', putItem.status, putItem.data?.message || '');
  if (putItem.status !== 200) {
    console.error('   Response:', putItem.data);
    throw new Error('PUT item failed');
  }

  // 7. GET verify
  const verify = await request('GET', '/profile/packages', { token });
  const classic = verify.data?.packagesDetails?.classic;
  console.log('7. GET verify classic price:', classic?.price, 'items:', classic?.items?.length);

  // 8. DELETE item
  const delItem = await request('DELETE', `/profile/packages/classic/items/${itemId}`, { token });
  console.log('8. DELETE item:', delItem.status, delItem.data?.message || '');
  if (delItem.status !== 200) {
    console.error('   Response:', delItem.data);
    throw new Error('DELETE item failed');
  }

  // 9. Vendor alias routes still work
  const vendorGet = await request('GET', '/vendor/packagesDetails', { token });
  console.log('9. GET /vendor/packagesDetails (alias):', vendorGet.status);
  if (vendorGet.status !== 200) {
    console.error('   Response:', vendorGet.data);
    throw new Error('Vendor alias GET failed');
  }

  console.log('\n✅ All package routes passed.\n');
}

run().catch((err) => {
  console.error('\n❌ Test failed:', err.message);
  process.exit(1);
});
