const mongoose = require('mongoose');

const interiorItemSchema = new mongoose.Schema({
    particular: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    unit: {
        type: String,
        enum: ['Sft', 'Lump', 'Ls'],
        required: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    width: {
        type: Number,
        required: function() { return this.unit === 'Sft'; }
    },
    height: {
        type: Number,
        required: function() { return this.unit === 'Sft'; }
    },
    squareFeet: {
        type: Number,
        required: function() { return this.unit === 'Sft'; }
    },
    pricePerUnit: {
        type: Number,
        required: true
    },
    total: {
        type: Number,
        required: true
    }
});

module.exports = interiorItemSchema;