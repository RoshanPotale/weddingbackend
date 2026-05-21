const bcrypt = require('bcryptjs');
const Manager = require('../models/Manager');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const { updateExpiredSubscriptions } = require('../utils/helpers');

exports.createManager = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const manager = new Manager({
      name,
      email,
      phone,
      password: hashedPassword,
      createdByAdmin: req.user.id,
    });
    await manager.save();
    res.status(201).json(manager);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.approveVendor = async (req, res) => {
  const { vendorId } = req.params;
  try {
    const vendor = await Vendor.findByIdAndUpdate(vendorId, {
      status: 'approved',
      approvedByAdmin: req.user.id,
    }, { new: true });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectVendor = async (req, res) => {
  const { vendorId } = req.params;
  try {
    const vendor = await Vendor.findByIdAndUpdate(vendorId, {
      status: 'rejected',
      approvedByAdmin: req.user.id,
    }, { new: true });
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateVendorSubscription = async (req, res) => {
  const { vendorId } = req.params;
  const { subscriptionStatus, subscriptionPlan, durationDays } = req.body;

  if (!['inactive', 'active', 'expired'].includes(subscriptionStatus)) {
    return res.status(400).json({
      message: 'Invalid subscriptionStatus. Allowed values: inactive, active, expired',
    });
  }

  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' });
    }

    vendor.subscriptionStatus = subscriptionStatus;
    if (subscriptionPlan) vendor.subscriptionPlan = subscriptionPlan;

    if (subscriptionStatus === 'active') {
      const now = new Date();
      vendor.subscriptionStartDate = now;
      vendor.subscriptionEndDate = new Date(now);
      vendor.subscriptionEndDate.setDate(vendor.subscriptionEndDate.getDate() + (Number(durationDays || 30)));
    } else if (subscriptionStatus === 'expired') {
      vendor.subscriptionEndDate = new Date();
    }

    await vendor.save();
    res.json({ message: 'Subscription status updated successfully', vendor });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getManagers = async (req, res) => {
  try {
    const managers = await Manager.find();
    res.json(managers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    console.log('📋 Fetching all vendors for admin...');
    let vendors = await Vendor.find()
      .populate('category')
      .populate('subCategory');
    
    // Check and update expired subscriptions
    vendors = await Promise.all(vendors.map(vendor => updateExpiredSubscriptions(vendor)));
    
    res.json(vendors);
  } catch (error) {
    console.error('❌ Error in getVendors:', error);
    res.status(500).json({ message: error.message });
  }
};

// Dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    console.log('📊 Fetching dashboard stats...');
    const totalUsers = await User.countDocuments();
    const totalVendors = await Vendor.countDocuments();
    const totalManagers = await Manager.countDocuments();
    const totalEmployees = await Employee.countDocuments();
    const totalCategories = await Category.countDocuments();
    
    let totalSubCategories = 0;
    try {
      totalSubCategories = await SubCategory.countDocuments();
    } catch (subErr) {
      console.error('Error counting subcategories:', subErr);
    }

    const approvedVendors = await Vendor.countDocuments({ status: 'approved' });
    const pendingVendors = await Vendor.countDocuments({ status: 'pending' });

    console.log('✅ Stats fetched successfully');
    res.json({
      totalUsers,
      totalVendors,
      totalManagers,
      totalEmployees,
      totalCategories,
      totalSubCategories,
      approvedVendors,
      pendingVendors,
    });
  } catch (error) {
    console.error('❌ Error in getDashboardStats:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all employees
exports.getAllEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().select('-password');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};