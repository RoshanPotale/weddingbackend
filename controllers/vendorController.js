const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Requirement = require('../models/Requirement');
const { checkVendorSubscription, trackVendorLead } = require('../utils/helpers');

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
    const vendor = await Vendor.findById(req.user.id)
      .populate({ path: 'vendorLeads.requirementId', populate: { path: 'serviceCategory' } });
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    const isSubscribed = await checkVendorSubscription(vendor);
    if (!isSubscribed) {
      return res.status(403).json({ message: 'Your subscription has expired or is inactive.' });
    }

    res.json(vendor.vendorLeads || []);
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

    // Track view
    if (!requirement.viewedBy.includes(req.user.id)) {
      requirement.views = (requirement.views || 0) + 1;
      requirement.viewedBy.push(req.user.id);
      await requirement.save();
    }

    const lead = new Lead({
      requirementId: requirement._id,
      vendorId: req.user.id,
      customerName: requirement.customerName,
      customerPhone: requirement.customerPhone,
      contactType: 'vendorViewedCustomer',
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

    res.json(populatedLead);
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

exports.trackLead = async (req, res) => {
  const { vendorId, customerName, customerPhone, contactType, requirementId, leadId } = req.body;
  try {
    await trackVendorLead(vendorId, customerName, customerPhone, contactType, requirementId, leadId);
    res.json({ message: 'Lead tracked successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};