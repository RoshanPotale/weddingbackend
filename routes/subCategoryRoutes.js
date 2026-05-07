const express = require('express');

const router = express.Router();

const subCategoryController = require('../controllers/subCategoryController');

const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');


// Public Routes

router.get('/', subCategoryController.getAllSubCategories);

router.get(
  '/category/:categoryId',
  subCategoryController.getSubCategoriesByCategory
);

router.get(
  '/:subCategoryId',
  subCategoryController.getSubCategoryById
);


// Admin Routes

router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

router.post('/', subCategoryController.createSubCategory);

router.put(
  '/:subCategoryId',
  subCategoryController.updateSubCategory
);

router.delete(
  '/:subCategoryId',
  subCategoryController.deleteSubCategory
);

module.exports = router;