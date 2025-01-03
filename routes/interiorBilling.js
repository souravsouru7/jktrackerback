const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit-table');
const auth = require('../middleware/auth');
const InteriorBill = require('../models/InteriorBill');

// Create new interior bill
router.post('/bills', auth, async (req, res) => {
    try {
        const {
            customerName,
            items,
            companyDetails,
            paymentTerms,
            termsAndConditions
        } = req.body;

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

        // Generate bill number
        const billNumber = 'INT-' + Date.now();

        const bill = new InteriorBill({
            billNumber,
            customerName,
            items: calculatedItems,
            grandTotal,
            companyDetails,
            paymentTerms,
            termsAndConditions,
            date: new Date()
        });

        await bill.save();
        res.status(201).json(bill);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Generate PDF for interior bill
router.get('/bills/:id/pdf', auth, async (req, res) => {
    try {
        const bill = await InteriorBill.findById(req.params.id);
        if (!bill) {
            return res.status(404).json({ message: 'Bill not found' });
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=interior-bill-${bill.billNumber}.pdf`);

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add company header
        doc.fontSize(16).text(bill.companyDetails.name, { align: 'center' });
        doc.fontSize(10).text(bill.companyDetails.address, { align: 'center' });
        doc.fontSize(10).text(bill.companyDetails.phones.join(', '), { align: 'center' });
        doc.moveDown();

        // Add estimate header
        doc.fontSize(14).text('Estimate', { align: 'left' });
        doc.fontSize(10);
        doc.text(`DATE: ${bill.date.toLocaleDateString()}`, { align: 'left' });
        doc.text(bill.customerName, { align: 'left' });
        doc.moveDown();

        // Create items table
        const table = {
            headers: ['Particular', 'Description', 'Unit', 'Width', 'Height', 'Sft', 'Price', 'Total'],
            rows: bill.items.map(item => [
                item.particular,
                item.description,
                item.unit,
                item.unit === 'Sft' ? item.width.toString() : '-',
                item.unit === 'Sft' ? item.height.toString() : '-',
                item.unit === 'Sft' ? item.squareFeet.toString() : '-',
                item.pricePerUnit.toString(),
                `₹ ${item.total.toLocaleString('en-IN')}`
            ])
        };

        // Define custom table layout
        const tableLayout = {
            prepareHeader: () => doc.font('Helvetica-Bold').fontSize(10),
            prepareRow: () => doc.font('Helvetica').fontSize(10)
        };

        // Draw the table
        doc.table(table, {
            width: 500,
            ...tableLayout,
            padding: 5,
            columnsSize: [60, 140, 40, 40, 40, 40, 60, 80]
        });

        doc.moveDown();
        doc.fontSize(12).text(`GRAND TOTAL: ₹ ${bill.grandTotal.toLocaleString('en-IN')}`, { align: 'right' });
        doc.moveDown();

        // Payment Terms
        doc.fontSize(12).text('Terms of payment', { underline: true });
        doc.moveDown(0.5);
        bill.paymentTerms.forEach(term => {
            const amount = term.note === 'Token' 
                ? `Rs ${term.amount.toLocaleString('en-IN')} ${term.note}`
                : `${term.percentage}% - ₹ ${term.amount.toLocaleString('en-IN')}`;
            doc.fontSize(10).text(`${term.stage}: ${amount}`);
        });
        doc.moveDown();

        // Terms and Conditions
        doc.fontSize(12).text('Terms & Conditions', { underline: true });
        doc.moveDown(0.5);
        bill.termsAndConditions.forEach((term, index) => {
            doc.fontSize(10).text(`${index + 1}. ${term}`, {
                width: 500,
                align: 'left',
                lineGap: 5
            });
        });

        
        doc.moveDown();
        doc.fontSize(10).text('Thanking you', { align: 'center' });
        doc.text('JK Interiors, Jashwanth & Kushal Deep', { align: 'center' });
        doc.text(bill.companyDetails.phones.join(', '), { align: 'center' });

        // End the document
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;