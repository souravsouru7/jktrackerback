const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const auth = require('../middleware/auth');
const InteriorBill = require('../models/InteriorBill');
const fs = require('fs');
const path = require('path');

// Define fonts for PDF generation using standard fonts
const fonts = {
    Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique'
    }
};

const printer = new PdfPrinter(fonts);

// Helper function to format currency
const formatCurrency = (amount) => `₹ ${amount.toLocaleString('en-IN')}`;

// Create new bill
router.post('/bills', auth, async (req, res) => {
    try {
        const {
            customerName,
            items,
            companyDetails,
            paymentTerms,
            termsAndConditions
        } = req.body;

        // Convert terms and conditions to strings if they're objects
        const processedTerms = termsAndConditions.map(term => 
            typeof term === 'object' && term.text ? term.text : String(term)
        );

        // Calculate totals
        const calculatedItems = items.map(item => {
            if (item.unit === 'Sft') {
                item.squareFeet = item.width * item.height;
                item.total = item.squareFeet * item.pricePerUnit;
            } else {
                item.total = item.pricePerUnit; // For Lump sum items
            }
            return item;
        });

        const grandTotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);

        // Generate bill number with current timestamp
        const billNumber = 'INT-' + Date.now();

        const bill = new InteriorBill({
            billNumber,
            customerName,
            items: calculatedItems,
            grandTotal,
            companyDetails,
            paymentTerms,
            termsAndConditions: processedTerms,
            date: new Date()
        });

        await bill.save();
        res.status(201).json(bill);
    } catch (error) {
        console.error('Bill creation error:', error);
        res.status(400).json({ message: error.message });
    }
});

// Get all bills
router.get('/bills', auth, async (req, res) => {
    try {
        const bills = await InteriorBill.find().sort({ date: -1 });
        res.json(bills);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get single bill
router.get('/bills/:id', auth, async (req, res) => {
    try {
        const bill = await InteriorBill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }
        res.json(bill);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Generate PDF for bill
router.get('/bills/:id/pdf', auth, async (req, res) => {
    try {
        const bill = await InteriorBill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        // Ensure terms and conditions are strings
        const processedTerms = bill.termsAndConditions.map(term => String(term));

        // Create table data for items with enhanced styling
        const tableBody = [
            [
                { text: 'Particular', style: 'tableHeader' },
                { text: 'Description', style: 'tableHeader' },
                { text: 'Unit', style: 'tableHeader' },
                { text: 'Width', style: 'tableHeader', alignment: 'right' },
                { text: 'Height', style: 'tableHeader', alignment: 'right' },
                { text: 'Sft', style: 'tableHeader', alignment: 'right' },
                { text: 'Price', style: 'tableHeader', alignment: 'right' },
                { text: 'Total', style: 'tableHeader', alignment: 'right' }
            ],
            ...bill.items.map(item => [
                { text: item.particular, style: 'tableCell' },
                { text: item.description, style: 'tableCell' },
                { text: item.unit, style: 'tableCell' },
                { text: item.unit === 'Sft' ? item.width.toString() : '-', style: 'tableCell', alignment: 'right' },
                { text: item.unit === 'Sft' ? item.height.toString() : '-', style: 'tableCell', alignment: 'right' },
                { text: item.unit === 'Sft' ? (item.width * item.height).toString() : '-', style: 'tableCell', alignment: 'right' },
                { text: formatCurrency(item.pricePerUnit), style: 'tableCell', alignment: 'right' },
                { text: formatCurrency(item.total), style: 'tableCell', alignment: 'right' }
            ])
        ];

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
                    
                        color: '#FFFFFF',  // Set the border color to white
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
                                { text: bill.companyDetails.name, style: 'companyName', alignment: 'right' },
                                { text: bill.companyDetails.address, style: 'companyDetails', alignment: 'right' },
                                { text: bill.companyDetails.phones.join(' | '), style: 'companyDetails', alignment: 'right' }
                            ],
                            margin: [0, 10, 0, 10]
                        }
                    ],
                    absolutePosition: { x: 40, y: 40 }
                },
                // Bill Header
                { text: 'ESTIMATE', style: 'header', alignment: 'center', margin: [0, 30, 0, 20] },
                // Bill Details in a box
                {
                    style: 'billDetails',
                    table: {
                        widths: ['*', '*'],
                        body: [
                            [
                                { text: `Bill Number: ${bill.billNumber}`, style: 'billDetailsCell' },
                                { text: `Date: ${bill.date.toLocaleDateString('en-IN')}`, style: 'billDetailsCell', alignment: 'right' }
                            ],
                            [
                                { text: `Customer: ${bill.customerName}`, style: 'billDetailsCell', colSpan: 2 },
                                {}
                            ]
                        ]
                    },
                    layout: {
                        hLineWidth: function(i, node) { return 0.5; },
                        vLineWidth: function(i, node) { return 0.5; },
                        hLineColor: function(i, node) { return '#7F5539'; },
                        vLineColor: function(i, node) { return '#7F5539'; },
                        paddingLeft: function(i, node) { return 10; },
                        paddingRight: function(i, node) { return 10; },
                        paddingTop: function(i, node) { return 8; },
                        paddingBottom: function(i, node) { return 8; }
                    }
                },
                // Items Table
                {
                    style: 'itemsTable',
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
                        body: tableBody
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
                // Grand Total
                {
                    style: 'grandTotal',
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [
                                { text: 'GRAND TOTAL:', style: 'grandTotalLabel', alignment: 'right' },
                                { text: formatCurrency(bill.grandTotal), style: 'grandTotalAmount', alignment: 'right' }
                            ]
                        ]
                    },
                    layout: 'noBorders'
                },
                // Terms and Conditions in a box
                {
                    style: 'termsSection',
                    table: {
                        widths: ['*'],
                        body: [
                            [{ text: 'TERMS & CONDITIONS', style: 'termsHeader', alignment: 'center' }],
                            [{
                                ol: processedTerms,
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
                grandTotalLabel: {
                    fontSize: 14,
                    bold: true,
                    color: '#7F5539',
                    margin: [0, 10, 20, 0]
                },
                grandTotalAmount: {
                    fontSize: 14,
                    bold: true,
                    color: '#7F5539',
                    margin: [0, 10, 0, 0]
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
                }
            }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=interior-bill-${bill.billNumber}.pdf`);

        // Pipe the PDF to the response
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Error generating PDF' });
        }
    }
});
module.exports = router;