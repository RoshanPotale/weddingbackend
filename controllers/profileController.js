const Admin = require('../models/Admin');
const Manager = require('../models/Manager');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

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

// Get the appropriate model based on user role
const getModelByRole = (role) => {
  switch (role) {
    case 'admin': return Admin;
    case 'manager': return Manager;
    case 'employee': return Employee;
    case 'vendor': return Vendor;
    case 'user': return User;
    default: throw new Error('Invalid user role');
  }
};

// Get profile fields based on role
const getProfileFields = (role, body, files) => {
  const commonFields = {};
  const { name, phone, city, email } = body;

  // Common fields for all roles
  if (name) commonFields.name = name;
  if (phone) commonFields.phone = phone;
  if (city) commonFields.city = city;
  if (email) commonFields.email = email;

  // Role-specific fields
  switch (role) {
    case 'admin':
      // Admins typically only have basic profile fields
      break;

    case 'manager':
      // Managers have basic profile fields
      break;

    case 'employee':
      // Employees have basic profile fields
      break;

    case 'vendor':
      const { businessName, ownerName, whatsapp, address, experience, teamSize, description, pricingRange, perPlateCharge, aadhaarId, panId, gstId, category, subCategory } = body;
      if (businessName) commonFields.businessName = businessName;
      if (ownerName) commonFields.ownerName = ownerName;
      if (whatsapp) commonFields.whatsapp = whatsapp;
      if (address) commonFields.address = address;
      if (experience !== undefined) commonFields.experience = experience;
      if (teamSize !== undefined) commonFields.teamSize = teamSize;
      if (description) commonFields.description = description;
      if (pricingRange) commonFields.pricingRange = pricingRange;
      if (perPlateCharge !== undefined) commonFields.perPlateCharge = perPlateCharge;
      if (aadhaarId) commonFields.aadhaarId = aadhaarId;
      if (panId) commonFields.panId = panId;
      if (gstId) commonFields.gstId = gstId;
      if (category) commonFields.category = category;
      if (subCategory) commonFields.subCategory = subCategory;
      if (body.instagram !== undefined) commonFields.instagram = body.instagram;
      if (body.facebook !== undefined) commonFields.facebook = body.facebook;
      if (body.youtube !== undefined) commonFields.youtube = body.youtube;
      if (body.linkedin !== undefined) commonFields.linkedin = body.linkedin;
      if (body.twitter !== undefined) commonFields.twitter = body.twitter;
      break;

    case 'user':
      // Users have basic profile fields
      break;
  }

  return commonFields;
};

