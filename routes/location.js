const express = require('express');
const locationController = require('../controllers/locationController');

const router = express.Router();

router.get('/pincode/:pincode', locationController.getLocationByPincode);

module.exports = router;
