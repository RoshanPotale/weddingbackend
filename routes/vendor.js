const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

// Public routes - list all vendors (no auth required)
router.get('/list', vendorController.getAllVendors);
router.get('/list/:id', vendorController.getVendorById);

// Protected routes - vendor specific operations
router.use(authMiddleware);
router.use(roleMiddleware(['vendor']));

router.get('/leads', vendorController.getLeads);
router.get('/requirements', vendorController.getRequirements);
router.get('/requirements/:requirementId', vendorController.viewRequirement);
router.get('/subscription', vendorController.getSubscriptionStatus);
router.post('/activate-subscription', vendorController.activateSubscription);
router.get('/view-customer/:leadId', vendorController.viewCustomer);
router.post('/contact-customer/:leadId', vendorController.contactCustomer);
router.post('/leads/:leadId/quotation', upload.single('quotation'), vendorController.uploadQuotation);
router.post('/track-lead', vendorController.trackLead);

module.exports = router;