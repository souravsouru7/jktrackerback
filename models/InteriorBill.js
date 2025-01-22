const mongoose = require('mongoose');
const interiorItemSchema = require('./InteriorItem');

const interiorBillSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    title: {
        type: String,
        enum: ['Mr', 'Ms'],
        required: true
    },
    clientName: { type: String, required: true },
    clientEmail: { type: String, required: true },
    clientPhone: { type: String, required: true },
    clientAddress: { type: String, required: true },
    items: [interiorItemSchema],
    grandTotal: {
        type: Number,
        required: true
    },
    companyDetails: {
        name: String,
        address: String,
        phones: [String],
    },
    paymentTerms: [{
        stage: String,
        percentage: Number,
        amount: Number,
        note: String
    }],
    termsAndConditions: [String]
});

// Add pre-save middleware to ensure termsAndConditions are strings
interiorBillSchema.pre('save', function(next) {
    // Convert terms and conditions to strings if they're objects
    if (this.termsAndConditions) {
        this.termsAndConditions = this.termsAndConditions.map(term => 
            typeof term === 'object' && term.text ? term.text : String(term)
        );
    }
    next();
});

module.exports = mongoose.model('InteriorBill', interiorBillSchema);