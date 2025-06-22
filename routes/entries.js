const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const Project = require('../models/Project');
const XLSX = require('xlsx');
const PdfPrinter = require('pdfmake');
const path = require('path');
const Category = require('..//models/Category');
const auth = require('../middleware/auth');
// Define fonts using standard fonts
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

// Create PDF printer instance
const printer = new PdfPrinter(fonts);

// Helper function to format currency
const formatCurrency = (amount) => {
  // Format the number first
  const formattedNumber = Number(amount).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    useGrouping: true
  });
  
  // Replace the problematic ₹ symbol with Rs.
  return `Rs. ${formattedNumber}`;
};

// Helper function to calculate total income for a project
const calculateTotalIncome = async (projectId) => {
  const incomeEntries = await Entry.find({
    projectId: projectId,
    type: 'Income',
    isIncomeFromOtherProject: { $ne: true } // Exclude income from other projects
  });
  
  return incomeEntries.reduce((total, entry) => total + entry.amount, 0);
};

// Helper function to calculate total income from other projects for a project
const calculateIncomeFromOtherProjects = async (projectId) => {
  const incomeFromOtherProjects = await Entry.find({
    projectId: projectId,
    type: 'Income',
    isIncomeFromOtherProject: true
  });
  
  return incomeFromOtherProjects.reduce((total, entry) => total + entry.amount, 0);
};

