const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');
const Manager = require('../models/Manager');
const cloudinary = require('../config/cloudinary');

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) reject(error);
      else resolve(result.secure_url);
    }).end(buffer);
  });
};

exports.createEmployee = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const employee = new Employee({
      name,
      email,
      phone,
      password: hashedPassword,
      managerId: req.user.id,
    });
    await employee.save();
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find({ managerId: req.user.id });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getVendors = async (req, res) => {
  try {
    const employees = await Employee.find({ managerId: req.user.id });
    const employeeIds = employees.map(emp => emp._id);
    const vendors = await Vendor.find({ createdByEmployeeId: { $in: employeeIds } }).populate('category');
    res.json(vendors);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const manager = await Manager.findById(req.user.id);
    if (!manager) {
      return res.status(404).json({ message: 'Manager not found' });
    }

    const updateFields = {};
    const { name, phone } = req.body;

    if (name) updateFields.name = name;
    if (phone) updateFields.phone = phone;

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, `managers/profile/${req.user.id}`);
      updateFields.profileImage = result;
    }

    const updatedManager = await Manager.findByIdAndUpdate(req.user.id, updateFields, { new: true });
    res.json({ message: 'Profile updated successfully', manager: updatedManager });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};