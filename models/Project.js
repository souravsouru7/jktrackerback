const mongoose = require('mongoose');
const Entry = require('./Entry');

const projectSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  budget: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Under Disscussion', 'In Progress', 'Completed'],
    default: 'Under Disscussion'
  }
}, { timestamps: true });

// Add pre-remove middleware to handle entry deletion
projectSchema.pre('remove', async function(next) {
  try {
    // Delete all entries associated with this project
    await Entry.deleteMany({ projectId: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Project', projectSchema);