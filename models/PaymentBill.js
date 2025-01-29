const mongoose = require('mongoose');

const paymentBillSchema = new mongoose.Schema({
    billNumber: {
        type: String,
        required: true,
        unique: true
    },
    projectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Project', 
        required: true 
    },
    amountReceived: {
        type: Number,
        required: true
    },
    remainingAmount: {
        type: Number,
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    notes: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('PaymentBill', paymentBillSchema);
