const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

const vendorOnly = roleMiddleware(['vendor']);

// All authenticated users can access their own profile
router.use(authMiddleware);

// Get current user's profile
router.get('/', profileController.getProfile);

// Profile update routes - support different upload types based on role
router.put('/update', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'portfolioImages', maxCount: 10 },
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'panDocument', maxCount: 1 },
  { name: 'gstDocument', maxCount: 1 },
]), profileController.updateProfile);

// Delete a specific portfolio image
router.delete('/portfolio-image', profileController.deletePortfolioImage);

// Vendor package management (stored on vendor document by authenticated vendor id)
router.get('/packages', vendorOnly, vendorController.getpackagesDetails);
router.put('/packages/:type', vendorOnly, vendorController.updatePackage);
router.post('/packages/:type/items', vendorOnly, vendorController.addPackageItem);
router.put('/packages/:type/items/:itemId', vendorOnly, vendorController.updatePackageItem);
router.delete('/packages/:type/items/:itemId', vendorOnly, vendorController.deletePackageItem);

module.exports = router;