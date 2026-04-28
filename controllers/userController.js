const Requirement = require('../models/Requirement');
const Vendor = require('../models/Vendor');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Category = require('../models/Category');
const https = require('https');
const cloudinary = require('../config/cloudinary');
const { matchVendorsToRequirement, trackVendorLead } = require('../utils/helpers');

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
    
    // Check if this lead already exists to avoid duplicates
    const existingLead = currentUser.leads.find(
      lead => lead.vendorId && lead.vendorId.toString() === vendorId.toString()
    );
    
    if (!existingLead) {
      // Only add the lead if it doesn't already exist
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
    }
    
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserRequirements = async (req, res) => {
  try {
    const requirements = await Requirement.find({ userId: req.user.id }).populate('serviceCategory').sort({ createdAt: -1 });
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
    
    // Check if this lead already exists to avoid duplicates
    const existingLead = currentUser.leads.find(
      lead => lead.vendorId && lead.vendorId.toString() === vendorId.toString()
    );
    
    if (!existingLead) {
      // Only add the lead if it doesn't already exist
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
    } else {
      // Update existing lead with new contact information
      await User.findByIdAndUpdate(
        { _id: req.user.id, 'leads.vendorId': vendorId },
        {
          $set: {
            'leads.$.contactDate': new Date(),
            'leads.$.contactType': 'customerContactedVendor',
            'leads.$.customerName': nameToSave,
            'leads.$.customerPhone': phoneToSave,
          },
        }
      );
    }
    
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

    // Update the Requirement's viewedBy array to set approvedByUser = true
    await Requirement.findOneAndUpdate(
      { _id: lead.requirementId._id, 'viewedBy.leadId': lead._id },
      {
        $set: {
          'viewedBy.$.approvedByUser': true,
          'viewedBy.$.approvedByUserId': req.user.id,
        },
      }
    );

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
    // Update the lead status
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

    // Update the requirement's leadAction status
    const lead = await Lead.findById(leadRecordId).populate('requirementId');
    if (lead && lead.requirementId) {
      await Requirement.findByIdAndUpdate(lead.requirementId._id, { leadAction: 'closed' });
    }

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
        approvedByUser: entry.approvedByUser || false,
        approvedByUserId: entry.approvedByUserId,
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

exports.downloadQuotation = async (req, res) => {
  const { leadId } = req.params;
  try {
    // Find the lead and check if user is authorized
    const lead = await Lead.findById(leadId).populate('requirementId');
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    // Check authorization
    if (lead.requirementId && lead.requirementId.userId) {
      if (lead.requirementId.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to download this quotation' });
      }
    } else {
      return res.status(400).json({ message: 'Requirement not found for this lead' });
    }

    if (!lead.quotationUrl) {
      return res.status(404).json({ message: 'No quotation available for download' });
    }

    const streamCloudinaryFile = (fileUrl, res, fileName, inline = false, redirectCount = 0) => {
      if (redirectCount > 5) {
        return res.status(500).json({ message: 'Too many redirects while fetching quotation' });
      }

      https.get(fileUrl, (cloudinaryRes) => {
        if ([301, 302, 303, 307, 308].includes(cloudinaryRes.statusCode) && cloudinaryRes.headers.location) {
          cloudinaryRes.destroy();
          return streamCloudinaryFile(cloudinaryRes.headers.location, res, fileName, inline, redirectCount + 1);
        }

        if (cloudinaryRes.statusCode !== 200) {
          let errorPayload = '';
          cloudinaryRes.on('data', (chunk) => {
            errorPayload += chunk.toString();
          });
          cloudinaryRes.on('end', () => {
            console.error('Cloudinary returned non-200 status:', cloudinaryRes.statusCode, errorPayload);
            return res.status(500).json({ message: 'Failed to fetch quotation from storage' });
          });
          return;
        }

        const dispositionType = inline ? 'inline' : 'attachment';
        const encodedFileName = encodeURIComponent(fileName || 'quotation.pdf');
        const contentType = cloudinaryRes.headers['content-type'] || 'application/pdf';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodedFileName}"`);
        if (cloudinaryRes.headers['content-length']) {
          res.setHeader('Content-Length', cloudinaryRes.headers['content-length']);
        }

        cloudinaryRes.pipe(res);
      }).on('error', (error) => {
        console.error('Error downloading quotation:', error);
        res.status(500).json({ message: 'Failed to download quotation' });
      });
    };

    const fileName = lead.quotationFileName || 'quotation.pdf';
    const inlineView = req.query.inline === 'true';
    streamCloudinaryFile(lead.quotationUrl, res, fileName, inlineView);

  } catch (error) {
    console.error('Error in downloadQuotation:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updateFields = {};
    const { name, phone, city } = req.body;

    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;
    if (city) updateFields.city = city;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, `users/profile/${req.user.id}`);
      updateFields.profileImage = result.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(req.user.id, updateFields, { new: true });
    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};