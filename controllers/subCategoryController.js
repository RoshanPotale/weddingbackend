const mongoose = require('mongoose');
const SubCategory = require('../models/SubCategory');
const Category = require('../models/Category');


// Create SubCategory
exports.createSubCategory = async (req, res) => {
  try {

    const { subCategoryName, description, categoryId } = req.body;

    if (!categoryId) {
      return res.status(400).json({ message: 'categoryId is required' });
    }

    // Check category exists
    const category = await Category.findById(categoryId);

    if (!category) {
      return res.status(404).json({
        message: 'Category not found'
      });
    }

    // Duplicate check
    const existingSubCategory = await SubCategory.findOne({
      subCategoryName: { $regex: new RegExp(`^${subCategoryName}$`, 'i') },
      category: categoryId
    });

    if (existingSubCategory) {
      return res.status(400).json({
        message: 'SubCategory already exists in this category'
      });
    }

    const subCategory = new SubCategory({
      subCategoryName,
      description,
      category: categoryId
    });

    await subCategory.save();

    res.status(201).json({
      message: 'SubCategory created successfully',
      subCategory
    });

  } catch (error) {
    console.error('Error creating subcategory:', error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Get all SubCategories
exports.getAllSubCategories = async (req, res) => {
  try {
    const subCategories = await SubCategory.find()
      .populate({
        path: 'category',
        select: 'categoryName description'
      })
      .sort({ createdAt: -1 })
      .lean();
      
    res.json(subCategories);
  } catch (error) {
    console.error('Error fetching all subcategories:', error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Get subcategories by category
exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: 'Invalid categoryId' });
    }

    const subCategories = await SubCategory.find({
      category: categoryId
    })
    .populate({
      path: 'category',
      select: 'categoryName'
    })
    .sort({ createdAt: -1 })
    .lean();
    
    res.json(subCategories);
  } catch (error) {
    console.error('Error fetching subcategories by category:', error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Get single subcategory
exports.getSubCategoryById = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: 'Invalid subCategoryId' });
    }

    const subCategory = await SubCategory.findById(subCategoryId)
      .populate({
        path: 'category',
        select: 'categoryName description'
      })
      .lean();

    if (!subCategory) {
      return res.status(404).json({
        message: 'SubCategory not found'
      });
    }

    res.json(subCategory);
  } catch (error) {
    console.error('Error fetching subcategory by id:', error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Update subcategory
exports.updateSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: 'Invalid subCategoryId' });
    }

    const {
      subCategoryName,
      description,
      categoryId
    } = req.body;

    const subCategory = await SubCategory.findById(subCategoryId);

    if (!subCategory) {
      return res.status(404).json({
        message: 'SubCategory not found'
      });
    }

    // Update fields
    if (subCategoryName) {
      subCategory.subCategoryName = subCategoryName;
    }

    if (description !== undefined) {
      subCategory.description = description;
    }

    if (categoryId) {
      if (!mongoose.Types.ObjectId.isValid(categoryId)) {
        return res.status(400).json({ message: 'Invalid categoryId' });
      }
      subCategory.category = categoryId;
    }

    await subCategory.save();

    res.json({
      message: 'SubCategory updated successfully',
      subCategory
    });
  } catch (error) {
    console.error('Error updating subcategory:', error);
    res.status(500).json({
      message: error.message
    });
  }
};


// Delete subcategory
exports.deleteSubCategory = async (req, res) => {
  try {
    const { subCategoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(subCategoryId)) {
      return res.status(400).json({ message: 'Invalid subCategoryId' });
    }

    const subCategory = await SubCategory.findById(subCategoryId);

    if (!subCategory) {
      return res.status(404).json({
        message: 'SubCategory not found'
      });
    }

    await SubCategory.findByIdAndDelete(subCategoryId);

    res.json({
      message: 'SubCategory deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({
      message: error.message
    });
  }
};