const express = require('express');
const router = express.Router();
const PdfPrinter = require('pdfmake');
const auth = require('../middleware/auth');
const InteriorBill = require('../models/InteriorBill');
const Project = require('../models/Project'); // Add this import
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
            title,
            clientName,
            clientEmail,
            clientPhone,
            clientAddress,
            items,
            companyDetails,
            paymentTerms,
            termsAndConditions,
            documentType,
            discount
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
                item.total = item.pricePerUnit; // For Lump sum and Ls items
            }
            return item;
        });

        const grandTotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);
        const discountAmount = discount || 0;
        const finalAmount = grandTotal - discountAmount;

        // Generate bill number with current timestamp
        const billNumber = 'INT-' + Date.now();

        const bill = new InteriorBill({
            billNumber,
            title,
            clientName,
            clientEmail,
            clientPhone,
            clientAddress,
            items: calculatedItems,
            grandTotal,
            discount: discountAmount,
            finalAmount,
            companyDetails,
            paymentTerms,
            termsAndConditions: processedTerms,
            date: new Date(),
            documentType: documentType || 'Invoice' 
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
        const bills = await InteriorBill.find()
            .sort({ date: -1 }) // Sort by date in descending order (newest first)
            .populate('originalBillId', 'billNumber'); // Optionally populate original bill reference
        
        res.json({
            success: true,
            data: bills
        });
    } catch (error) {
        console.error('Error fetching bills:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching bills',
            error: error.message
        });
    }
});

