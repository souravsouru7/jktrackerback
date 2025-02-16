const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Entry = require('../models/Entry');
const Project = require('../models/Project');
const PdfPrinter = require('pdfmake');
const fs = require('fs');
const path = require('path');

// Define a simple font configuration
const fonts = {
  Courier: {
    normal: 'Courier',
    bold: 'Courier-Bold'
  }
};

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
      currency: 'USD', 
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

// Get overall summary across all projects
router.get('/user/total-calculations', async (req, res) => {
  try {
    const { userId } = req.query; 

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

// Generate PDF balance sheet
router.post('/generate-pdf', async (req, res) => {
  try {
    const { userId, projectId, selectedCategories } = req.body;
    
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    // Fetch project details
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Fetch entries for selected categories
    const entries = await Entry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          category: { $in: selectedCategories }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          categories: {
            $push: {
              category: '$_id.category',
              totalAmount: '$totalAmount'
            }
          },
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Process entries data
    const incomeData = entries.find(e => e._id === 'Income') || { categories: [], total: 0 };
    const expenseData = entries.find(e => e._id === 'Expense') || { categories: [], total: 0 };
    const netBalance = incomeData.total - expenseData.total;

    // Create PDF document definition
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      defaultStyle: {
        font: 'Courier',
        fontSize: 10
      },
      footer: function(currentPage, pageCount) {
        return {
          text: `Page ${currentPage} of ${pageCount}`,
          alignment: 'center',
          fontSize: 8,
          margin: [0, 10, 0, 0]
        };
      },
      header: function() {
        return {
          columns: [
            {
              text: 'BALANCE SHEET REPORT',
              alignment: 'left',
              margin: [40, 20, 0, 0],
              fontSize: 8,
              color: '#666666'
            },
            {
              text: new Date().toLocaleDateString(),
              alignment: 'right',
              margin: [0, 20, 40, 0],
              fontSize: 8,
              color: '#666666'
            }
          ]
        };
      },
      content: [
        {
          columns: [
            {
              width: '*',
              stack: [
                { text: 'BALANCE SHEET', style: 'mainHeader' },
                { text: project.name.toUpperCase(), style: 'projectName' },
                { text: new Date().toLocaleDateString(), style: 'date' }
              ]
            }
          ]
        },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#000000' }] },
        { text: '\n' },

        // Financial Overview Section
        {
          table: {
            widths: ['*'],
            body: [
              [{ text: 'FINANCIAL OVERVIEW', style: 'sectionHeader' }]
            ]
          },
          layout: 'lightHorizontalLines'
        },
        { text: '\n' },

        // Income Section
        {
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: [
              [
                { text: 'INCOME CATEGORIES', style: 'tableHeader', colSpan: 3, alignment: 'left' },
                {}, {}
              ],
              [
                { text: 'Category', style: 'tableSubHeader' },
                { text: 'Amount (₹)', style: 'tableSubHeader', alignment: 'right' },
                { text: '% of Total', style: 'tableSubHeader', alignment: 'right' }
              ],
              ...incomeData.categories.map(item => [
                { text: item.category, style: 'tableCell' },
                { text: item.totalAmount.toFixed(2), style: 'tableCell', alignment: 'right' },
                { 
                  text: ((item.totalAmount / incomeData.total) * 100).toFixed(1) + '%',
                  style: 'tableCell',
                  alignment: 'right'
                }
              ]),
              [
                { text: 'Total Income', style: 'tableTotal' },
                { text: incomeData.total.toFixed(2), style: 'tableTotal', alignment: 'right' },
                { text: '100%', style: 'tableTotal', alignment: 'right' }
              ]
            ]
          },
          layout: {
            hLineWidth: function(i, node) {
              return (i === 0 || i === 1 || i === node.table.body.length - 1) ? 1 : 0.5;
            },
            vLineWidth: function(i, node) {
              return 0;
            },
            hLineColor: function(i, node) {
              return (i === 0 || i === 1) ? '#000000' : '#CCCCCC';
            },
            paddingLeft: function(i) { return 8; },
            paddingRight: function(i) { return 8; },
            paddingTop: function(i) { return 8; },
            paddingBottom: function(i) { return 8; }
          }
        },
        { text: '\n' },

        // Expenses Section (similar structure as Income)
        // ... Similar table structure for expenses ...

        // Summary Section
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'FINANCIAL SUMMARY', style: 'summaryHeader', colSpan: 2 },
                {}
              ],
              [
                { text: 'Total Income', style: 'summaryRow' },
                { text: `₹${incomeData.total.toFixed(2)}`, style: 'summaryRow', alignment: 'right' }
              ],
              [
                { text: 'Total Expenses', style: 'summaryRow' },
                { text: `₹${expenseData.total.toFixed(2)}`, style: 'summaryRow', alignment: 'right' }
              ],
              [
                { text: 'NET BALANCE', style: 'summaryTotal' },
                { 
                  text: `₹${netBalance.toFixed(2)}`,
                  style: 'summaryTotal',
                  alignment: 'right',
                  color: netBalance >= 0 ? '#006400' : '#FF0000'
                }
              ]
            ]
          },
          layout: {
            hLineWidth: function(i, node) { return 1; },
            vLineWidth: function(i, node) { return 0; },
            hLineColor: function(i, node) { return '#000000'; },
            fillColor: function(i, node) {
              return (i === 0) ? '#F8F9FA' : null;
            }
          }
        }
      ],
      styles: {
        mainHeader: {
          fontSize: 24,
          bold: true,
          color: '#2C3E50',
          margin: [0, 0, 0, 5]
        },
        projectName: {
          fontSize: 16,
          color: '#34495E',
          margin: [0, 0, 0, 20]
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          color: '#2C3E50',
          margin: [0, 10, 0, 10]
        },
        tableHeader: {
          fontSize: 12,
          bold: true,
          color: '#FFFFFF',
          fillColor: '#34495E',
          margin: [0, 5, 0, 5]
        },
        tableSubHeader: {
          fontSize: 11,
          bold: true,
          color: '#2C3E50',
          fillColor: '#F8F9FA',
          margin: [0, 5, 0, 5]
        },
        tableCell: {
          fontSize: 10,
          color: '#2C3E50',
          margin: [0, 3, 0, 3]
        },
        tableTotal: {
          fontSize: 11,
          bold: true,
          color: '#2C3E50',
          margin: [0, 5, 0, 5]
        },
        summaryHeader: {
          fontSize: 14,
          bold: true,
          color: '#2C3E50',
          margin: [0, 5, 0, 5]
        },
        summaryRow: {
          fontSize: 11,
          color: '#2C3E50',
          margin: [0, 3, 0, 3]
        },
        summaryTotal: {
          fontSize: 12,
          bold: true,
          color: '#2C3E50',
          margin: [0, 5, 0, 5]
        }
      }
    };

    // Create PDF
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=balance-sheet-${project.name}.pdf`);

    // Pipe the PDF document to the response
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      message: 'Server error while generating PDF',
      error: error.message
    });
  }
});

// Download PDF balance sheet
router.post('/download-pdf', async (req, res) => {
  try {
    const { userId, projectId, selectedCategories } = req.body;
    
    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    // Fetch project details
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Fetch entries for selected categories
    const entries = await Entry.aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          projectId: new mongoose.Types.ObjectId(projectId),
          category: { $in: selectedCategories }
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category'
          },
          totalAmount: { $sum: '$amount' }
        }
      },
      {
        $group: {
          _id: '$_id.type',
          categories: {
            $push: {
              category: '$_id.category',
              totalAmount: '$totalAmount'
            }
          },
          total: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Process entries data
    const incomeData = entries.find(e => e._id === 'Income') || { categories: [], total: 0 };
    const expenseData = entries.find(e => e._id === 'Expense') || { categories: [], total: 0 };
    const netBalance = incomeData.total - expenseData.total;

    // Create PDF document definition
    const docDefinition = {
      defaultStyle: {
        font: 'Courier',
        fontSize: 10
      },
      content: [
        { text: 'Balance Sheet Report', style: 'header' },
        { text: `Project: ${project.name}`, style: 'subheader' },
        { text: `Generated on: ${new Date().toLocaleDateString()}`, style: 'date' },
        { text: '\n' },
        
        // Income Section
        { text: 'Income', style: 'sectionHeader' },
        {
          style: 'tableStyle',
          table: {
            headerRows: 1,
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Category', style: 'tableHeader' }, 
                { text: 'Amount (₹)', style: 'tableHeader' }
              ],
              ...incomeData.categories.map(item => [
                { text: item.category, style: 'tableCell' },
                { text: item.totalAmount.toFixed(2), style: 'tableCell', alignment: 'right' }
              ]),
              [
                { text: 'Total Income', style: 'tableFooter' },
                { text: incomeData.total.toFixed(2), style: 'tableFooter', alignment: 'right' }
              ]
            ]
          }
        },
        { text: '\n' },

        // Expense Section
        { text: 'Expenses', style: 'sectionHeader' },
        {
          style: 'tableStyle',
          table: {
            headerRows: 1,
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Category', style: 'tableHeader' },
                { text: 'Amount (₹)', style: 'tableHeader' }
              ],
              ...expenseData.categories.map(item => [
                { text: item.category, style: 'tableCell' },
                { text: item.totalAmount.toFixed(2), style: 'tableCell', alignment: 'right' }
              ]),
              [
                { text: 'Total Expenses', style: 'tableFooter' },
                { text: expenseData.total.toFixed(2), style: 'tableFooter', alignment: 'right' }
              ]
            ]
          }
        },
        { text: '\n' },

        // Summary Section
        { text: 'Summary', style: 'sectionHeader' },
        {
          style: 'tableStyle',
          table: {
            widths: ['*', 'auto'],
            body: [
              [
                { text: 'Total Income', style: 'summaryRow' },
                { text: `₹${incomeData.total.toFixed(2)}`, style: 'summaryRow', alignment: 'right' }
              ],
              [
                { text: 'Total Expenses', style: 'summaryRow' },
                { text: `₹${expenseData.total.toFixed(2)}`, style: 'summaryRow', alignment: 'right' }
              ],
              [
                { text: 'Net Balance', style: 'summaryTotal' },
                { text: `₹${netBalance.toFixed(2)}`, style: 'summaryTotal', alignment: 'right' }
              ]
            ]
          }
        }
      ],
      styles: {
        header: {
          fontSize: 20,
          bold: true,
          alignment: 'center',
          margin: [0, 0, 0, 10]
        },
        subheader: {
          fontSize: 16,
          bold: true,
          margin: [0, 10, 0, 5]
        },
        date: {
          fontSize: 12,
          color: '#666666',
          margin: [0, 0, 0, 20]
        },
        sectionHeader: {
          fontSize: 14,
          bold: true,
          margin: [0, 15, 0, 10]
        },
        tableStyle: {
          margin: [0, 5, 0, 15]
        },
        tableHeader: {
          bold: true,
          fontSize: 11,
          color: '#000000',
          fillColor: '#f2f2f2',
          margin: [0, 5, 0, 5]
        },
        tableCell: {
          fontSize: 10,
          margin: [0, 3, 0, 3]
        },
        tableFooter: {
          bold: true,
          fontSize: 10,
          margin: [0, 5, 0, 5]
        },
        summaryRow: {
          fontSize: 11,
          margin: [0, 3, 0, 3]
        },
        summaryTotal: {
          fontSize: 12,
          bold: true,
          margin: [0, 5, 0, 5]
        }
      }
    };

    // Create PDF
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=balance-sheet-${project.name}.pdf`);

    // Pipe the PDF document to the response
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).json({
      message: 'Server error while generating PDF',
      error: error.message
    });
  }
});

module.exports = router;