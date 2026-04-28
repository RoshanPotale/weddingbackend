const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const upload = require('../config/multer');

router.use(authMiddleware);
router.use(roleMiddleware(['manager']));

router.post('/create-employee', managerController.createEmployee);
router.get('/employees', managerController.getEmployees);
router.get('/vendors', managerController.getVendors);

module.exports = router;