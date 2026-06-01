const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cloudinary = require('../config/cloudinary');
const Admin = require('../models/Admin');
const Manager = require('../models/Manager');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Category = require('../models/Category');

// Cloudinary upload helper
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

const generateToken = (user) => {
  return jwt.sign({
    id: user._id,
    role: user.role,
    name: user.name,
    phone: user.phone,
  }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

const login = async (Model, req, res) => {
  const { email, password } = req.body;
  try {
    const user = await Model.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(user);
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ===== REGISTRATION FUNCTIONS =====

// Admin Registration (First Admin Creation)
exports.adminRegister = async (req, res) => {
  const { name, email, password } = req.body;
  try {
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const admin = new Admin({
      name,
      email,
      password: hashedPassword,
      role: 'admin',
    });
    
    await admin.save();
    const token = generateToken(admin);
    res.status(201).json({ 
      message: 'Admin created successfully', 
      token, 
      user: admin 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// User Registration (Public)
exports.userRegister = async (req, res) => {
  const { name, email, password, phone, city } = req.body;
  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      city,
      role: 'user',
    });
    
    await user.save();
    const token = generateToken(user);
    res.status(201).json({ 
      message: 'User registered successfully', 
      token, 
      user 
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Vendor Direct Registration (Website Registration - Status: Pending Admin Approval)
exports.vendorRegister = async (req, res) => {
  console.log('🔍 VENDOR REGISTRATION STARTED');
  console.log('📦 req.body:', req.body);
  console.log('📁 req.files:', req.files ? Object.keys(req.files) : 'No files');
  
  const { 
    businessName, ownerName, email, password, phone, whatsapp, 
    address, city, state, zipCode, category, subCategory, 
    experience, teamSize, description, pricingRange, perPlateCharge,
    aadhaarDocumentId, panDocumentId, gstDocumentId,
    instagram, facebook, youtube, linkedin, twitter, packages
  } = req.body;
  
  try {
    // Step 1: Validate required fields
    console.log('✅ STEP 1: Validating required fields...');
    const requiredFields = { businessName, ownerName, email, password, phone, address, city, state, zipCode, category, experience, teamSize, description, pricingRange };
    const missingFields = Object.entries(requiredFields).filter(([key, value]) => !value).map(([key]) => key);
    
    if (missingFields.length > 0) {
      console.error('❌ Missing required fields:', missingFields);
      return res.status(400).json({ message: `Missing required fields: ${missingFields.join(', ')}` });
    }
    console.log('✅ All required fields present');

    // Step 2: Check if vendor already exists
    console.log('✅ STEP 2: Checking if vendor email already exists...');
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      console.error('❌ Vendor with email already exists:', email);
      return res.status(400).json({ message: 'Vendor with this email already exists' });
    }
    console.log('✅ Email is unique');

    // Step 3: Find/validate category
    console.log('✅ STEP 3: Validating category...');
    console.log('   Category value:', category, 'Type:', typeof category, 'Length:', category?.length);
    let categoryId = category;
    
    if (!category) {
      console.error('❌ Category is empty or undefined');
      return res.status(400).json({ message: 'Category is required' });
    }
    
    // Check if it's already a MongoDB ObjectId (24 character hex string)
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(category);
    
    if (isValidObjectId) {
      // It's an ObjectId, verify it exists
      categoryId = category;
      console.log('   Category appears to be ObjectId:', categoryId);
      const categoryDoc = await Category.findById(categoryId);
      if (!categoryDoc) {
        console.error('❌ Category ObjectId does not exist in database:', categoryId);
        const allCategories = await Category.find().select('_id categoryName');
        console.error('   Available categories:', allCategories);
        return res.status(400).json({ message: 'Category not found in database. Please select a valid category.' });
      }
      console.log('   ✅ Category ObjectId verified');
    } else {
      // Try to find by categoryName
      console.log('   Searching for category by name:', category);
      const categoryDoc = await Category.findOne({ categoryName: category });
      if (!categoryDoc) {
        console.error('❌ Category name not found:', category);
        const allCategories = await Category.find().select('categoryName _id');
        console.error('   Available categories:', allCategories.map(c => `${c.categoryName} (${c._id})`));
        return res.status(400).json({ 
          message: `Category "${category}" not found. Please select a valid category.`,
          availableCategories: allCategories.map(c => c.categoryName)
        });
      }
      categoryId = categoryDoc._id;
      console.log('   ✅ Found category with ID:', categoryId);
    }
    console.log('✅ Category validated');
    
    // Step 4: Handle document uploads
    console.log('✅ STEP 4: Processing document uploads...');
    const documentData = {};
    
    // Upload Aadhaar Document
    if (req.files?.aadhaarDocument && aadhaarDocumentId) {
      try {
        console.log('   Uploading Aadhaar document...');
        const result = await uploadToCloudinary(req.files.aadhaarDocument[0].buffer, 'wedding/vendors/documents/aadhaar');
        documentData.aadhaarDocument = {
          documentId: aadhaarDocumentId,
          documentUrl: result.secure_url,
        };
        console.log('   ✅ Aadhaar uploaded:', result.secure_url);
      } catch (err) {
        console.error('   ❌ Aadhaar upload error:', err.message);
        return res.status(400).json({ message: 'Failed to upload Aadhaar document: ' + err.message });
      }
    } else {
      console.log('   ⚠️  No Aadhaar file provided (optional)');
    }

    // Upload PAN Document
    if (req.files?.panDocument && panDocumentId) {
      try {
        console.log('   Uploading PAN document...');
        const result = await uploadToCloudinary(req.files.panDocument[0].buffer, 'wedding/vendors/documents/pan');
        documentData.panDocument = {
          documentId: panDocumentId,
          documentUrl: result.secure_url,
        };
        console.log('   ✅ PAN uploaded:', result.secure_url);
      } catch (err) {
        console.error('   ❌ PAN upload error:', err.message);
        return res.status(400).json({ message: 'Failed to upload PAN document: ' + err.message });
      }
    } else {
      console.log('   ⚠️  No PAN file provided (optional)');
    }

    // Upload GST Document
    if (req.files?.gstDocument && gstDocumentId) {
      try {
        console.log('   Uploading GST document...');
        const result = await uploadToCloudinary(req.files.gstDocument[0].buffer, 'wedding/vendors/documents/gst');
        documentData.gstDocument = {
          documentId: gstDocumentId,
          documentUrl: result.secure_url,
        };
        console.log('   ✅ GST uploaded:', result.secure_url);
      } catch (err) {
        console.error('   ❌ GST upload error:', err.message);
        return res.status(400).json({ message: 'Failed to upload GST document: ' + err.message });
      }
    } else {
      console.log('   ⚠️  No GST file provided (optional)');
    }
    console.log('✅ Document processing complete');
    
    // Step 5: Hash password
    console.log('✅ STEP 5: Converting numeric fields and hashing password...');
    console.log('   experience:', experience, '-> parseInt:', parseInt(experience));
    console.log('   teamSize:', teamSize, '-> parseInt:', parseInt(teamSize));
    if (perPlateCharge) {
      console.log('   perPlateCharge:', perPlateCharge, '-> parseFloat:', parseFloat(perPlateCharge));
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed');

    // Step 6: Create vendor document
    console.log('✅ STEP 6: Creating vendor document...');
    const vendor = new Vendor({
      businessName,
      ownerName,
      email,
      password: hashedPassword,
      phone,
      whatsapp,
      address,
      city,
      state,
      zipCode,
      category: categoryId,
      subCategory: subCategory || null,
      experience: parseInt(experience),
      teamSize: parseInt(teamSize),
      description,
      pricingRange,
      ...(perPlateCharge && { perPlateCharge: parseFloat(perPlateCharge) }),
      instagram,
      facebook,
      youtube,
      linkedin,
      twitter,
      ...documentData,
      role: 'vendor',
      status: 'pending', // Will be approved by admin
      subscriptionStatus: 'inactive',
    });
    console.log('✅ Vendor document created');
    
    // Step 7: Save to database
    console.log('✅ STEP 7: Saving vendor to database...');
    console.log('   Vendor data:', JSON.stringify(vendor.toObject(), null, 2));
    
    await vendor.save();
    console.log('✅ Vendor saved successfully to database');
    console.log('   Vendor ID:', vendor._id);

    // Step 8: Generate token
    console.log('✅ STEP 8: Generating authentication token...');
    const token = generateToken(vendor);
    console.log('✅ Token generated');

    // Step 9: Send response
    console.log('✅ STEP 9: Sending success response...');
    res.status(201).json({ 
      token,
      user: vendor,
      message: 'Vendor registration successful. Awaiting admin approval', 
      note: 'Your vendor profile is under admin review. You will be able to login once approved.'
    });
    console.log('✅ VENDOR REGISTRATION COMPLETED SUCCESSFULLY');
  } catch (error) {
    console.error('❌ VENDOR REGISTRATION FAILED');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    if (error.errors) {
      console.error('Validation errors:', error.errors);
    }
    res.status(500).json({ 
      message: error.message || 'Failed to register vendor. Please try again.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// ===== LOGIN FUNCTIONS =====

exports.adminLogin = (req, res) => login(Admin, req, res);
exports.managerLogin = (req, res) => login(Manager, req, res);
exports.employeeLogin = (req, res) => login(Employee, req, res);
exports.vendorLogin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const vendor = await Vendor.findOne({ email });
    if (!vendor) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check if vendor is approved
    if (vendor.status !== 'approved') {
      return res.status(403).json({ 
        message: 'Vendor account is pending approval or has been rejected',
        status: vendor.status
      });
    }
    
    const isMatch = await bcrypt.compare(password, vendor.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const token = generateToken(vendor);
    res.json({ token, user: vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
exports.userLogin = (req, res) => login(User, req, res);