// Helper function to generate PDF definition
const generatePdfDefinition = async (project, entry, totalIncome) => {
  const remainingPayment = project.budget - totalIncome;
  
  // Company details (match with interior bill)
  const companyDetails = {
    name: 'JK Interiors',
    address: '502, Spellbound towers,Sainikpuri,Secunderabad,Telangana 501301',
    phones: ['080-41154115', '+91 9845157333']
  };
  
  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 60],
    defaultStyle: {
      font: 'Helvetica'
    },
    footer: function(currentPage, pageCount) {
      return {
        columns: [
          { text: 'Page ' + currentPage.toString() + ' of ' + pageCount, alignment: 'center', style: 'pageNumber' }
        ],
        margin: [40, 0]
      };
    },
    content: [
      // Company Header with background
      {
        canvas: [{
          type: 'rect',
          x: 0,
          y: 0,
          w: 515,
          h: 100,
          color: '#FFFFFF',
          lineWidth: 1
        }]
      },
      {
        columns: [
          {
            width: 100,
            image: path.join(__dirname, '..', 'assets', 'jk.png'),
            margin: [0, 10, 0, 10]
          },
          {
            width: '*',
            stack: [
              { text: companyDetails.name, style: 'companyName', alignment: 'right' },
              { text: companyDetails.address, style: 'companyDetails', alignment: 'right' },
              { text: companyDetails.phones.join(' | '), style: 'companyDetails', alignment: 'right' }
            ],
            margin: [0, 10, 0, 10]
          }
        ],
        absolutePosition: { x: 40, y: 40 }
      },
      // Payment Bill Header
      {
        text: 'PAYMENT BILL',
        style: 'mainHeader',
        alignment: 'center',
        margin: [0, 30, 0, 20]
      },
      // Bill Details in a box
      {
        style: 'billDetails',
        table: {
          widths: ['*', '*'],
          body: [
            [
              { text: `Bill Number: ${entry._id}`, style: 'billDetailsCell' },
              { text: `Date: ${new Date().toLocaleDateString('en-IN')}`, style: 'billDetailsCell', alignment: 'right' }
            ],
            [
              {
                stack: [
                  { text: `Project: ${project.name}`, style: 'customerName', margin: [0, 0, 0, 8] }
                ],
                colSpan: 2
              },
              {}
            ]
          ]
        },
        layout: {
          hLineWidth: function(i, node) { return 0.5; },
          vLineWidth: function(i, node) { return 0.5; },
          hLineColor: function(i, node) { return '#7F5539'; },
          vLineColor: function(i, node) { return '#7F5539'; },
          paddingLeft: function(i, node) { return 15; },
          paddingRight: function(i, node) { return 15; },
          paddingTop: function(i, node) { return 12; },
          paddingBottom: function(i, node) { return 12; }
        },
        margin: [0, 0, 0, 20]
      },
      // Payment Details Table
      {
        style: 'itemsTable',
        table: {
          headerRows: 1,
          widths: ['*', 'auto'],
          body: [
            [
              { text: 'Payment Details', style: 'tableHeader', colSpan: 2 },
              {}
            ],
            [
              { text: 'Total Budget', style: 'tableCell' },
              { text: formatCurrency(project.budget), style: 'tableCell', alignment: 'right' }
            ],
            [
              { text: 'Current Payment', style: 'tableCell' },
              { text: formatCurrency(entry.amount), style: 'tableCell', alignment: 'right' }
            ],
            [
              { text: 'Total Payments Received', style: 'tableCell' },
              { text: formatCurrency(totalIncome), style: 'tableCell', alignment: 'right' }
            ],
            [
              { text: 'Remaining Payment', style: 'tableCell' },
              { text: formatCurrency(remainingPayment), style: 'tableCell', alignment: 'right' }
            ]
          ]
        },
        layout: {
          hLineWidth: function(i, node) { return (i === 0 || i === node.table.body.length) ? 2 : 1; },
          vLineWidth: function(i, node) { return 1; },
          hLineColor: function(i, node) { return '#7F5539'; },
          vLineColor: function(i, node) { return '#7F5539'; },
          fillColor: function(rowIndex, node, columnIndex) {
            return (rowIndex === 0) ? '#F5EBE0' : null;
          }
        }
      },
      // Entry Details
      {
        style: 'termsSection',
        table: {
          widths: ['*'],
          body: [
            [{ text: 'ENTRY DETAILS', style: 'termsHeader', alignment: 'center' }],
            [{
              stack: [
                { text: `Category: ${entry.category}`, style: 'terms' },
                { text: `Date: ${new Date(entry.date).toLocaleDateString('en-IN')}`, style: 'terms' }
              ],
              margin: [20, 10, 20, 10]
            }]
          ]
        },
        layout: {
          hLineWidth: function(i, node) { return 0.5; },
          vLineWidth: function(i, node) { return 0.5; },
          hLineColor: function(i, node) { return '#7F5539'; },
          vLineColor: function(i, node) { return '#7F5539'; }
        },
        margin: [0, 20, 0, 0]
      },
      // Footer
      {
        stack: [
          { text: 'Thanking you,', style: 'footer', alignment: 'center' },
          { text: companyDetails.name, style: 'footerCompany', alignment: 'center' }
        ],
        margin: [0, 20, 0, 0]
      }
    ],
    styles: {
      companyName: {
        fontSize: 24,
        bold: true,
        color: '#7F5539'
      },
      companyDetails: {
        fontSize: 11,
        color: '#9C6644',
        margin: [0, 5, 0, 0]
      },
      mainHeader: {
        fontSize: 20,
        bold: true,
        color: '#7F5539'
      },
      billDetailsCell: {
        fontSize: 11,
        color: '#7F5539'
      },
      tableHeader: {
        bold: true,
        fontSize: 11,
        color: '#7F5539',
        fillColor: '#F5EBE0',
        margin: [5, 8, 5, 8]
      },
      tableCell: {
        fontSize: 10,
        color: '#333333',
        margin: [5, 5, 5, 5]
      },
      termsHeader: {
        fontSize: 14,
        bold: true,
        color: '#7F5539',
        margin: [0, 10, 0, 10]
      },
      terms: {
        fontSize: 10,
        color: '#333333',
        margin: [0, 5, 0, 5]
      },
      termsSection: {
        margin: [0, 30, 0, 0]
      },
      footer: {
        fontSize: 12,
        color: '#7F5539',
        margin: [0, 40, 0, 10]
      },
      footerCompany: {
        fontSize: 14,
        bold: true,
        color: '#7F5539',
        margin: [0, 5, 0, 0]
      },
      pageNumber: {
        fontSize: 10,
        color: '#7F5539',
        margin: [0, 10, 0, 0]
      },
      customerName: {
        fontSize: 12,
        bold: true,
        color: '#7F5539'
      },
      customerInfo: {
        fontSize: 11,
        color: '#7F5539',
        lineHeight: 1.3
      }
    }
  };
};

// Add an entry (Income/Expense)

