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
    const vendors = await Vendor.find({ status: 'approved' }).populate('category').select('-password');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id).populate('category').select('-password');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }
    res.json(vendor);
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
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Track view - check if vendor already viewed
    const vendorAlreadyViewed = requirement.viewedBy.some(v => v.vendorId?.toString() === req.user.id);
    
    if (!vendorAlreadyViewed) {
      requirement.views = (requirement.views || 0) + 1;
      requirement.viewedBy.push({ vendorId: req.user.id });
      await requirement.save();
    }

    const lead = new Lead({
      requirementId: requirement._id,
      vendorId: req.user.id,
      customerName: requirement.customerName,
      customerPhone: requirement.customerPhone,
      contactType: 'vendorViewedCustomer',
      quotationStatus: 'pending',
    });
    await lead.save();

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
          quoteStatus: 'pending',
          quotationUrl: null,
          quotationFileName: null,
          quotationUploadedAt: null,
          approvedByUser: false,
        },
      },
    });

    await trackVendorLead(
      req.user.id,
      requirement.customerName,
      requirement.customerPhone,
      'vendorViewedCustomer',
      requirement._id,
      lead._id
    );

    const populatedLead = await Lead.findById(lead._id).populate({
      path: 'requirementId',
      populate: { path: 'serviceCategory userId' }
    });

    const responseLead = populatedLead.toObject();
    if (responseLead.quotationStatus !== 'approved') {
      delete responseLead.customerPhone;
      if (responseLead.requirementId?.userId) {
        delete responseLead.requirementId.userId.phone;
      }
    }

    res.json(responseLead);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Only PDF quotation uploads are supported.' });
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
    const { businessName, ownerName, phone, whatsapp, address, city, experience, teamSize, description, pricingRange, perPlateCharge, aadhaarId, panId, gstId } = req.body;

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