// Get all unconnected bills - Move this BEFORE the /:id routes
router.get('/bills/unconnected', auth, async (req, res) => {
    try {
        const bills = await InteriorBill.find({ projectId: null })
            .sort({ date: -1 })
            .populate('originalBillId', 'billNumber');

        res.json({
            success: true,
            data: bills
        });
    } catch (error) {
        console.error('Error fetching unconnected bills:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching unconnected bills',
            error: error.message
        });
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

// Update bill
router.put('/bills/:id', auth, async (req, res) => {
    try {
        const {
            title,
            clientName,
            clientEmail,
            clientPhone,
            clientAddress,
            items,
            companyDetails,
            paymentTerms,
            termsAndConditions,
            documentType,
            discount,
            date // Add this to handle incoming date
        } = req.body;

        // Calculate totals with validation for required fields
        const calculatedItems = items.map(item => {
            const processedItem = { ...item };
            
            if (item.unit === 'Sft') {
                if (!item.width || !item.height) {
                    throw new Error('Width and height are required for Sft units');
                }
                processedItem.squareFeet = item.width * item.height;
                processedItem.total = processedItem.squareFeet * item.pricePerUnit;
            } else {
                processedItem.total = item.pricePerUnit;
                processedItem.width = undefined;
                processedItem.height = undefined;
                processedItem.squareFeet = undefined;
            }
            return processedItem;
        });

        const grandTotal = calculatedItems.reduce((sum, item) => sum + item.total, 0);
        const discountAmount = discount || 0;
        const finalAmount = grandTotal - discountAmount;

        const processedTerms = termsAndConditions.filter(term => term && term.trim() !== '');

        const updatedBill = await InteriorBill.findByIdAndUpdate(
            req.params.id,
            {
                title,
                clientName,
                clientEmail,
                clientPhone,
                clientAddress,
                items: calculatedItems,
                grandTotal,
                discount: discountAmount,
                finalAmount,
                companyDetails,
                paymentTerms,
                termsAndConditions: processedTerms,
                documentType: documentType || 'Invoice',
                date: date ? new Date(date) : undefined, // Update the date if provided
                lastModified: new Date()
            },
            { 
                new: true, 
                runValidators: true,
                context: 'query' 
            }
        );

        if (!updatedBill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        res.json({
            success: true,
            data: updatedBill
        });
    } catch (error) {
        console.error('Error updating bill:', error);
        res.status(400).json({
            success: false,
            message: 'Error updating bill',
            error: error.message
        });
    }
});

// Generate PDF for bill
router.get('/bills/:id/pdf', auth, async (req, res) => {
    try {
        const bill = await InteriorBill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        // Ensure all required fields exist with fallbacks
        const safeData = {
            companyDetails: {
                name: bill.companyDetails?.name || 'JK Interiors',
                address: bill.companyDetails?.address || '',
                phones: Array.isArray(bill.companyDetails?.phones) ? bill.companyDetails.phones : []
            },
            billNumber: bill.billNumber || 'N/A',
            date: bill.date || new Date(),
            title: bill.title || 'None',
            clientName: bill.clientName || 'N/A',
            clientPhone: bill.clientPhone || 'N/A',
            clientEmail: bill.clientEmail || 'N/A',
            clientAddress: bill.clientAddress || 'N/A',
            documentType: bill.documentType || 'Invoice',
            items: bill.items?.map(item => ({
                particular: item.particular || 'N/A',
                description: item.description || '',
                unit: item.unit || 'Lump',
                width: item.width || 0,
                height: item.height || 0,
                pricePerUnit: item.pricePerUnit || 0,
                total: item.total || 0
            })) || [],
            grandTotal: bill.grandTotal || 0,
            discount: bill.discount || 0,
            finalAmount: bill.finalAmount || 0,
            termsAndConditions: Array.isArray(bill.termsAndConditions) ? 
                bill.termsAndConditions.filter(term => term && term.trim() !== '') : []
        };


        const processedTerms = safeData.termsAndConditions.map(term => String(term));

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
            ...safeData.items.map(item => [
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
                                { text: safeData.companyDetails.name, style: 'companyName', alignment: 'right' },
                                { text: safeData.companyDetails.address, style: 'companyDetails', alignment: 'right' },
                                { text: safeData.companyDetails.phones.join(' | '), style: 'companyDetails', alignment: 'right' }
                            ],
                            margin: [0, 10, 0, 10]
                        }
                    ],
                    absolutePosition: { x: 40, y: 40 }
                },
                // Bill Header
                { 
                    columns: [
                        {
                            stack: [
                                { 
                                    text: safeData.documentType.toUpperCase(),
                                    style: 'mainHeader',
                                    alignment: 'center',
                                    margin: [0, 30, 0, 20]
                                },
                            ],
                            width: '*'
                        }
                    ]
                },
                // Bill Details in a box
                {
                    style: 'billDetails',
                    table: {
                        widths: ['*', '*'],
                        body: [
                            [
                                { text: `Bill Number: ${safeData.billNumber}`, style: 'billDetailsCell' },
                                { text: `Date: ${safeData.date.toLocaleDateString('en-IN')}`, style: 'billDetailsCell', alignment: 'right' }
                            ],
                            [
                                { 
                                    stack: [
                                        { 
                                            text: `${safeData.title === 'None' ? '' : `${safeData.title}. `}${safeData.clientName}`, 
                                            style: 'customerName', 
                                            margin: [0, 0, 0, 8] 
                                        },
                                        { text: `Phone: ${safeData.clientPhone}`, style: 'customerInfo', margin: [0, 0, 0, 8] },
                                        { text: `Email: ${safeData.clientEmail}`, style: 'customerInfo', margin: [0, 0, 0, 8] },
                                        { text: `Address: ${safeData.clientAddress}`, style: 'customerInfo' }
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
                // Grand Total and Discount
                {
                    margin: [0, 10, 0, 10],
                    table: {
                        widths: ['*', 'auto'],
                        body: [
                            [
                                {
                                    text: 'GRAND TOTAL:',
                                    style: 'grandTotalLabel',
                                    alignment: 'right',
                                    margin: [0, 0, 15, 0]
                                },
                                {
                                    text: formatCurrency(safeData.grandTotal).split('₹')[1].trim(),
                                    style: 'grandTotalAmount',
                                    alignment: 'right'
                                }
                            ],
                            safeData.discount > 0 ? [
                                {
                                    text: 'DISCOUNT:',
                                    style: 'discountLabel',
                                    alignment: 'right',
                                    margin: [0, 0, 15, 0]
                                },
                                {
                                    text: `- ${formatCurrency(safeData.discount).split('₹')[1].trim()}`,
                                    style: 'discountAmount',
                                    alignment: 'right'
                                }
                            ] : null,
                            [
                                {
                                    text: 'FINAL AMOUNT:',
                                    style: 'finalAmountLabel',
                                    alignment: 'right',
                                    margin: [0, 0, 15, 0]
                                },
                                {
                                    text: formatCurrency(safeData.finalAmount).split('₹')[1].trim(),
                                    style: 'finalAmountValue',
                                    alignment: 'right'
                                }
                            ]
                        ].filter(Boolean)
                    },
                    layout: 'noBorders'
                },
                // Terms and Conditions in a box (only if terms exist)
                processedTerms.length > 0 ? {
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
                } : null,
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
                    fontSize: 12,
                    bold: true,
                    color: '#7F5539'
                },
                grandTotalAmount: {
                    fontSize: 12,
                    bold: true,
                    color: '#7F5539',
                    font: 'Helvetica',
                    characterSpacing: 1
                },
                discountLabel: {
                    fontSize: 12,
                    bold: true,
                    color: '#7F5539'
                },
                discountAmount: {
                    fontSize: 12,
                    bold: true,
                    color: '#7F5539'
                },
                finalAmountLabel: {
                    fontSize: 13,
                    bold: true,
                    color: '#7F5539'
                },
                finalAmountValue: {
                    fontSize: 13,
                    bold: true,
                    color: '#7F5539'
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
                },
                mainHeader: {
                    fontSize: 20,
                    bold: true,
                    color: '#7F5539'
                }
            }
        };

        const pdfDoc = printer.createPdfKitDocument(docDefinition);

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=interior-bill-${safeData.billNumber}.pdf`);

        // Pipe the PDF to the response
        pdfDoc.pipe(res);
        pdfDoc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Error generating PDF',
                details: error.message 
            });
        }
    }
});

// Duplicate bill
router.post('/bills/:id/duplicate', auth, async (req, res) => {
    try {
        // Find the original bill
        const originalBill = await InteriorBill.findById(req.params.id);
        if (!originalBill) {
            return res.status(404).json({ message: 'Original bill not found' });
        }

        // Create a new bill object with the original data
        const duplicatedBillData = originalBill.toObject();

        // Remove _id and billNumber from the duplicated data
        delete duplicatedBillData._id;
        delete duplicatedBillData.billNumber;
        
        // Generate new bill number with current timestamp
        duplicatedBillData.billNumber = 'INT-' + Date.now();
        
        // Set the bill type as DUPLICATE and store reference to original
        duplicatedBillData.billType = 'DUPLICATE';
        duplicatedBillData.originalBillId = originalBill._id;
        
        // Update the date to current
        duplicatedBillData.date = new Date();

        // Create new bill document
        const duplicatedBill = new InteriorBill(duplicatedBillData);
        
        // Save the duplicated bill
        await duplicatedBill.save();

        res.status(201).json({
            success: true,
            data: duplicatedBill,
            message: 'Bill duplicated successfully'
        });

    } catch (error) {
        console.error('Error duplicating bill:', error);
        res.status(500).json({
            success: false,
            message: 'Error duplicating bill',
            error: error.message
        });
    }
});

// Connect bill to project
router.post('/bills/:billId/connect-project/:projectId', auth, async (req, res) => {
    try {
        const { billId, projectId } = req.params;

        // Check if bill exists and populate project details
        const bill = await InteriorBill.findById(billId);
        if (!bill) {
            return res.status(404).json({ 
                success: false,
                message: 'Bill not found' 
            });
        }

        // Check if project exists
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ 
                success: false,
                message: 'Project not found' 
            });
        }

        // If the bill is an estimate, update the project's budget
        if (bill.documentType === 'Estimate') {
            project.budget = bill.finalAmount; // Using finalAmount instead of grandTotal to account for discounts
            await project.save();
        }

        // Update bill with project reference
        bill.projectId = projectId;
        const updatedBill = await bill.save();

        // Return the updated bill with project details
        const populatedBill = await InteriorBill.findById(updatedBill._id)
            .populate('projectId', 'name status budget'); // Added budget to populated fields

        res.json({
            success: true,
            message: 'Bill connected to project successfully',
            data: populatedBill
        });

    } catch (error) {
        console.error('Error connecting bill to project:', error);
        res.status(500).json({
            success: false,
            message: 'Error connecting bill to project',
            error: error.message
        });
    }
});

// Disconnect bill from project
router.post('/bills/:billId/disconnect-project', auth, async (req, res) => {
    try {
        const { billId } = req.params;

        const bill = await InteriorBill.findById(billId);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        // If this is an estimate, remove its amount from the project's budget
        if (bill.documentType === 'Estimate' && bill.projectId) {
            const project = await Project.findById(bill.projectId);
            if (project) {
                project.budget = 0; // Reset budget to 0 when estimate is disconnected
                await project.save();
            }
        }

        bill.projectId = null;
        await bill.save();

        res.json({
            success: true,
            message: 'Bill disconnected from project successfully',
            data: bill
        });
    } catch (error) {
        console.error('Error disconnecting bill from project:', error);
        res.status(500).json({
            success: false,
            message: 'Error disconnecting bill from project',
            error: error.message
        });
    }
});

// Get all bills for a specific project
router.get('/projects/:projectId/bills', auth, async (req, res) => {
    try {
        const { projectId } = req.params;

        const bills = await InteriorBill.find({ projectId })
            .sort({ date: -1 })
            .populate('originalBillId', 'billNumber');

        res.json({
            success: true,
            data: bills
        });
    } catch (error) {
        console.error('Error fetching project bills:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching project bills',
            error: error.message
        });
    }
});

module.exports = router;