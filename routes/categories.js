const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

// Get all custom categories for a user
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const categories = await Category.find({ userId });
    
    // Format categories by type
    const formattedCategories = {
      Expense: [],
      Income: []
    };
    
    categories.forEach(category => {
      formattedCategories[category.type].push(category.category);
    });
    
    res.status(200).json(formattedCategories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a new custom category
router.post('/', async (req, res) => {
  try {
    const { userId, type, category } = req.body;
    
    if (!userId || !type || !category) {
      return res.status(400).json({ 
        message: 'userId, type, and category are required fields' 
      });
    }
    
    // Check if category already exists
    const existingCategory = await Category.findOne({ userId, type, category });
    if (existingCategory) {
      return res.status(400).json({ message: 'Category already exists' });
    }
    
    const newCategory = new Category({
      userId,
      type,
      category
    });
    
    await newCategory.save();
    res.status(201).json(newCategory);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 