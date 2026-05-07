const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/auth');
const upload = require('../config/multer');

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

module.exports = router;