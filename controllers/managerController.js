const bcrypt = require('bcryptjs');
const Employee = require('../models/Employee');
const Vendor = require('../models/Vendor');

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