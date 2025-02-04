const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Add this line
const Entry = require('../models/Entry');
const Project = require('../models/Project');


// Get overall balance sheet summary
router.get('/summary', async (req, res) => {
  try {
    const { userId, projectId } = req.query;
    
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const totalIncome = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'Income'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const totalExpenses = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          type: 'Expense'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Calculate totals with default values if no entries exist
    const incomeTotal = totalIncome[0]?.total || 0;
    const expenseTotal = totalExpenses[0]?.total || 0;
    const netBalance = incomeTotal - expenseTotal;

    // Format response
    const balance = {
      totalIncome: incomeTotal,
      totalExpenses: expenseTotal,
      netBalance: netBalance,
      currency: 'USD', // Add currency if needed
      lastUpdated: new Date()
    };

    res.status(200).json(balance);

  } catch (error) {
    console.error('Balance summary error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching balance summary', 
      error: error.message 
    });
  }
});

// Get monthly breakdown
router.get('/monthly', async (req, res) => {
  try {
    const { userId, projectId, year } = req.query;
    
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const yearToQuery = parseInt(year) || new Date().getFullYear();

    const monthlyBreakdown = await Entry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          date: {
            $gte: new Date(yearToQuery, 0, 1),
            $lt: new Date(yearToQuery + 1, 0, 1)
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.month',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'Income'] }, '$total', 0]
            }
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'Expense'] }, '$total', 0]
            }
          }
        }
      },
      {
        $project: {
          month: '$_id',
          income: 1,
          expenses: 1,
          balance: { $subtract: ['$income', '$expenses'] },
          _id: 0
        }
      },
      { 
        $sort: { month: 1 } 
      }
    ]);

    // Fill in missing months with zero values
    const completeMonthlyData = Array.from({ length: 12 }, (_, i) => {
      const existingData = monthlyBreakdown.find(item => item.month === i + 1);
      return existingData || {
        month: i + 1,
        income: 0,
        expenses: 0,
        balance: 0
      };
    });

    res.status(200).json(completeMonthlyData);
  } catch (error) {
    console.error('Monthly breakdown error:', error);
    res.status(500).json({ 
      message: 'Server error while fetching monthly breakdown', 
      error: error.message 
    });
  }
});

// Get yearly breakdown
router.get('/yearly', async (req, res) => {
  try {
    const { userId } = req.query;
    
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const yearlyBreakdown = await Entry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.year',
          income: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'Income'] }, '$total', 0]
            }
          },
          expenses: {
            $sum: {
              $cond: [{ $eq: ['$_id.type', 'Expense'] }, '$total', 0]
            }
          }
        }
      },
      {
        $project: {
          year: '$_id',
          income: 1,
          expenses: 1,
          balance: { $subtract: ['$income', '$expenses'] },
          _id: 0
        }
      },
      { $sort: { year: 1 } }
    ]);

    res.status(200).json(yearlyBreakdown);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Add this new route to existing balanceSheet.js

// Get overall summary across all projects
// Get overall summary across all projects
router.get('/user/total-calculations', async (req, res) => {
  try {
    const { userId } = req.query; // Get userId from query instead of auth middleware

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const summary = await Entry.aggregate([
      { 
        $match: { 
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ['$type', 'Income'] }, '$amount', 0]
            }
          },
          totalExpenses: {
            $sum: {
              $cond: [{ $eq: ['$type', 'Expense'] }, '$amount', 0]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalIncome: 1,
          totalExpenses: 1,
          netBalance: { $subtract: ['$totalIncome', '$totalExpenses'] }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        summary: summary[0] || {
          totalIncome: 0,
          totalExpenses: 0, 
          netBalance: 0
        }
      }
    });

  } catch (error) {
    console.error('Total calculations error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching total calculations',
      error: error.message
    });
  }
});

router.delete('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Find project and verify ownership
    const project = await Project.findOne({ _id: projectId, userId });
    if (!project) {
      return res.status(404).json({ message: 'Project not found or unauthorized' });
    }

    // Delete all entries associated with this project
    await Entry.deleteMany({ projectId, userId });

    // Delete the project
    await Project.findByIdAndDelete(projectId);

    res.status(200).json({ 
      message: 'Project and associated entries deleted successfully' 
    });

  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ 
      message: 'Server error while deleting project', 
      error: error.message 
    });
  }
});

// Get detailed project balance sheet
router.get('/project-details/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;
    
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    // First get project details
    const project = await Project.findOne({ 
      _id: projectId, 
      userId: userId 
    });

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Get all entries for the project
    const entries = await Entry.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      // Group by type and category
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          entries: {
            $push: {
              amount: '$amount',
              description: '$description',
              date: '$date',
              _id: '$_id'
            }
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      // Group by type (Income/Expense)
      {
        $group: {
          _id: '$_id.type',
          categories: {
            $push: {
              category: '$_id.category',
              entries: '$entries',
              totalAmount: '$totalAmount'
            }
          },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Process the results
    const income = entries.find(e => e._id === 'Income') || { 
      categories: [], 
      totalAmount: 0 
    };
    const expenses = entries.find(e => e._id === 'Expense') || { 
      categories: [], 
      totalAmount: 0 
    };

    // Calculate net balance
    const netBalance = income.totalAmount - expenses.totalAmount;

    const response = {
      projectDetails: {
        name: project.name,
        description: project.description,
        budget: project.budget
      },
      summary: {
        totalIncome: income.totalAmount,
        totalExpenses: expenses.totalAmount,
        netBalance: netBalance,
        budgetRemaining: project.budget - income.totalAmount
      },
      income: {
        total: income.totalAmount,
        categories: income.categories.sort((a, b) => b.totalAmount - a.totalAmount)
      },
      expenses: {
        total: expenses.totalAmount,
        categories: expenses.categories.sort((a, b) => b.totalAmount - a.totalAmount)
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    console.error('Project balance sheet error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching project balance sheet',
      error: error.message
    });
  }
});

module.exports = router;