router.get('/', async (req, res) => {
  try {
    const { userId, projectId } = req.query;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const entries = await Entry.find({ 
      userId,
      projectId 
    }).sort({ date: -1 });
    
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, projectId, type, amount, category, description, date, generateBill } = req.body;

    if (!userId || !projectId || !type || !amount || !category) {
      return res.status(400).json({ 
        message: 'userId, projectId, type, amount and category are required fields' 
      });
    }

    // If it's a custom category (not in default list), save it
    const defaultCategories = {
      Expense: [
        "Food", "Accommodation", "Carpenter", "Carpenter material", "Painter", 
        "Paint material", "Fall ceiling", "Ceiling material", "Electrian", 
        "Electrical material", "Jashwanth", "kushal", "JK", "Plumber", 
        "Plumbing material", "Tiles", "Tiles material", "Glass", "Other"
      ],
      Income: ["Advance", "Payment", "Token", "Other"]
    };

    if (!defaultCategories[type].includes(category)) {
      // Check if category already exists
      const existingCategory = await Category.findOne({ userId, type, category });
      if (!existingCategory) {
        const newCategory = new Category({
          userId,
          type,
          category
        });
        await newCategory.save();
      }
    }

    const entry = new Entry({
      userId,
      projectId,
      type,
      amount,
      category,
      description,
      date: date || Date.now(),
      isIncomeFromOtherProject: false, // Default to false
      sourceProjectId: null // Default to null
    });

    await entry.save();

    // Generate payment bill only for income entries and if generateBill is true
    if (type === 'Income' && generateBill) {
      const project = await Project.findById(projectId);
      if (!project) {
        return res.status(404).json({ message: 'Project not found' });
      }

      // Calculate total income including the current entry
      const totalIncome = await calculateTotalIncome(projectId);
      const remainingPayment = project.budget - totalIncome;

      // Generate PDF document
      const docDefinition = await generatePdfDefinition(project, entry, totalIncome);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      
      // Convert PDF to buffer
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.status(201).json({
          entry,
          paymentBill: {
            data: pdfBuffer.toString('base64'),
            remainingPayment
          }
        });
      });
      pdfDoc.end();
    } else {
      res.status(201).json({ entry });
    }
  } catch (error) {
    console.error('Error creating entry:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add shared expense across in-progress projects
router.post('/shared-expense', async (req, res) => {
  try {
    const { userId, amount, category, description, date } = req.body;

    if (!userId || !amount || !category) {
      return res.status(400).json({
        message: 'userId, amount, and category are required fields'
      });
    }

    // Find all 'In Progress' projects for the user
    const inProgressProjects = await Project.find({
      userId,
      status: 'In Progress'
    });

    if (inProgressProjects.length === 0) {
      return res.status(400).json({
        message: 'No in-progress projects found to distribute the expense'
      });
    }

    // Calculate distributed amount per project
    const distributedAmount = amount / inProgressProjects.length;
    const entries = [];

    // Create expense entries for each project
    for (const project of inProgressProjects) {
      const entry = new Entry({
        userId,
        projectId: project._id,
        type: 'Expense',
        amount: distributedAmount,
        category,
        description: description ? `${description} (Shared Expense)` : 'Shared Expense',
        date: date || Date.now(),
        isSharedExpense: true,
        originalAmount: amount
      });

      await entry.save();
      entries.push(entry);
    }

    res.status(201).json({
      message: 'Shared expense created successfully',
      originalAmount: amount,
      distributedAmount,
      numberOfProjects: inProgressProjects.length,
      entries
    });

  } catch (error) {
    console.error('Shared expense error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a route to get all shared expenses
router.get('/shared-expenses/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const sharedExpenses = await Entry.find({
      userId,
      isSharedExpense: true
    }).populate('projectId', 'name');

    // Group shared expenses by original entry
    const groupedExpenses = sharedExpenses.reduce((acc, entry) => {
      const key = `${entry.date}_${entry.originalAmount}_${entry.category}`;
      if (!acc[key]) {
        acc[key] = {
          date: entry.date,
          originalAmount: entry.originalAmount,
          distributedAmount: entry.amount,
          category: entry.category,
          description: entry.description,
          projects: []
        };
      }
      acc[key].projects.push({
        projectId: entry.projectId._id,
        projectName: entry.projectId.name,
        amount: entry.amount
      });
      return acc;
    }, {});

    res.status(200).json(Object.values(groupedExpenses));
  } catch (error) {
    console.error('Get shared expenses error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an entry (add this before the PATCH route)
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description, date } = req.body;

    const entry = await Entry.findByIdAndUpdate(
      id,
      { type, amount, category, description, date },
      { new: true }
    );

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Entry updated successfully', entry });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an entry
router.patch('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description, date } = req.body;

    const entry = await Entry.findByIdAndUpdate(
      id,
      { type, amount, category, description, date },
      { new: true }
    );

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Entry updated successfully', entry });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await Entry.findByIdAndDelete(id);

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate Excel for project entries
router.get('/export/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    // Fetch all entries for the project
    const entries = await Entry.find({ projectId })
      .sort({ date: -1 })
      .populate('userId', 'name email')
      .lean();

    if (!entries || entries.length === 0) {
      return res.status(404).json({ message: 'No entries found for this project' });
    }

    // Format data for Excel
    const workbookData = entries.map(entry => ({
      Date: new Date(entry.date).toLocaleDateString(),
      Type: entry.type,
      Amount: entry.amount,
      Category: entry.category,
      Description: entry.description || '',
      
      'User Email': entry.userId.email
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(workbookData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Entries');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=project-entries-${projectId}.xlsx`);
    
    // Send the file
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Modify the get payment bill route
router.get('/:id/payment-bill', async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id);
    if (!entry || entry.type !== 'Income') {
      return res.status(404).json({ message: 'Income entry not found' });
    }

    const project = await Project.findById(entry.projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // Calculate total income
    const totalIncome = await calculateTotalIncome(entry.projectId);

    // Generate PDF document
    const docDefinition = await generatePdfDefinition(project, entry, totalIncome);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=payment-bill-${entry._id}.pdf`);

    // Pipe the PDF document to the response
    pdfDoc.pipe(res);
    pdfDoc.end();
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});
// Add these routes before module.exports = router;

// Get all custom categories for a user
router.get('/categories/:userId', async (req, res) => {
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
router.post('/categories', async (req, res) => {
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

// Get income entries for in-progress projects
router.get('/income/in-progress', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    // Find all in-progress projects for the user
    const inProgressProjects = await Project.find({
      userId,
      status: 'In Progress'
    });

    if (inProgressProjects.length === 0) {
      return res.status(200).json({ entries: [] });
    }

    // Get all income entries for these projects
    const entries = await Entry.find({
      userId,
      projectId: { $in: inProgressProjects.map(p => p._id) },
      type: 'Income'
    })
    .populate('projectId', 'name budget')
    .sort({ date: -1 });

    res.status(200).json(entries);
  } catch (error) {
    console.error('Get income entries error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add income from other project
router.post('/income-from-project', async (req, res) => {
  try {
    const { userId, currentProjectId, sourceProjectName, amount, description, date, generateBill } = req.body;

    if (!userId || !currentProjectId || !sourceProjectName || !amount) {
      return res.status(400).json({ 
        message: 'userId, currentProjectId, sourceProjectName, and amount are required fields' 
      });
    }

    // Find the source project by name
    const sourceProject = await Project.findOne({ 
      userId, 
      name: sourceProjectName 
    });

    if (!sourceProject) {
      return res.status(404).json({ message: 'Source project not found' });
    }

    // Create income entry for current project (marked as income from other project)
    const incomeEntry = new Entry({
      userId,
      projectId: currentProjectId,
      type: 'Income',
      amount: parseFloat(amount),
      category: sourceProjectName,
      description: description || `Income from ${sourceProjectName}`,
      date: date || Date.now(),
      isIncomeFromOtherProject: true,
      sourceProjectId: sourceProject._id
    });

    await incomeEntry.save();

    // Create expense entry for the source project
    const expenseEntry = new Entry({
      userId,
      projectId: sourceProject._id,
      type: 'Expense',
      amount: parseFloat(amount),
      category: 'Project Payment',
      description: `Payment to ${(await Project.findById(currentProjectId)).name}`,
      date: date || Date.now()
    });

    await expenseEntry.save();

    // Generate payment bill if requested
    if (generateBill) {
      const currentProject = await Project.findById(currentProjectId);
      if (!currentProject) {
        return res.status(404).json({ message: 'Current project not found' });
      }

      // Calculate total income (excluding income from other projects)
      const totalIncome = await calculateTotalIncome(currentProjectId);
      const remainingPayment = currentProject.budget - totalIncome;

      // Generate PDF document
      const docDefinition = await generatePdfDefinition(currentProject, incomeEntry, totalIncome);
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      
      // Convert PDF to buffer
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => {
        const pdfBuffer = Buffer.concat(chunks);
        res.status(201).json({
          incomeEntry,
          expenseEntry,
          paymentBill: {
            data: pdfBuffer.toString('base64'),
            remainingPayment
          }
        });
      });
      pdfDoc.end();
    } else {
      res.status(201).json({ 
        incomeEntry,
        expenseEntry
      });
    }
  } catch (error) {
    console.error('Error creating income from project:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add a route to get income from other projects for a specific project
router.get('/income-from-other-projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const incomeFromOtherProjects = await Entry.find({
      userId,
      projectId,
      type: 'Income',
      isIncomeFromOtherProject: true
    })
    .populate('sourceProjectId', 'name')
    .sort({ date: -1 });

    res.status(200).json(incomeFromOtherProjects);
  } catch (error) {
    console.error('Get income from other projects error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
