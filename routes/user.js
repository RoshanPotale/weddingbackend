const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.use(authMiddleware);
router.use(roleMiddleware(['user']));

router.post('/post-requirement', userController.postRequirement);
router.get('/vendors', userController.viewVendors);
router.get('/vendor/:vendorId', userController.viewVendorDetails);
router.post('/contact-vendor', userController.contactVendor);
router.get('/requirements', userController.getUserRequirements);
router.get('/:userId/requirements', userController.getUserRequirements);
router.get('/leads', userController.getUserLeads);
router.put('/lead/:leadId/close', userController.closeUserLead);
router.put('/lead/:leadId/approve', userController.approveQuotation);

module.exports = router;