const Category = require('../models/Category');

// Create a new category (Admin only)
exports.createCategory = async (req, res) => {
  const { categoryName, description } = req.body;

  try {
    // Check if category already exists
    const existingCategory = await Category.findOne({ categoryName });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }

    const category = new Category({
      categoryName,
      description,
    });

    await category.save();
    res.status(201).json({
      message: 'Category created successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all categories
exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get category by ID
exports.getCategoryById = async (req, res) => {
  const { categoryId } = req.params;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.json(category);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update category (Admin only)
exports.updateCategory = async (req, res) => {
  const { categoryId } = req.params;
  const { categoryName, description } = req.body;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if new category name already exists (excluding current category)
    if (categoryName && categoryName !== category.categoryName) {
      const existingCategory = await Category.findOne({ categoryName });
      if (existingCategory) {
        return res.status(400).json({ message: 'Category name already exists' });
      }
      category.categoryName = categoryName;
    }

    if (description !== undefined) {
      category.description = description;
    }

    await category.save();
    res.json({
      message: 'Category updated successfully',
      category
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete category (Admin only)
exports.deleteCategory = async (req, res) => {
  const { categoryId } = req.params;

  try {
    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    await Category.findByIdAndDelete(categoryId);
    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};