const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

// Dashboard
router.get('/stats', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers);
router.get('/employees', adminController.getAllEmployees);

// Manager management
router.post('/create-manager', adminController.createManager);
router.get('/managers', adminController.getManagers);

// Vendor management
router.get('/vendors', adminController.getVendors);
router.put('/vendor-approve/:vendorId', adminController.approveVendor);
router.put('/vendor-reject/:vendorId', adminController.rejectVendor);
router.put('/vendor-subscription/:vendorId', adminController.updateVendorSubscription);

module.exports = router;