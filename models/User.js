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
    addressLine: {
      type: String,
      required: true,
    },
    landmark: {
      type: String,
    },
    village: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    district: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
      match: /^[1-9][0-9]{5}$/,
    },
    // coordinates: {
    //   type: {
    //     type: String,
    //     enum: ["Point"],
    //     default: "Point",
    //   },

    //   coordinates: {
    //     type: [Number],
    //     default: undefined,
    //     validate: {
    //       validator: function (value) {
    //         if (!value || value.length === 0) return true;

    //         return (
    //           value.length === 2 &&
    //           value[0] >= -180 &&
    //           value[0] <= 180 &&
    //           value[1] >= -90 &&
    //           value[1] <= 90
    //         );
    //       },
    //       message: "Invalid longitude or latitude",
    //     },
    //   },
    // },
    dateOfBirth: {
      type: Date,
    },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed"],
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    occupation: {
      type: String,
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
        bundleId: String,
        bundleDetails: {
          city: String,
          eventDate: Date,
          guestCount: Number,
          estimatedTotal: Number,
          serviceName: String,
        },
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
