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

const isVendorPubliclyVisible = (vendor) => {
  if (!vendor) return false;
  return vendor.status === 'approved' && vendor.subscriptionStatus === 'active';
};

const sanitizePublicVendor = (vendor) => {
  if (!vendor) return null;

  const vendorObj = vendor.toObject ? vendor.toObject() : { ...vendor };

  delete vendorObj.password;
  if (vendorObj.aadhaarDocument) delete vendorObj.aadhaarDocument.documentId;
  if (vendorObj.panDocument) delete vendorObj.panDocument.documentId;
  if (vendorObj.gstDocument) delete vendorObj.gstDocument.documentId;

  return vendorObj;
};

const calculateProfileCompletion = (vendor = {}) => {
  if (!vendor || typeof vendor !== 'object') return 0;

  const requiredFields = [
    'businessName', 'ownerName', 'phone', 'email', 'whatsapp', 'address', 'city', 'state',
    'category', 'subCategory', 'experience', 'teamSize', 'description', 'instagram',
    'facebook', 'youtube', 'linkedin', 'twitter', 'pricingRange', 'maximumCapacity',
    'profileImage', 'introVideo', 'portfolioImages', 'weddingsCovered', 'responseTime',
    'services', 'faqs', 'gpsLocationUrl', 'isDestinationWeddingAvailable', 'packagesDetails',
    'categorySpecificFields'
  ];

  let completed = 0;

  requiredFields.forEach((field) => {
    const value = vendor[field];

    if (field === 'portfolioImages' || field === 'services' || field === 'faqs' || field === 'packagesDetails') {
      if (Array.isArray(value) && value.length > 0) completed += 1;
      return;
    }

    if (field === 'categorySpecificFields') {
      const hasCategorySpecific = value && Object.values(value).some((entry) => {
        if (Array.isArray(entry)) return entry.length > 0;
        return entry !== undefined && entry !== null && entry !== '';
      });
      if (hasCategorySpecific) completed += 1;
      return;
    }

    if (field === 'category' || field === 'subCategory') {
      if (value && (value._id || value)) completed += 1;
      return;
    }

    if (value !== undefined && value !== null && value !== '' && !(typeof value === 'string' && value.trim() === '')) {
      completed += 1;
    }
  });

  return Math.min(100, Math.max(0, Math.round((completed / requiredFields.length) * 100)));
};

const getResponseTimeMinutes = (responseTime) => {
  if (typeof responseTime === 'number') return Number.isFinite(responseTime) ? responseTime : 120;
  if (!responseTime) return 120;

  const rawValue = Number(String(responseTime).replace(/[^\d.]/g, ''));
  if (!Number.isFinite(rawValue)) return 120;

  const normalized = String(responseTime).toLowerCase();
  if (normalized.includes('hour')) return rawValue * 60;
  if (normalized.includes('day')) return rawValue * 24 * 60;
  if (normalized.includes('minute')) return rawValue;

  return rawValue;
};

const calculateVendorScore = (vendor = {}) => {
  if (!vendor || typeof vendor !== 'object') return 0;

  const ratingScore = Number(vendor.averageRating || 0) * 100;
  const reviewScore = Number(vendor.reviewsCount || 0) * 5;
  const weddingsScore = Number(vendor.weddingsCovered || 0) * 3;
  const profileScore = Number(vendor.profileCompletionPercentage || 0) * 1.5;
  const verificationScore = vendor.isVerified ? 200 : 0;
  const subscriptionScore = vendor.subscriptionStatus === 'active' ? 100 : 0;
  const responsePenalty = getResponseTimeMinutes(vendor.responseTime || '2 hours');

  return ratingScore + reviewScore + weddingsScore + profileScore + verificationScore + subscriptionScore - responsePenalty;
};

const recalculateReviewStats = (vendor) => {
  if (!vendor) return vendor;

  const reviews = Array.isArray(vendor.reviews) ? vendor.reviews : [];
  const reviewsCount = reviews.length;
  const averageRating = reviewsCount > 0
    ? reviews.reduce((sum, review) => sum + Number(review.ratings || 0), 0) / reviewsCount
    : 0;

  vendor.reviewsCount = reviewsCount;
  vendor.averageRating = Number(averageRating.toFixed(2));
  vendor.profileCompletionPercentage = calculateProfileCompletion(vendor);
  vendor.isVerified = Boolean(vendor.isVerified || vendor.profileCompletionPercentage >= 70);

  return vendor;
};

// Auto-update vendor subscription status if expired
const updateExpiredSubscriptions = async (vendor) => {
  if (!vendor) return vendor;
  
  const now = new Date();
  
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
  isVendorPubliclyVisible,
  sanitizePublicVendor,
  calculateProfileCompletion,
  calculateVendorScore,
  recalculateReviewStats,
  checkVendorSubscription,
  updateExpiredSubscriptions,
  trackVendorLead,
};