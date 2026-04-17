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
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'open',
  },
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);