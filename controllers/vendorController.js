const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Requirement = require('../models/Requirement');
const upload = require('../config/multer');
const cloudinary = require('../config/cloudinary');
const { checkVendorSubscription, trackVendorLead } = require('../utils/helpers');

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploader = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploader.end(buffer);
  });
};

// Public vendor listing endpoints
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find({ status: 'approved' })
      .populate('category')
      .populate('subCategory')
      .select('-password')
      .lean();
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate('category')
      .populate('subCategory')
      .select('-password')
      .lean();
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Public endpoint - get vendor booking availability
exports.getVendorAvailability = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId).select('bookings');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    
    // Filter bookings to show only relevant details (don't expose sensitive info)
    const availability = {
      vendorId: vendor._id,
      bookings: vendor.bookings.map(booking => ({
        _id: booking._id,
        bookingDate: booking.bookingDate,
        eventDate: booking.eventDate,
        customerName: booking.customerName,
        contactNumber: booking.contactNumber,
        bookingFrom: booking.bookingFrom,
        eventLocation: booking.eventLocation,
        bookingAmount: booking.bookingAmount,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus
      }))
    };
    
    res.json(availability);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Protected vendor endpoints
exports.getLeads = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const isSubscribed = await checkVendorSubscription(vendor);
    if (!isSubscribed) {
      return res.status(403).json({ message: 'Your subscription has expired or is inactive.' });
    }

    const leads = await Lead.find({ vendorId: req.user.id })
      .populate({ path: 'requirementId', populate: { path: 'serviceCategory userId' } });

    const sanitizedLeads = leads.map((lead) => {
      const leadObj = lead.toObject();
      // Check if this vendor's quotation is approved by the user in the Requirement model
      const viewedByEntry = leadObj.requirementId?.viewedBy?.find(
        (viewed) => viewed.vendorId.toString() === req.user.id.toString()
      );
      const isApproved = viewedByEntry?.approvedByUser || false;
      
      // Only show customer phone if user approved this vendor's quotation
      if (!isApproved) {
        delete leadObj.customerPhone;
      }
      return leadObj;
    });

    res.json(sanitizedLeads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSubscriptionStatus = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const active = await checkVendorSubscription(vendor);
    res.json({
      subscriptionStatus: vendor.subscriptionStatus,
      subscriptionPlan: vendor.subscriptionPlan || null,
      subscriptionStartDate: vendor.subscriptionStartDate || null,
      subscriptionEndDate: vendor.subscriptionEndDate || null,
      isActive: active,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.activateSubscription = async (req, res) => {
  const { subscriptionPlan = 'standard', durationDays = 30 } = req.body;

  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    if (vendor.status !== 'approved') {
      return res.status(403).json({ message: 'Vendor must be approved before activating subscription.' });
    }

    const now = new Date();
    const endDate = new Date(now);
    endDate.setDate(endDate.getDate() + Number(durationDays));

    vendor.subscriptionStatus = 'active';
    vendor.subscriptionPlan = subscriptionPlan;
    vendor.subscriptionStartDate = now;
    vendor.subscriptionEndDate = endDate;

    await vendor.save();

    res.json({
      message: 'Subscription activated successfully.',
      subscriptionStatus: vendor.subscriptionStatus,
      subscriptionPlan: vendor.subscriptionPlan,
      subscriptionStartDate: vendor.subscriptionStartDate,
      subscriptionEndDate: vendor.subscriptionEndDate,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRequirements = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const requirements = await Requirement.find({})
      .populate('serviceCategory')
      .populate('userId', 'name phone email city');

    res.json(requirements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewRequirement = async (req, res) => {
  const { requirementId } = req.params;

  try {
    const requirement = await Requirement.findById(requirementId);

    if (!requirement) {
      return res.status(404).json({
        message: "Requirement not found",
      });
    }

    /*
    STEP 1:
    Check if lead already exists
    */

    let existingLead = await Lead.findOne({
      requirementId: requirement._id,
      vendorId: req.user.id,
    }).populate({
      path: "requirementId",
      populate: {
        path: "serviceCategory userId",
      },
    });

    /*
    STEP 2:
    If already exists → return existing lead
    */

    if (existingLead) {
      const responseLead = existingLead.toObject();

      if (responseLead.quotationStatus !== "approved") {
        delete responseLead.customerPhone;

        if (responseLead.requirementId?.userId) {
          delete responseLead.requirementId.userId.phone;
        }
      }

      return res.json(responseLead);
    }

    /*
    STEP 3:
    First time only → increment views
    */

    const vendorAlreadyViewed = requirement.viewedBy.some(
      (v) => v.vendorId?.toString() === req.user.id
    );

    if (!vendorAlreadyViewed) {
      requirement.views = (requirement.views || 0) + 1;

      requirement.viewedBy.push({
        vendorId: req.user.id,
      });

      await requirement.save();
    }

    /*
    STEP 4:
    Create lead only once
    */

    const lead = await Lead.create({
      requirementId: requirement._id,
      vendorId: req.user.id,
      customerName: requirement.customerName,
      customerPhone: requirement.customerPhone,
      contactType: "vendorViewedCustomer",
      quotationStatus: "pending",
    });

    /*
    STEP 5:
    Push to user leads only once
    */

    await User.findByIdAndUpdate(requirement.userId, {
      $push: {
        leads: {
          requirementId: requirement._id,
          leadId: lead._id,
          vendorId: req.user.id,
          customerName: requirement.customerName,
          customerPhone: requirement.customerPhone,
          contactDate: lead.contactDate,
          contactType: lead.contactType,
          status: lead.status,
          quoteStatus: "pending",
          quotationUrl: null,
          quotationFileName: null,
          quotationUploadedAt: null,
          approvedByUser: false,
        },
      },
    });

    // Update the requirement's viewedBy to include the leadId
    await Requirement.findByIdAndUpdate(
      requirement._id,
      {
        $set: {
          'viewedBy.$[elem].leadId': lead._id,
        },
      },
      {
        arrayFilters: [{ 'elem.vendorId': req.user.id }],
      }
    );

    await trackVendorLead(
      req.user.id,
      requirement.customerName,
      requirement.customerPhone,
      "vendorViewedCustomer",
      requirement._id,
      lead._id
    );

    const populatedLead = await Lead.findById(lead._id).populate({
      path: "requirementId",
      populate: {
        path: "serviceCategory userId",
      },
    });

    const responseLead = populatedLead.toObject();

    if (responseLead.quotationStatus !== "approved") {
      delete responseLead.customerPhone;

      if (responseLead.requirementId?.userId) {
        delete responseLead.requirementId.userId.phone;
      }
    }

    res.json(responseLead);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

exports.viewCustomer = async (req, res) => {
  const { leadId } = req.params;
  try {
    const lead = await Lead.findById(leadId).populate('requirementId');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    await trackVendorLead(req.user.id, lead.customerName, lead.customerPhone, 'vendorViewedCustomer', lead.requirementId, lead._id);

    if (lead.quotationStatus !== 'approved' && lead.contactType !== 'vendorContactedCustomer') {
      return res.status(403).json({ message: 'Customer contact information is only available after the quotation is approved or after contact is made.' });
    }

    res.json({ customerPhone: lead.customerPhone });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.contactCustomer = async (req, res) => {
  const { leadId } = req.params;
  try {
    const lead = await Lead.findById(leadId).populate('requirementId');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    lead.contactType = 'vendorContactedCustomer';
    await lead.save();
    await trackVendorLead(req.user.id, lead.customerName, lead.customerPhone, 'vendorContactedCustomer', lead.requirementId, lead._id);

    await User.findOneAndUpdate(
      { 'leads.leadId': lead._id },
      {
        $set: {
          'leads.$.contactType': 'vendorContactedCustomer',
        },
      }
    );

    res.json({ message: 'Contact recorded' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadQuotation = async (req, res) => {
  const { leadId } = req.params;
  try {
    const lead = await Lead.findById(leadId).populate('requirementId');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (lead.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You are not authorized to upload a quote for this lead.' });
    }

    // Check if quotation already exists
    if (lead.quotationUrl) {
      return res.status(400).json({ message: 'A quotation has already been uploaded for this lead. You cannot upload another one.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Quotation file is required.' });
    }

    // Check if the file is a PDF or an image
    const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only PDF and Image (JPEG, JPG, PNG) quotation uploads are supported.' });
    }

    const result = await uploadToCloudinary(req.file.buffer, `quotations/${req.user.id}`);

    lead.quotationUrl = result.secure_url;
    lead.quotationFileName = req.file.originalname;
    lead.quotationUploadedAt = new Date();
    lead.quotationStatus = 'pending';
    await lead.save();

    await User.findOneAndUpdate(
      { 'leads.leadId': lead._id },
      {
        $set: {
          'leads.$.quotationUrl': lead.quotationUrl,
          'leads.$.quotationFileName': lead.quotationFileName,
          'leads.$.quotationUploadedAt': lead.quotationUploadedAt,
          'leads.$.quoteStatus': 'pending',
        },
      }
    );

    // Update the requirement's viewedBy array with quotation info
    if (lead.requirementId) {
      const updateResult = await Requirement.updateOne(
        {
          _id: lead.requirementId._id,
          'viewedBy.vendorId': req.user.id,
        },
        {
          $set: {
            'viewedBy.$[elem].quotationUrl': lead.quotationUrl,
            'viewedBy.$[elem].quotationFileName': lead.quotationFileName,
            'viewedBy.$[elem].quotationUploadedAt': lead.quotationUploadedAt,
            'viewedBy.$[elem].leadId': lead._id,
          },
        },
        {
          arrayFilters: [{ 'elem.vendorId': req.user.id }],
        }
      );

      if (updateResult.matchedCount === 0) {
        await Requirement.findByIdAndUpdate(
          lead.requirementId._id,
          {
            $push: {
              viewedBy: {
                vendorId: req.user.id,
                quotationUrl: lead.quotationUrl,
                quotationFileName: lead.quotationFileName,
                quotationUploadedAt: lead.quotationUploadedAt,
                leadId: lead._id,
              },
            },
          }
        );
      }
    }

    res.json({ message: 'Quotation uploaded successfully', lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const updateFields = {};
    const { businessName, ownerName, phone, whatsapp, address, city, experience, teamSize, description, pricingRange, perPlateCharge, aadhaarId, panId, gstId, instagram, facebook, youtube, linkedin, twitter } = req.body;

    if (businessName) updateFields.businessName = businessName;
    if (ownerName) updateFields.ownerName = ownerName;
    if (phone) updateFields.phone = phone;
    if (whatsapp) updateFields.whatsapp = whatsapp;
    if (address) updateFields.address = address;
    if (city) updateFields.city = city;
    if (experience !== undefined) updateFields.experience = experience;
    if (teamSize !== undefined) updateFields.teamSize = teamSize;
    if (description) updateFields.description = description;
    if (pricingRange) updateFields.pricingRange = pricingRange;
    if (perPlateCharge !== undefined) updateFields.perPlateCharge = perPlateCharge;
    if (instagram !== undefined) updateFields.instagram = instagram;
    if (facebook !== undefined) updateFields.facebook = facebook;
    if (youtube !== undefined) updateFields.youtube = youtube;
    if (linkedin !== undefined) updateFields.linkedin = linkedin;
    if (twitter !== undefined) updateFields.twitter = twitter;

    if (req.files.profileImage) {
      const result = await uploadToCloudinary(req.files.profileImage[0].buffer, `vendors/profile/${req.user.id}`);
      updateFields.profileImage = result.secure_url;
    }

    if (req.files.portfolioImages) {
      const portfolioUrls = [];
      for (const file of req.files.portfolioImages) {
        const result = await uploadToCloudinary(file.buffer, `vendors/portfolio/${req.user.id}`);
        portfolioUrls.push(result.secure_url);
      }
      updateFields.portfolioImages = portfolioUrls;
    }

    if (req.files.aadhaarDocument) {
      const result = await uploadToCloudinary(req.files.aadhaarDocument[0].buffer, 'vendors/documents');
      updateFields.aadhaarDocument = {
        documentId: aadhaarId || '',
        documentUrl: result.secure_url
      };
    }

    if (req.files.panDocument) {
      const result = await uploadToCloudinary(req.files.panDocument[0].buffer, 'vendors/documents');
      updateFields.panDocument = {
        documentId: panId || '',
        documentUrl: result.secure_url
      };
    }

    if (req.files.gstDocument) {
      const result = await uploadToCloudinary(req.files.gstDocument[0].buffer, 'vendors/documents');
      updateFields.gstDocument = {
        documentId: gstId || '',
        documentUrl: result.secure_url
      };
    }

    const updatedVendor = await Vendor.findByIdAndUpdate(req.user.id, updateFields, { new: true }).populate('category');
    res.json({ message: 'Profile updated successfully', vendor: updatedVendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.trackLead = async (req, res) => {
  const { vendorId, customerName, customerPhone, contactType, requirementId, leadId } = req.body;
  try {
    await trackVendorLead(vendorId, customerName, customerPhone, contactType, requirementId, leadId);
    res.json({ message: 'Lead tracked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ BOOKING MANAGEMENT ENDPOINTS ============

/**
 * Create a new booking
 * POST /vendor/bookings
 */
exports.createBooking = async (req, res) => {
  try {
    const { bookingDate, customerName, contactNumber, bookingFrom, bookingAmount, eventDate, eventLocation, notes } = req.body;

    // Validate required fields
    if (!bookingDate || !customerName || !contactNumber || !bookingFrom) {
      return res.status(400).json({ 
        message: 'Missing required fields: bookingDate, customerName, contactNumber, bookingFrom' 
      });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Create new booking object
    const newBooking = {
      bookingDate: new Date(bookingDate),
      customerName,
      contactNumber,
      bookingFrom,
      bookingAmount: bookingAmount || null,
      paidAmount: 0,
      remainingAmount: bookingAmount ? bookingAmount : null,
      paymentStatus: 'pending',
      paymentHistory: [],
      bookingStatus: 'upcoming',
      eventDate: eventDate ? new Date(eventDate) : null,
      eventLocation: eventLocation || null,
      notes: notes || null,
    };

    vendor.bookings.push(newBooking);
    await vendor.save();

    res.status(201).json({
      message: 'Booking created successfully',
      booking: vendor.bookings[vendor.bookings.length - 1],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all bookings for a vendor
 * GET /vendor/bookings
 */
exports.getAllBookings = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id).select('bookings');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Sort bookings by date (latest first)
    const sortedBookings = vendor.bookings.sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));

    res.json({
      totalBookings: sortedBookings.length,
      bookings: sortedBookings,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get a specific booking
 * GET /vendor/bookings/:bookingId
 */
exports.getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const vendor = await Vendor.findById(req.user.id);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const booking = vendor.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update booking details
 * PUT /vendor/bookings/:bookingId
 */
exports.updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { customerName, contactNumber, bookingAmount, eventDate, eventLocation, notes, bookingStatus } = req.body;

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const booking = vendor.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Update fields
    if (customerName !== undefined) booking.customerName = customerName;
    if (contactNumber !== undefined) booking.contactNumber = contactNumber;
    if (eventDate !== undefined) booking.eventDate = eventDate ? new Date(eventDate) : null;
    if (eventLocation !== undefined) booking.eventLocation = eventLocation;
    if (notes !== undefined) booking.notes = notes;
    if (bookingStatus !== undefined) booking.bookingStatus = bookingStatus;

    // If booking amount is updated, recalculate remaining amount
    if (bookingAmount !== undefined) {
      booking.bookingAmount = bookingAmount;
      if (bookingAmount && booking.paidAmount) {
        booking.remainingAmount = bookingAmount - booking.paidAmount;
      } else if (bookingAmount) {
        booking.remainingAmount = bookingAmount;
      }
    }

    booking.updatedAt = new Date();
    await vendor.save();

    res.json({
      message: 'Booking updated successfully',
      booking,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add payment to a booking
 * POST /vendor/bookings/:bookingId/payment
 */
exports.addPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { amountPaid, paymentMethod = 'cash', transactionId, notes } = req.body;

    // Validate required fields
    if (!amountPaid) {
      return res.status(400).json({ message: 'Amount paid is required' });
    }

    if (amountPaid <= 0) {
      return res.status(400).json({ message: 'Amount paid must be greater than 0' });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const booking = vendor.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Validate against booking amount if set
    if (booking.bookingAmount) {
      const totalAfterPayment = booking.paidAmount + amountPaid;
      if (totalAfterPayment > booking.bookingAmount) {
        return res.status(400).json({
          message: `Payment exceeds booking amount. Remaining: ₹${booking.remainingAmount}`,
        });
      }
    }

    // Add payment to history
    const payment = {
      paymentDate: new Date(),
      amountPaid,
      paymentMethod,
      transactionId: transactionId || null,
      notes: notes || null,
    };

    booking.paymentHistory.push(payment);

    // Update paid amount
    booking.paidAmount += amountPaid;

    // Calculate remaining amount
    if (booking.bookingAmount) {
      booking.remainingAmount = booking.bookingAmount - booking.paidAmount;
    }

    // Update payment status
    if (booking.bookingAmount) {
      if (booking.remainingAmount === 0) {
        booking.paymentStatus = 'completed';
      } else if (booking.paidAmount > 0) {
        booking.paymentStatus = 'partial';
      } else {
        booking.paymentStatus = 'pending';
      }
    } else if (booking.paidAmount > 0) {
      booking.paymentStatus = 'partial';
    }

    booking.updatedAt = new Date();
    await vendor.save();

    res.status(201).json({
      message: 'Payment recorded successfully',
      booking,
      paymentDetails: {
        amountPaid,
        totalPaid: booking.paidAmount,
        totalBookingAmount: booking.bookingAmount,
        remainingAmount: booking.remainingAmount,
        paymentStatus: booking.paymentStatus,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get payment history for a booking
 * GET /vendor/bookings/:bookingId/payment-history
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const vendor = await Vendor.findById(req.user.id);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const booking = vendor.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.json({
      booking: {
        _id: booking._id,
        customerName: booking.customerName,
        bookingAmount: booking.bookingAmount,
        paidAmount: booking.paidAmount,
        remainingAmount: booking.remainingAmount,
        paymentStatus: booking.paymentStatus,
      },
      paymentHistory: booking.paymentHistory,
      summary: {
        totalPayments: booking.paymentHistory.length,
        totalAmountPaid: booking.paidAmount,
        totalAmountPending: booking.remainingAmount,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete a booking
 * DELETE /vendor/bookings/:bookingId
 */
exports.deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const vendor = await Vendor.findById(req.user.id);
    
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const booking = vendor.bookings.id(bookingId);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    vendor.bookings.id(bookingId).deleteOne();
    await vendor.save();

    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get booking statistics
 * GET /vendor/bookings/stats/summary
 */
exports.getBookingStats = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id).select('bookings');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const bookings = vendor.bookings;
    
    const stats = {
      totalBookings: bookings.length,
      upcomingBookings: bookings.filter(b => b.bookingStatus === 'upcoming').length,
      completedBookings: bookings.filter(b => b.bookingStatus === 'completed').length,
      cancelledBookings: bookings.filter(b => b.bookingStatus === 'cancelled').length,
      totalBookingAmount: bookings.reduce((sum, b) => sum + (b.bookingAmount || 0), 0),
      totalPaidAmount: bookings.reduce((sum, b) => sum + b.paidAmount, 0),
      totalPendingAmount: bookings.reduce((sum, b) => sum + (b.remainingAmount || 0), 0),
      paymentBreakdown: {
        completed: bookings.filter(b => b.paymentStatus === 'completed').length,
        partial: bookings.filter(b => b.paymentStatus === 'partial').length,
        pending: bookings.filter(b => b.paymentStatus === 'pending').length,
      },
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ============ PACKAGE MANAGEMENT ENDPOINTS ============

const PACKAGE_TYPES = ['classic', 'signature', 'royal'];

const defaultPackagesDetails = () => ({
  classic: { price: null, items: [] },
  signature: { price: null, items: [] },
  royal: { price: null, items: [] },
});

const ensurePackagesDetails = (vendor) => {
  if (!vendor.packagesDetails) {
    vendor.packagesDetails = defaultPackagesDetails();
    return vendor.packagesDetails;
  }

  PACKAGE_TYPES.forEach((type) => {
    if (!vendor.packagesDetails[type]) {
      vendor.packagesDetails[type] = { price: null, items: [] };
    } else {
      if (vendor.packagesDetails[type].price === undefined) {
        vendor.packagesDetails[type].price = null;
      }
      if (!Array.isArray(vendor.packagesDetails[type].items)) {
        vendor.packagesDetails[type].items = [];
      }
    }
  });

  return vendor.packagesDetails;
};

/**
 * Get all packagesDetails for a vendor
 * GET /vendor/packagesDetails
 */
exports.getpackagesDetails = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id).select('packagesDetails');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const packagesDetails = ensurePackagesDetails(vendor);
    if (vendor.isModified('packagesDetails')) {
      await vendor.save();
    }

    res.json({ packagesDetails });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update a package's price (classic / signature / royal)
 * PUT /vendor/packagesDetails/:type
 */
exports.updatePackage = async (req, res) => {
  try {
    const { type } = req.params;
    const { price } = req.body;

    if (!PACKAGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid package type. Must be one of: ${PACKAGE_TYPES.join(', ')}` });
    }

    if (price === undefined || price === null || Number.isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ message: 'A valid price (0 or more) is required' });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    ensurePackagesDetails(vendor);
    vendor.packagesDetails[type].price = Number(price);

    await vendor.save();

    res.json({
      message: `${type} package updated successfully`,
      package: vendor.packagesDetails[type],
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Add an item to a package
 * POST /vendor/packagesDetails/:type/items
 */
exports.addPackageItem = async (req, res) => {
  try {
    const { type } = req.params;
    const { name, description } = req.body;

    if (!PACKAGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid package type. Must be one of: ${PACKAGE_TYPES.join(', ')}` });
    }

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Item name is required' });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    ensurePackagesDetails(vendor);
    const newItem = { name: String(name).trim(), description: description ? String(description).trim() : '' };
    vendor.packagesDetails[type].items.push(newItem);
    await vendor.save();

    const addedItem = vendor.packagesDetails[type].items[vendor.packagesDetails[type].items.length - 1];

    res.status(201).json({
      message: 'Item added successfully',
      item: addedItem,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Update an item within a package
 * PUT /vendor/packagesDetails/:type/items/:itemId
 */
exports.updatePackageItem = async (req, res) => {
  try {
    const { type, itemId } = req.params;
    const { name, description } = req.body;

    if (!PACKAGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid package type. Must be one of: ${PACKAGE_TYPES.join(', ')}` });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    ensurePackagesDetails(vendor);
    const item = vendor.packagesDetails[type].items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (name !== undefined) {
      if (!String(name).trim()) {
        return res.status(400).json({ message: 'Item name is required' });
      }
      item.name = String(name).trim();
    }
    if (description !== undefined) item.description = String(description).trim();

    await vendor.save();

    res.json({
      message: 'Item updated successfully',
      item,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Delete an item from a package
 * DELETE /vendor/packagesDetails/:type/items/:itemId
 */
exports.deletePackageItem = async (req, res) => {
  try {
    const { type, itemId } = req.params;

    if (!PACKAGE_TYPES.includes(type)) {
      return res.status(400).json({ message: `Invalid package type. Must be one of: ${PACKAGE_TYPES.join(', ')}` });
    }

    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    ensurePackagesDetails(vendor);
    const item = vendor.packagesDetails[type].items.id(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    vendor.packagesDetails[type].items.id(itemId).deleteOne();
    await vendor.save();

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};