const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

// Public routes - list all vendors (no auth required)
router.get('/list', vendorController.getAllVendors);
router.get('/list/:id', vendorController.getVendorById);
router.get('/:vendorId/availability', vendorController.getVendorAvailability);

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

// ============ BOOKING MANAGEMENT ROUTES ============

// Booking CRUD operations
router.post('/bookings', vendorController.createBooking);
router.get('/bookings', vendorController.getAllBookings);
router.get('/bookings/stats/summary', vendorController.getBookingStats);
router.get('/bookings/:bookingId', vendorController.getBookingById);
router.put('/bookings/:bookingId', vendorController.updateBooking);
router.delete('/bookings/:bookingId', vendorController.deleteBooking);

// Payment management
router.post('/bookings/:bookingId/payment', vendorController.addPayment);
router.get('/bookings/:bookingId/payment-history', vendorController.getPaymentHistory);

// ============ PACKAGE MANAGEMENT ROUTES ============
router.get('/packagesDetails', vendorController.getpackagesDetails);
router.put('/packagesDetails/:type', vendorController.updatePackage);
router.post('/packagesDetails/:type/items', vendorController.addPackageItem);
router.put('/packagesDetails/:type/items/:itemId', vendorController.updatePackageItem);
router.delete('/packagesDetails/:type/items/:itemId', vendorController.deletePackageItem);


module.exports = router;