const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
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
    state: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    profileImage: {
      type: String, // Cloudinary URL
    },
    role: {
      type: String,
      default: "user",
    },
    whitelistVendors: [
      {
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        addedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    leads: [
      {
        requirementId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Requirement",
        },
        leadId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lead",
        },
        vendorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Vendor",
        },
        customerName: String,
        customerPhone: String,
        contactDate: Date,
        contactType: String,
        status: {
          type: String,
          enum: ["open", "closed"],
          default: "open",
        },
        quoteStatus: {
          type: String,
          enum: ["pending", "approved", "rejected"],
          default: "pending",
        },
        quotationUrl: String,
        quotationFileName: String,
        quotationUploadedAt: Date,
        approvedByUser: {
          type: Boolean,
          default: false,
        },
        approvedAt: Date,
        closedAt: Date,
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
