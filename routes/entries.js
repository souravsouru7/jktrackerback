const express = require('express');
const router = express.Router();
const Entry = require('../models/Entry');
const XLSX = require('xlsx');

// Add an entry (Income/Expense)

router.get('/', async (req, res) => {
  try {
    const { userId, projectId } = req.query;

    if (!userId || !projectId) {
      return res.status(400).json({ message: 'userId and projectId are required' });
    }

    const entries = await Entry.find({ 
      userId,
      projectId 
    }).sort({ date: -1 });
    
    res.status(200).json(entries);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, projectId, type, amount, category, description, date } = req.body;

    if (!userId || !projectId || !type || !amount || !category) {
      return res.status(400).json({ 
        message: 'userId, projectId, type, amount and category are required fields' 
      });
    }

    const entry = new Entry({
      userId,
      projectId,
      type,
      amount,
      category,
      description,
      date: date || Date.now()
    });

    await entry.save();
    res.status(201).json(entry);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update an entry
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category, description, date } = req.body;

    const entry = await Entry.findByIdAndUpdate(
      id,
      { type, amount, category, description, date },
      { new: true }
    );

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Entry updated successfully', entry });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete an entry
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const entry = await Entry.findByIdAndDelete(id);

    if (!entry) return res.status(404).json({ message: 'Entry not found' });

    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Generate Excel for project entries
router.get('/export/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    // Fetch all entries for the project
    const entries = await Entry.find({ projectId })
      .sort({ date: -1 })
      .populate('userId', 'name email')
      .lean();

    if (!entries || entries.length === 0) {
      return res.status(404).json({ message: 'No entries found for this project' });
    }

    // Format data for Excel
    const workbookData = entries.map(entry => ({
      Date: new Date(entry.date).toLocaleDateString(),
      Type: entry.type,
      Amount: entry.amount,
      Category: entry.category,
      Description: entry.description || '',
      
      'User Email': entry.userId.email
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(workbookData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Project Entries');

    // Generate buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=project-entries-${projectId}.xlsx`);
    
    // Send the file
    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
