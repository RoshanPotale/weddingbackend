const Requirement = require('../models/Requirement');
const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Category = require('../models/Category');
const { matchVendorsToRequirement, trackVendorLead } = require('../utils/helpers');

exports.postRequirement = async (req, res) => {
  const { customerName, customerPhone, serviceCategory, city, eventDate, budget, guestCount, description } = req.body;
  try {
    // Find category by name or use ObjectId directly
    let categoryId = serviceCategory;
    if (typeof serviceCategory === 'string' && serviceCategory.length > 10) {
      categoryId = serviceCategory;
    } else {
      const categoryDoc = await Category.findOne({ categoryName: serviceCategory });
      if (!categoryDoc) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      categoryId = categoryDoc._id;
    }

    const requirement = new Requirement({
      userId: req.user.id,
      customerName,
      customerPhone,
      serviceCategory: categoryId,
      city,
      eventDate,
      budget,
      guestCount,
      description,
    });
    await requirement.save();

    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewVendors = async (req, res) => {
  const { category, city } = req.query;
  try {
    const query = { status: 'approved' };

    if (category) {
      query.category = category; // category should be ObjectId
    }

    if (city) {
      query.city = city;
    }

    const vendors = await Vendor.find(query).populate('category');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.viewVendorDetails = async (req, res) => {
  const { vendorId } = req.params;
  try {
    const vendor = await Vendor.findById(vendorId).populate('category');
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const customerName = currentUser.name;
    const customerPhone = currentUser.phone;

    // Track customer viewed vendor and save to user's direct leads
    await trackVendorLead(vendorId, customerName, customerPhone, 'customerViewedVendor');
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        leads: {
          vendorId,
          customerName,
          customerPhone,
          contactDate: new Date(),
          contactType: 'customerViewedVendor',
          status: 'open',
        },
      },
    });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserRequirements = async (req, res) => {
  try {
    const requirements = await Requirement.find({ userId: req.user.id }).populate('serviceCategory');
    res.json(requirements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserLeads = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate({ path: 'leads.vendorId', select: '-password' })
      .populate({ path: 'leads.requirementId', populate: { path: 'serviceCategory' } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user.leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.contactVendor = async (req, res) => {
  const { vendorId, customerName, customerPhone } = req.body;
  try {
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const nameToSave = customerName || currentUser.name;
    const phoneToSave = customerPhone || currentUser.phone;

    await trackVendorLead(vendorId, nameToSave, phoneToSave, 'customerContactedVendor');
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        leads: {
          vendorId,
          customerName: nameToSave,
          customerPhone: phoneToSave,
          contactDate: new Date(),
          contactType: 'customerContactedVendor',
          status: 'open',
        },
      },
    });
    res.json({ message: 'Vendor contact tracked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveQuotation = async (req, res) => {
  const { leadId } = req.params;
  try {
    const lead = await Lead.findById(leadId).populate('requirementId');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    if (!lead.requirementId || lead.requirementId.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to approve this quotation.' });
    }

    if (!lead.quotationUrl) {
      return res.status(400).json({ message: 'No quotation has been uploaded for this lead.' });
    }

    lead.quotationStatus = 'approved';
    lead.approvedByUser = true;
    lead.approvedAt = new Date();
    lead.status = 'open';
    await lead.save();

    await User.findOneAndUpdate(
      { _id: req.user.id, 'leads.leadId': lead._id },
      {
        $set: {
          'leads.$.quoteStatus': 'approved',
          'leads.$.approvedByUser': true,
          'leads.$.approvedAt': lead.approvedAt,
        },
      }
    );

    res.json({ message: 'Quotation approved', lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.closeUserLead = async (req, res) => {
  const { leadId } = req.params;
  try {
    let user = await User.findOneAndUpdate(
      { _id: req.user.id, 'leads.leadId': leadId },
      {
        $set: {
          'leads.$.status': 'closed',
          'leads.$.closedAt': new Date(),
        },
      },
      { new: true }
    );

    if (!user) {
      user = await User.findOneAndUpdate(
        { _id: req.user.id, 'leads._id': leadId },
        {
          $set: {
            'leads.$.status': 'closed',
            'leads.$.closedAt': new Date(),
          },
        },
        { new: true }
      );
    }

    if (!user) {
      return res.status(404).json({ message: 'Lead not found for this user' });
    }

    const closedLead = user.leads.find((lead) =>
      (lead.leadId && lead.leadId.toString() === leadId) || lead._id.toString() === leadId
    );

    const leadRecordId = closedLead?.leadId?.toString() || leadId;
    await Lead.findByIdAndUpdate(leadRecordId, { status: 'closed' });

    res.json({ message: 'Lead closed', lead: closedLead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRequirementQuotations = async (req, res) => {
  const { requirementId } = req.params;
  console.log('getRequirementQuotations called with requirementId:', requirementId);
  console.log('User:', req.user);

  try {
    const requirement = await Requirement.findById(requirementId).populate({
      path: 'viewedBy.vendorId',
      select: 'businessName description minPrice maxPrice category phone email',
    }).populate({
      path: 'viewedBy.leadId',
    });

    console.log('Requirement found:', !!requirement);

    if (!requirement) {
      console.log('Requirement not found');
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Check if current user owns this requirement
    if (requirement.userId.toString() !== req.user.id) {
      console.log('User not authorized. Requirement userId:', requirement.userId, 'Request userId:', req.user.id);
      return res.status(403).json({ message: 'Not authorized to view quotations for this requirement' });
    }

    console.log('User authorized, processing quotations');

    // Filter viewedBy to only include entries with quotations
    const quotations = requirement.viewedBy
      .filter(entry => entry.quotationUrl)
      .map(entry => ({
        vendorId: entry.vendorId,
        quotationUrl: entry.quotationUrl,
        quotationFileName: entry.quotationFileName,
        quotationUploadedAt: entry.quotationUploadedAt,
        leadId: entry.leadId,
      }));

    console.log('Quotations found:', quotations.length);

    res.json({
      requirement: {
        _id: requirement._id,
        description: requirement.description,
        budget: requirement.budget,
        city: requirement.city,
        eventDate: requirement.eventDate,
        customerName: requirement.customerName,
      },
      quotations,
    });
  } catch (error) {
    console.error('Error in getRequirementQuotations:', error);
    res.status(500).json({ message: error.message });
  }
};