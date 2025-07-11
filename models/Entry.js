const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  type: { type: String, enum: ['Income', 'Expense'], required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  description: { type: String },
  date: { type: Date, default: Date.now },
  isSharedExpense: { type: Boolean, default: false },
  originalAmount: { type: Number },
  isIncomeFromOtherProject: { type: Boolean, default: false },
  sourceProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
}, { timestamps: true });

module.exports = mongoose.models.Entry || mongoose.model('Entry', entrySchema);