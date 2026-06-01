const mongoose = require("mongoose");

const vendorSchema = new mongoose.Schema(
  {
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
      ref: "Category",
      required: true,
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubCategory",
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
    // Social Media Links
    instagram: {
      type: String,
    },
    facebook: {
      type: String,
    },
    youtube: {
      type: String,
    },
    linkedin: {
      type: String,
    },
    twitter: {
      type: String,
    },
    pricingRange: {
      type: String,
      required: true,
    },
    perPlateCharge: {
      type: Number, // Optional field for per plate charge
    },
    profileImage: {
      type: String, // Cloudinary URL
    },
    portfolioImages: [
      {
        type: String, // Cloudinary URLs
      },
    ],
    // Documents with ID and URL
    aadhaarDocument: {
      documentId: String, // Aadhaar ID number
      documentUrl: String, // Cloudinary URL
    },
    panDocument: {
      documentId: String, // PAN ID number
      documentUrl: String, // Cloudinary URL
    },
    gstDocument: {
      documentId: String, // GST ID number
      documentUrl: String, // Cloudinary URL
    },
    // Relationships
    createdByEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
    managerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Manager",
    },
    // Status
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
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
      enum: ["inactive", "active", "expired"],
      default: "inactive",
    },
    // Leads
    leadsCount: {
      type: Number,
      default: 0,
    },
    vendorLeads: [
      {
        requirementId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Requirement",
        },
        leadId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Lead",
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
          enum: [
            "customerViewedVendor",
            "vendorViewedCustomer",
            "vendorContactedCustomer",
            "customerContactedVendor",
          ],
          required: true,
        },
      },
    ],
    // Category specific fields
    categorySpecificFields: {
      type: mongoose.Schema.Types.Mixed, // For dynamic fields like photographer services, makeup prices, etc.
    },

    

    // Booking Details
    bookings: [
      {
        bookingDate: {
          type: Date,
          required: true,
        },
        customerName: {
          type: String,
          required: true,
        },
        contactNumber: {
          type: String,
          required: true,
        },
        bookingFrom: {
          type: String,
          required: true,
        },
        bookingAmount: {
          type: Number,
          default: null,
        },
        paidAmount: {
          type: Number,
          default: 0,
        },
        remainingAmount: {
          type: Number,
          default: null,
        },
        paymentStatus: {
          type: String,
          enum: ["pending", "partial", "completed"],
          default: "pending",
        },
        paymentHistory: [
          {
            paymentDate: {
              type: Date,
              default: Date.now,
            },
            amountPaid: {
              type: Number,
              required: true,
            },
            paymentMethod: {
              type: String,
              enum: ["cash", "card", "upi", "bank_transfer", "cheque"],
              default: "cash",
            },
            transactionId: {
              type: String,
            },
            notes: {
              type: String,
            },
          },
        ],
        bookingStatus: {
          type: String,
          enum: ["upcoming", "completed", "cancelled"],
          default: "upcoming",
        },
        eventDate: {
          type: Date,
        },
        eventLocation: {
          type: String,
        },
        notes: {
          type: String,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    // Packages - For vendors offering packages (e.g., wedding planners, caterers)
    packagesDetails: {
      classic: {
        price: {
          type: Number,
          default: null,
        },
        items: [
          {
            name: {
              type: String,
              required: true,
            },
            description: {
              type: String,
              default: "",
            },
          },
        ],
      },

      signature: {
        price: {
          type: Number,
          default: null,
        },
        items: [
          {
            name: {
              type: String,
              required: true,
            },
            description: {
              type: String,
              default: "",
            },
          },
        ],
      },

      royal: {
        price: {
          type: Number,
          default: null,
        },
        items: [
          {
            name: {
              type: String,
              required: true,
            },
            description: {
              type: String,
              default: "",
            },
          },
        ],
      },
    },
    role: {
      type: String,
      default: "vendor",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Vendor", vendorSchema);
