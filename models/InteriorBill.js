const mongoose = require('mongoose');
const interiorItemSchema = require('./InteriorItem');

const interiorBillSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    billType: {
        type: String,
        enum: ['ORIGINAL', 'DUPLICATE'],
        default: 'ORIGINAL'
    },
    originalBillId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InteriorBill',
        default: null
    },
    documentType: {
        type: String,
        enum: ['Invoice', 'Estimate', 'Quotation'],
        required: true,
        default: 'Invoice'
    },
    date: {
        type: Date,
        default: Date.now
    },
    title: {
        type: String,
        enum: ['Mr', 'Ms','None'],
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
    discount: {
        type: Number,
        default: 0,
        min: 0
    },
    finalAmount: {
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
    termsAndConditions: [String],
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        default: null
    }
});


interiorBillSchema.pre('save', function(next) {

    if (this.termsAndConditions) {
        this.termsAndConditions = this.termsAndConditions.map(term => 
            typeof term === 'object' && term.text ? term.text : String(term)
        );
    }
    next();
});

module.exports = mongoose.model('InteriorBill', interiorBillSchema);