const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  type: { 
    type: String, 
    enum: ['Expense', 'Income'], 
    required: true 
  },
  category: { 
    type: String, 
    required: true 
  }
}, { 
  timestamps: true 
});

// Add compound index to prevent duplicate categories for same user and type
categorySchema.index({ userId: 1, type: 1, category: 1 }, { unique: true });

module.exports = mongoose.models.Category || mongoose.model('Category', categorySchema);