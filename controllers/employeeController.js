const Vendor = require('../models/Vendor');
const Employee = require('../models/Employee');
const Category = require('../models/Category');
const cloudinary = require('../config/cloudinary');
const bcrypt = require('bcryptjs');
const { trackVendorLead } = require('../utils/helpers');

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    }).end(buffer);
  });
};

exports.createVendor = async (req, res) => {
  try {
    const employee = await Employee.findById(req.user.id);
    const {
      businessName, ownerName, phone, email, password, whatsapp, address, city, category,
      experience, teamSize, description, pricingRange, categorySpecificFields
    } = req.body;

    // Find category by name or use ObjectId directly
    let categoryId = category;
    if (typeof category === 'string' && category.length > 10) { // Likely an ObjectId
      categoryId = category;
    } else { // Likely a category name
      const categoryDoc = await Category.findOne({ categoryName: category });
      if (!categoryDoc) {
        return res.status(400).json({ message: 'Invalid category' });
      }
      categoryId = categoryDoc._id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let profileImageUrl = null;
    let portfolioImagesUrls = [];
    let aadhaarUrl = null;
    let panUrl = null;
    let gstUrl = null;

    if (req.files.profileImage) {
      profileImageUrl = await uploadToCloudinary(req.files.profileImage[0].buffer, 'vendors/profile');
    }

    if (req.files.portfolioImages) {
      for (const file of req.files.portfolioImages) {
        const url = await uploadToCloudinary(file.buffer, 'vendors/portfolio');
        portfolioImagesUrls.push(url);
      }
    }

    if (req.files.aadhaarDocument) {
      aadhaarUrl = await uploadToCloudinary(req.files.aadhaarDocument[0].buffer, 'vendors/documents');
    }

    if (req.files.panDocument) {
      panUrl = await uploadToCloudinary(req.files.panDocument[0].buffer, 'vendors/documents');
    }

    if (req.files.gstDocument) {
      gstUrl = await uploadToCloudinary(req.files.gstDocument[0].buffer, 'vendors/documents');
    }

    const vendor = new Vendor({
      businessName, ownerName, phone, email, password: hashedPassword, whatsapp, address, city, category: categoryId,
      experience, teamSize, description, pricingRange,
      profileImage: profileImageUrl,
      portfolioImages: portfolioImagesUrls,
      aadhaarDocument: aadhaarUrl,
      panDocument: panUrl,
      gstDocument: gstUrl,
      createdByEmployeeId: req.user.id,
      managerId: employee.managerId,
      categorySpecificFields: JSON.parse(categorySpecificFields || '{}'),
    });

    await vendor.save();
    res.status(201).json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};