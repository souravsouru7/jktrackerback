const mongoose = require('mongoose');

const interiorItemSchema = new mongoose.Schema({
    particular: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    unit: {
        type: String,
        enum: ['Sft', 'Lump'],
        required: true
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