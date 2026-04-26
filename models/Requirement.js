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
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    quotationUrl: String,
    quotationFileName: String,
    quotationUploadedAt: Date,
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
    },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Requirement', requirementSchema);