const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Entry = require('../models/Entry');

// Monthly Expenses Breakdown for specific project
router.get('/monthly-expenses', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const expenses = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'Expense' 
        } 
      },
      { 
        $group: { 
          _id: { 
            month: { $month: '$date' }, 
            year: { $year: '$date' } 
          }, 
          amount: { $sum: '$amount' } 
        } 
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      {
        $project: {
          _id: 0,
          month: {
            $concat: [
              { $toString: '$_id.year' },
              '-',
              {
                $cond: {
                  if: { $lt: ['$_id.month', 10] },
                  then: { $concat: ['0', { $toString: '$_id.month' }] },
                  else: { $toString: '$_id.month' }
                }
              }
            ]
          },
          amount: 1
        }
      }
    ]);

    res.status(200).json(expenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Income vs Expense Comparison for specific project
router.get('/income-vs-expense', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const comparison = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId)
        } 
      },
      { 
        $group: { 
          _id: '$type', 
          value: { $sum: '$amount' } 
        } 
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1
        }
      }
    ]);

    res.status(200).json(comparison);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Category-wise Expense Distribution for specific project
router.get('/category-expenses', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const categoryExpenses = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'Expense' 
        } 
      },
      { 
        $group: { 
          _id: '$category', 
          total: { $sum: '$amount' } 
        } 
      },
      { $sort: { total: -1 } }
    ]);

    res.status(200).json(categoryExpenses);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Monthly trend (both income and expenses) for specific project
router.get('/monthly-trend', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const monthlyTrend = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId)
        } 
      },
      { 
        $group: { 
          _id: { 
            month: { $month: '$date' }, 
            year: { $year: '$date' },
            type: '$type'
          }, 
          total: { $sum: '$amount' } 
        } 
      },
      { 
        $sort: { 
          '_id.year': 1, 
          '_id.month': 1 
        } 
      }
    ]);

    res.status(200).json(monthlyTrend);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Category-wise Expense Analysis
router.get('/category-analysis', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const categoryAnalysis = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'Expense'  // Only get expenses
        } 
      },
      { 
        $group: { 
          _id: '$category',
          value: { $sum: '$amount' } 
        } 
      },
      {
        $project: {
          _id: 0,
          name: '$_id',
          value: 1
        }
      },
      {
        $sort: { value: -1 }  // Sort by highest expense first
      }
    ]);

    res.status(200).json(categoryAnalysis);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
