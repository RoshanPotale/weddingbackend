const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  requirementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Requirement',
    required: true,
  },
  vendorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vendor',
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
  contactDate: {
    type: Date,
    default: Date.now,
  },
  contactType: {
    type: String,
    enum: ['customerViewedVendor', 'vendorViewedCustomer', 'vendorContactedCustomer'],
    required: true,
  },
  quotationUrl: {
    type: String,
  },
  quotationFileName: {
    type: String,
  },
  quotationUploadedAt: {
    type: Date,
  },
  quotationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedByUser: {
    type: Boolean,
    default: false,
  },
  approvedAt: {
    type: Date,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);