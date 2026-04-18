const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Manager = require('../models/Manager');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Category = require('../models/Category');

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
  const { businessName, ownerName, email, password, phone, whatsapp, address, city, state, zipCode, category, experience, teamSize, description, pricingRange } = req.body;
  try {
    // Check if vendor already exists
    const existingVendor = await Vendor.findOne({ email });
    if (existingVendor) {
      return res.status(400).json({ message: 'Vendor with this email already exists' });
    }

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
      experience,
      teamSize,
      description,
      pricingRange,
      role: 'vendor',
      status: 'pending', // Will be approved by admin
      subscriptionStatus: 'inactive',
    });
    
    await vendor.save();
    const token = generateToken(vendor);
    res.status(201).json({ 
      token,
      user: vendor,
      message: 'Vendor registration successful. Awaiting admin approval', 
      note: 'Your vendor profile is under admin review. You will be able to login once approved.'
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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