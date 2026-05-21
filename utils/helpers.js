const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');

const matchVendorsToRequirement = async (requirement) => {
  const { serviceCategory, city } = requirement;
  const vendors = await Vendor.find({
    category: serviceCategory,
    city: city,
    status: 'approved',
  });
  return vendors;
};

// Auto-update vendor subscription status if expired
const updateExpiredSubscriptions = async (vendor) => {
  if (!vendor) return vendor;
  
  const now = new Date();
  
  // Check if subscription has expired
  if (vendor.subscriptionStatus === 'active' && vendor.subscriptionEndDate && now >= vendor.subscriptionEndDate) {
    vendor.subscriptionStatus = 'expired';
    try {
      await vendor.save();
    } catch (error) {
      console.error('Error updating vendor subscription status:', error);
    }
  }
  
  return vendor;
};

const checkVendorSubscription = async (vendor) => {
  if (!vendor) return false;
  const now = new Date();

  if (vendor.subscriptionStatus === 'active' && vendor.subscriptionEndDate && now < vendor.subscriptionEndDate) {
    return true;
  }

  if (vendor.subscriptionStatus === 'active' && vendor.subscriptionEndDate && now >= vendor.subscriptionEndDate) {
    // mark as expired when end date is reached
    vendor.subscriptionStatus = 'expired';
    await vendor.save();
  }

  return false;
};

const trackVendorLead = async (
  vendorId,
  customerName,
  customerPhone,
  contactType,
  requirementId = null,
  leadId = null
) => {
  if (requirementId) {
    const updatedVendor = await Vendor.findOneAndUpdate(
      { _id: vendorId, 'vendorLeads.requirementId': requirementId },
      {
        $set: {
          'vendorLeads.$.leadId': leadId,
          'vendorLeads.$.customerName': customerName,
          'vendorLeads.$.customerPhone': customerPhone,
          'vendorLeads.$.contactDate': new Date(),
          'vendorLeads.$.contactType': contactType,
        },
      },
      { new: true }
    );

    if (updatedVendor) {
      return updatedVendor;
    }
  }

  await Vendor.findByIdAndUpdate(vendorId, {
    $inc: { leadsCount: 1 },
    $push: {
      vendorLeads: {
        requirementId,
        leadId,
        customerName,
        customerPhone,
        contactDate: new Date(),
        contactType,
      },
    },
  });
};

module.exports = {
  matchVendorsToRequirement,
  checkVendorSubscription,
  updateExpiredSubscriptions,
  trackVendorLead,
};