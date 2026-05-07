const mongoose = require('mongoose');

const subCategorySchema = new mongoose.Schema({
  subCategoryName: {
    type: String,
    required: true,
    trim: true,
  },

  description: {
    type: String,
    trim: true,
  },

  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },

}, { timestamps: true });

/**
 * Prevent duplicate subcategory inside same category
 * Example:
 * Electronics -> Mobile
 * Electronics -> Mobile (not allowed)
 */
subCategorySchema.index(
  { subCategoryName: 1, category: 1 },
  { unique: true }
);

module.exports = mongoose.model('SubCategory', subCategorySchema);