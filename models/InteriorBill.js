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
    customerName: {
        type: String,
        required: true
    },
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
        amount: Number
    }],
    termsAndConditions: [String]
});

module.exports = mongoose.model('InteriorBill', interiorBillSchema);