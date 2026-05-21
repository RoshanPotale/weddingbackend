const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const upload = require('../config/multer');

// ===== REGISTRATION ROUTES =====
router.post('/admin-register', authController.adminRegister);
router.post('/user-register', authController.userRegister);
router.post('/vendor-register', 
  upload.fields([
    { name: 'aadhaarDocument', maxCount: 1 },
    { name: 'panDocument', maxCount: 1 },
    { name: 'gstDocument', maxCount: 1 },
  ]),
  authController.vendorRegister
);

// ===== LOGIN ROUTES =====
router.post('/admin-login', authController.adminLogin);
router.post('/manager-login', authController.managerLogin);
router.post('/employee-login', authController.employeeLogin);
router.post('/vendor-login', authController.vendorLogin);
router.post('/user-login', authController.userLogin);

module.exports = router;