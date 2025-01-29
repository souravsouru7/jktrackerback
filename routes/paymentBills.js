const express = require('express');
const router = express.Router();
const PaymentBill = require('../models/PaymentBill');
const Project = require('../models/Project');
const auth = require('../middleware/auth');
const PdfPrinter = require('pdfmake');
const path = require('path');

// Helper function to format currency
const formatCurrency = (amount) => `₹ ${amount.toLocaleString('en-IN')}`;

// Define fonts for PDF
const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

// Generate a new payment bill
router.post('/generate', auth, async (req, res) => {
    try {
        const { projectId, amountReceived, notes } = req.body;

        // Get project details
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Calculate remaining amount
        const remainingAmount = project.budget - amountReceived;

        // Generate bill number (you can customize this format)
        const billNumber = 'BILL-' + Date.now();

        // Create new payment bill
        const paymentBill = new PaymentBill({
            billNumber,
            projectId,
            amountReceived,
            remainingAmount,
            notes
        });

        await paymentBill.save();

        res.status(201).json(paymentBill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get payment bill PDF
router.get('/:id/pdf', auth, async (req, res) => {
    try {
        const bill = await PaymentBill.findById(req.params.id)
            .populate('projectId', 'name budget');
        
        if (!bill) {
            return res.status(404).json({ message: 'Payment bill not found' });
        }

        // Create PDF document definition
        const docDefinition = {
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
                                { text: 'JK Interior', style: 'companyName', alignment: 'right' },
                                { text: '123 Main Street, City, State', style: 'companyDetails', alignment: 'right' },
                                { text: '+1234567890', style: 'companyDetails', alignment: 'right' }
                            ],
                            margin: [0, 10, 0, 10]
                        }
                    ],
                    absolutePosition: { x: 40, y: 40 }
                },
                // Payment Receipt Header
                { 
                    text: 'PAYMENT RECEIPT',
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
                                { text: `Bill Number: ${bill.billNumber}`, style: 'billDetailsCell' },
                                { text: `Date: ${new Date(bill.date).toLocaleDateString('en-IN')}`, style: 'billDetailsCell', alignment: 'right' }
                            ],
                            [
                                { 
                                    stack: [
                                        { text: `Project Name: ${bill.projectId.name}`, style: 'customerName', margin: [0, 0, 0, 8] },
                                        { text: `Project Budget: ${formatCurrency(bill.projectId.budget)}`, style: 'customerInfo', margin: [0, 0, 0, 8] }
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
                                { text: 'Description', style: 'tableHeader' },
                                { text: 'Amount', style: 'tableHeader', alignment: 'right' }
                            ],
                            [
                                { text: 'Amount Received', style: 'tableCell' },
                                { text: formatCurrency(bill.amountReceived), style: 'tableCell', alignment: 'right' }
                            ],
                            [
                                { text: 'Remaining Amount', style: 'tableCell' },
                                { text: formatCurrency(bill.remainingAmount), style: 'tableCell', alignment: 'right' }
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
                // Notes if present
                bill.notes ? {
                    style: 'termsSection',
                    table: {
                        widths: ['*'],
                        body: [
                            [{ text: 'NOTES', style: 'termsHeader', alignment: 'center' }],
                            [{
                                text: bill.notes,
                                style: 'terms',
                                margin: [20, 0, 20, 0]
                            }]
                        ]
                    },
                    layout: {
                        hLineWidth: function(i, node) { return 0.5; },
                        vLineWidth: function(i, node) { return 0.5; },
                        hLineColor: function(i, node) { return '#7F5539'; },
                        vLineColor: function(i, node) { return '#7F5539'; }
                    }
                } : null,
                // Thank you message
                {
                    text: 'Thank you for your payment!',
                    style: 'footer',
                    alignment: 'center',
                    margin: [0, 20, 0, 0]
                }
            ].filter(Boolean),
            styles: {
                header: {
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
                },
                mainHeader: {
                    fontSize: 20,
                    bold: true,
                    color: '#7F5539'
                },
                companyName: {
                    fontSize: 16,
                    bold: true,
                    color: '#7F5539'
                },
                companyDetails: {
                    fontSize: 10,
                    color: '#7F5539'
                }
            }
        };

        // Generate PDF
        const pdfDoc = printer.createPdfKitDocument(docDefinition);
        
        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=payment_receipt_${bill.billNumber}.pdf`);
        
        // Pipe the PDF document to the response
        pdfDoc.pipe(res);
        pdfDoc.end();
    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating PDF' });
        }
    }
});

// Get all payment bills for a project
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const bills = await PaymentBill.find({ projectId: req.params.projectId })
            .populate('projectId', 'name budget');
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a specific payment bill
router.get('/:id', auth, async (req, res) => {
    try {
        const bill = await PaymentBill.findById(req.params.id)
            .populate('projectId', 'name budget');
        if (!bill) {
            return res.status(404).json({ message: 'Payment bill not found' });
        }
        res.json(bill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
