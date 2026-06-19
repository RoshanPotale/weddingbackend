const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendorController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

// ============ PUBLIC ROUTES ============
router.get('/list', vendorController.getAllVendors);
router.get('/list/:id', vendorController.getVendorById);
router.get('/:vendorId/availability', vendorController.getVendorAvailability);
router.get('/:vendorId/reviews', vendorController.getReviews);

// ============ REVIEW ROUTES (user-only) ============
const userAuthMiddleware = (req, res, next) => {
  authMiddleware(req, res, () => {
    if (!req.user || req.user.role !== 'user') {
      return res.status(403).json({
        message: 'Only users can write reviews',
        userRole: req.user?.role || 'not authenticated',
      });
    }
    next();
  });
};

router.post('/:vendorId/reviews', userAuthMiddleware, vendorController.addReview);
router.put('/:vendorId/reviews/:reviewId', userAuthMiddleware, vendorController.updateReview);
router.delete('/:vendorId/reviews/:reviewId', userAuthMiddleware, vendorController.deleteReview);

// ============ PROTECTED VENDOR ROUTES ============
router.use(authMiddleware);
router.use(roleMiddleware(['vendor']));

// Profile
router.put('/profile', upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'introVideo', maxCount: 1 },
  { name: 'portfolioImages', maxCount: 20 },
  { name: 'aadhaarDocument', maxCount: 1 },
  { name: 'panDocument', maxCount: 1 },
  { name: 'gstDocument', maxCount: 1 },
]), vendorController.updateProfile);

// Leads & Requirements
router.get('/leads', vendorController.getLeads);
router.get('/requirements', vendorController.getRequirements);
router.get('/requirements/:requirementId', vendorController.viewRequirement);
router.get('/view-customer/:leadId', vendorController.viewCustomer);
router.post('/contact-customer/:leadId', vendorController.contactCustomer);
router.post('/leads/:leadId/quotation', upload.single('quotation'), vendorController.uploadQuotation);
router.post('/track-lead', vendorController.trackLead);

// Subscription
router.get('/subscription', vendorController.getSubscriptionStatus);
router.post('/activate-subscription', vendorController.activateSubscription);

// ============ SERVICES ROUTES ============
router.get('/services', vendorController.getServices);
router.post('/services', vendorController.addService);
router.put('/services/:serviceId', vendorController.updateService);
router.delete('/services/:serviceId', vendorController.deleteService);

// ============ FAQS ROUTES ============
router.get('/faqs', vendorController.getFaqs);
router.post('/faqs', vendorController.addFaq);
router.put('/faqs/:faqId', vendorController.updateFaq);
router.delete('/faqs/:faqId', vendorController.deleteFaq);

// ============ BOOKING ROUTES ============
router.post('/bookings', vendorController.createBooking);
router.get('/bookings', vendorController.getAllBookings);
router.get('/bookings/stats/summary', vendorController.getBookingStats);
router.get('/bookings/:bookingId', vendorController.getBookingById);
router.put('/bookings/:bookingId', vendorController.updateBooking);
router.delete('/bookings/:bookingId', vendorController.deleteBooking);
router.post('/bookings/:bookingId/payment', vendorController.addPayment);
router.get('/bookings/:bookingId/payment-history', vendorController.getPaymentHistory);

// ============ PACKAGE ROUTES ============
router.get('/packagesDetails', vendorController.getpackagesDetails);
router.put('/packagesDetails/:type', vendorController.updatePackage);
router.post('/packagesDetails/:type/items', vendorController.addPackageItem);
router.put('/packagesDetails/:type/items/:itemId', vendorController.updatePackageItem);
router.delete('/packagesDetails/:type/items/:itemId', vendorController.deletePackageItem);

module.exports = router;