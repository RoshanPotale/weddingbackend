const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  customerName: {
    type: String,
    required: true,
  },
  customerPhone: {
    type: String,
    required: true,
  },
  serviceCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  eventDate: {
    type: Date,
    required: true,
  },
  budget: {
    type: Number,
    required: true,
  },
  guestCount: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  },
  views: {
    type: Number,
    default: 0,
  },
  viewedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
  }],
}, { timestamps: true });

module.exports = mongoose.model('Requirement', requirementSchema);