exports.updateProfile = async (req, res) => {
  try {
    console.log('🔍 Profile Update Request:', {
      userId: req.user.id,
      role: req.user.role,
      body: req.body,
      files: req.files ? Object.keys(req.files) : 'no files'
    });

    const Model = getModelByRole(req.user.role);
    console.log('📋 Using model:', Model.modelName);

    // Find the user by ID
    const user = await Model.findById(req.user.id);
    if (!user) {
      console.log('❌ User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('👤 Found user:', { id: user._id, name: user.name, role: req.user.role });

    // Get profile fields based on role
    const updateFields = getProfileFields(req.user.role, req.body, req.files);
    console.log('📝 Update fields:', updateFields);

    // Handle profile image upload for all roles
    if (req.files?.profileImage && req.files.profileImage[0]) {
      console.log('🖼️ Uploading profile image...');
      const result = await uploadToCloudinary(
        req.files.profileImage[0].buffer,
        `${req.user.role}s/profile/${req.user.id}`
      );
      updateFields.profileImage = result.secure_url;
      console.log('✅ Profile image uploaded:', result.secure_url);
    }

    // Handle vendor-specific uploads
    if (req.user.role === 'vendor') {
      // Handle portfolio images for vendors
      if (req.files?.portfolioImages && req.files.portfolioImages.length > 0) {
        console.log('🖼️ Uploading portfolio images...');
        const portfolioUrls = user.portfolioImages || []; // Keep existing images
        for (const file of req.files.portfolioImages) {
          const result = await uploadToCloudinary(file.buffer, `vendors/portfolio/${req.user.id}`);
          portfolioUrls.push(result.secure_url);
        }
        updateFields.portfolioImages = portfolioUrls;
        console.log('✅ Portfolio images uploaded:', portfolioUrls.length);
      }

      // Handle document uploads for vendors
      if (req.files?.aadhaarDocument && req.files.aadhaarDocument[0]) {
        console.log('📄 Uploading Aadhaar document...');
        const result = await uploadToCloudinary(
          req.files.aadhaarDocument[0].buffer,
          `vendors/documents/${req.user.id}`
        );
        updateFields.aadhaarDocument = result.secure_url;
      }

      if (req.files?.panDocument && req.files.panDocument[0]) {
        console.log('📄 Uploading PAN document...');
        const result = await uploadToCloudinary(
          req.files.panDocument[0].buffer,
          `vendors/documents/${req.user.id}`
        );
        updateFields.panDocument = result.secure_url;
      }

      if (req.files?.gstDocument && req.files.gstDocument[0]) {
        console.log('📄 Uploading GST document...');
        const result = await uploadToCloudinary(
          req.files.gstDocument[0].buffer,
          `vendors/documents/${req.user.id}`
        );
        updateFields.gstDocument = result.secure_url;
      }
    }

    console.log('💾 Final update fields:', updateFields);

    // Update the user profile
    console.log('🔄 Executing MongoDB update...');
    const updatedUser = await Model.findByIdAndUpdate(
      req.user.id,
      updateFields,
      { new: true }
    ).select('-password'); // Exclude password from response

    console.log('✅ Profile updated successfully:', {
      id: updatedUser._id,
      name: updatedUser.name,
      updatedFields: Object.keys(updateFields)
    });

    // Verify the update by fetching again
    const verifyUser = await Model.findById(req.user.id).select('-password');
    console.log('🔍 Verification - user after update:', {
      name: verifyUser.name,
      phone: verifyUser.phone,
      city: verifyUser.city,
      profileImage: verifyUser.profileImage ? 'present' : 'not set'
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

exports.deletePortfolioImage = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: 'Image URL is required' });
    }

    if (req.user.role !== 'vendor') {
      return res.status(403).json({ message: 'Only vendors can manage portfolio images' });
    }

    const Vendor = getModelByRole('vendor');
    const vendor = await Vendor.findById(req.user.id);

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found' });
    }

    // Remove the image URL from the portfolioImages array
    const originalCount = vendor.portfolioImages.length;
    vendor.portfolioImages = vendor.portfolioImages.filter(url => url !== imageUrl);

    if (vendor.portfolioImages.length === originalCount) {
      return res.status(404).json({ message: 'Image not found in portfolio' });
    }

    await vendor.save();

    res.json({ 
      message: 'Portfolio image removed successfully',
      portfolioImages: vendor.portfolioImages 
    });
  } catch (error) {
    console.error('Error deleting portfolio image:', error);
    res.status(500).json({ message: 'Error deleting portfolio image', error: error.message });
  }
};

// Get current user's profile
exports.getProfile = async (req, res) => {
  try {
    console.log('🔐 Profile fetch request received');
    console.log('👤 User info from token:', {
      id: req.user.id,
      role: req.user.role,
      email: req.user.email
    });

    const role = req.user.role;
    const Model = getModelByRole(role);

    if (!Model) {
      return res.status(400).json({
        message: 'Invalid user role'
      });
    }

    console.log(`📋 Fetching profile for ${role} with ID: ${req.user.id}`);

    let query = Model.findById(req.user.id).select('-password');
    
    // Populate vendor category and subcategory
    if (role === 'vendor') {
      query = query.populate('category').populate('subCategory');
    }

    const user = await query;

    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    console.log('✅ Profile fetched successfully:', {
      id: user._id,
      name: user.name,
      role: role
    });

    res.json(user);

  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};