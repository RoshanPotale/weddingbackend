const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
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
  city: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    default: 'user',
  },
  leads: [
    {
      requirementId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Requirement',
      },
      leadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Lead',
      },
      vendorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vendor',
      },
      customerName: String,
      customerPhone: String,
      contactDate: Date,
      contactType: String,
      status: {
        type: String,
        enum: ['open', 'closed'],
        default: 'open',
      },
      closedAt: Date,
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);