const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  businessName: {
    type: String,
    required: true,
  },
  ownerName: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  whatsapp: {
    type: String,
  },
  address: {
    type: String,
    required: true,
  },
  city: {
    type: String,
    required: true,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
  },
  experience: {
    type: Number,
    required: true,
  },
  teamSize: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
  },
  pricingRange: {
    type: String,
    required: true,
  },
  profileImage: {
    type: String, // Cloudinary URL
  },
  portfolioImages: [{
    type: String, // Cloudinary URLs
  }],
  // Documents
  aadhaarDocument: {
    type: String, // Cloudinary URL
  },
  panDocument: {
    type: String, // Cloudinary URL
  },
  gstDocument: {
    type: String, // Cloudinary URL
  },
  // Relationships
  createdByEmployeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manager',
  },
  // Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
  },
  // Subscription
  subscriptionPlan: {
    type: String,
  },
  subscriptionStartDate: {
    type: Date,
  },
  subscriptionEndDate: {
    type: Date,
  },
  subscriptionStatus: {
    type: String,
    enum: ['inactive', 'active', 'expired'],
    default: 'inactive',
  },
  // Leads
  leadsCount: {
    type: Number,
    default: 0,
  },
  vendorLeads: [{
    requirementId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Requirement',
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
    },
    customerName: {
      type: String,
    },
    customerPhone: {
      type: String,
    },
    contactDate: {
      type: Date,
      default: Date.now,
    },
    contactType: {
      type: String,
      enum: ['customerViewedVendor', 'vendorViewedCustomer', 'vendorContactedCustomer', 'customerContactedVendor'],
      required: true,
    },
  }],
  // Category specific fields
  categorySpecificFields: {
    type: mongoose.Schema.Types.Mixed, // For dynamic fields like photographer services, makeup prices, etc.
  },
  role: {
    type: String,
    default: 'vendor',
  },
}, { timestamps: true });

module.exports = mongoose.model('Vendor', vendorSchema);