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
    // Track customer viewed vendor and save to user's direct leads
    await trackVendorLead(vendorId, req.user.name, req.user.phone, 'customerViewedVendor');
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        leads: {
          vendorId,
          customerName: req.user.name,
          customerPhone: req.user.phone,
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
      .populate({ path: 'leads.vendorId' })
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
    await trackVendorLead(vendorId, customerName, customerPhone, 'customerContactedVendor');
    await User.findByIdAndUpdate(req.user.id, {
      $push: {
        leads: {
          vendorId,
          customerName,
          customerPhone,
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