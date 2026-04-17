const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

router.use(authMiddleware);
router.use(roleMiddleware(['employee']));

router.post('/create-vendor', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'portfolioImages', maxCount: 10 },
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'panDocument', maxCount: 1 },
  { name: 'gstDocument', maxCount: 1 },
]), employeeController.createVendor);

module.exports = router;