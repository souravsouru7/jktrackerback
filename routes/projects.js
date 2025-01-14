const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Entry = require('../models/Entry'); // Add this line
const auth = require('../middleware/auth');
const mongoose = require('mongoose');
// Update the create project route
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, budget } = req.body;
    const userId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }

    // Validate budget if provided
    if (budget && (isNaN(budget) || budget < 0)) {
      return res.status(400).json({ message: 'Budget must be a positive number' });
    }

    const project = new Project({ 
      userId, 
      name, 
      description,
      budget: budget || 0 
    });
    await project.save();

    res.status(201).json({ message: 'Project created successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Get all projects for a user
router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    const projects = await Project.find({ userId });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete a project
router.delete('/:id', auth, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Check user ownership
    if (project.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Delete associated entries
    await Entry.deleteMany({ projectId: project._id });
    
    // Delete project
    await Project.findByIdAndDelete(project._id);

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ message: 'Server error while deleting project', error: error.message });
  }
});
// Add this to your entry routes file

// Get total calculations for all user's projects combined
router.get('/user/total-calculations', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Aggregate all entries for the user
    const aggregatedData = await Entry.aggregate([
      // Match entries for this user
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      // Group by type and category
      {
        $group: {
          _id: {
            type: "$type",
            category: "$category"
          },
          total: { $sum: "$amount" }
        }
      }
    ]);

    // Initialize result structure
    const result = {
      totalIncome: 0,
      totalExpenses: 0,
      netBalance: 0,
      incomeByCategory: {},
      expensesByCategory: {},
      monthlyBreakdown: [],
      recentTransactions: []
    };

    // Process aggregated data
    aggregatedData.forEach(item => {
      if (item._id.type === 'Income') {
        result.totalIncome += item.total;
        result.incomeByCategory[item._id.category] = item.total;
      } else {
        result.totalExpenses += item.total;
        result.expensesByCategory[item._id.category] = item.total;
      }
    });

    // Calculate net balance
    result.netBalance = result.totalIncome - result.totalExpenses;

    // Get monthly breakdown
    const monthlyData = await Entry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            type: "$type"
          },
          total: { $sum: "$amount" }
        }
      },
      {
        $sort: {
          "_id.year": -1,
          "_id.month": -1
        }
      }
    ]);

    // Process monthly data
    const monthlyMap = new Map();
    monthlyData.forEach(item => {
      const key = `${item._id.year}-${item._id.month}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, {
          year: item._id.year,
          month: item._id.month,
          income: 0,
          expenses: 0
        });
      }
      const monthData = monthlyMap.get(key);
      if (item._id.type === 'Income') {
        monthData.income = item.total;
      } else {
        monthData.expenses = item.total;
      }
    });

    result.monthlyBreakdown = Array.from(monthlyMap.values())
      .map(month => ({
        ...month,
        balance: month.income - month.expenses
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });

    // Get recent transactions
    result.recentTransactions = await Entry.find({ userId })
      .sort({ date: -1 })
      .limit(10)
      .select('type amount category description date projectId')
      .populate('projectId', 'name');

    // Get total number of projects
    const projectCount = await Project.countDocuments({ userId });
    result.totalProjects = projectCount;

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalProjects: result.totalProjects,
          totalIncome: result.totalIncome,
          totalExpenses: result.totalExpenses,
          netBalance: result.netBalance
        },
        details: {
          incomeByCategory: result.incomeByCategory,
          expensesByCategory: result.expensesByCategory,
          monthlyBreakdown: result.monthlyBreakdown,
          recentTransactions: result.recentTransactions
        }
      }
    });

  } catch (error) {
    console.error('Total calculations error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error calculating totals',
      error: error.message
    });
  }
});


router.get('/project-summary', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Get all projects for user
    const projects = await Project.find({ userId });

    // Calculate totals per project
    const projectSummaries = await Promise.all(projects.map(async (project) => {
      const entries = await Entry.aggregate([
        {
          $match: {
            projectId: project._id,
            userId: new mongoose.Types.ObjectId(userId)
          }
        },
        {
          $group: {
            _id: '$type',
            total: { $sum: '$amount' }
          }
        }
      ]);

      const income = entries.find(e => e._id === 'Income')?.total || 0;
      const expenses = entries.find(e => e._id === 'Expense')?.total || 0;

      return {
        projectId: project._id,
        projectName: project.name,
        income,
        expenses,
        balance: income - expenses
      };
    }));

    // Calculate overall totals
    const totals = projectSummaries.reduce((acc, curr) => ({
      totalIncome: acc.totalIncome + curr.income,
      totalExpenses: acc.totalExpenses + curr.expenses,
      totalBalance: acc.totalBalance + (curr.income - curr.expenses)
    }), { totalIncome: 0, totalExpenses: 0, totalBalance: 0 });

    res.status(200).json({
      overall: totals,
      projects: projectSummaries
    });

  } catch (error) {
    console.error('Summary error:', error);
    res.status(500).json({
      message: 'Error calculating summary',
      error: error.message
    });
  }
});

module.exports = router;


module.exports = router;
