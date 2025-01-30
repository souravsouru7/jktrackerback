const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const Project = require('../models/Project');
const XLSX = require('xlsx');
const PdfPrinter = require('pdfmake');
const path = require('path');

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
const formatCurrency = (amount) => `₹ ${amount.toLocaleString('en-IN')}`;

// Helper function to calculate total income for a project
const calculateTotalIncome = async (projectId) => {
  const incomeEntries = await Entry.find({
    projectId: projectId,
    type: 'Income'
  });
  
  return incomeEntries.reduce((total, entry) => total + entry.amount, 0);
};

// Helper function to generate PDF definition
const generatePdfDefinition = async (project, entry, totalIncome) => {
  const remainingPayment = project.budget - totalIncome;
  
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
              { text: 'JK Interiors', style: 'companyName', alignment: 'right' },
              { text: 'Your Address Here', style: 'companyDetails', alignment: 'right' },
              { text: 'Phone: Your Phone Number', style: 'companyDetails', alignment: 'right' }
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
          { text: 'JK Interiors', style: 'footerCompany', alignment: 'center' }
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
    const { userId, projectId, type, amount, category, description, date } = req.body;

    if (!userId || !projectId || !type || !amount || !category) {
      return res.status(400).json({ 
        message: 'userId, projectId, type, amount and category are required fields' 
      });
    }

    const entry = new Entry({
      userId,
      projectId,
      type,
      amount,
      category,
      description,
      date: date || Date.now()
    });

    await entry.save();

    // Generate payment bill only for income entries
    if (type === 'Income') {
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
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an entry
router.patch('/:id', async (req, res) => {
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

module.exports = router;
