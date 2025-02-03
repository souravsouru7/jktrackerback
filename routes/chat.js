const express = require('express');
const router = express.Router();
const ChatMessage = require('../models/ChatMessage');
const auth = require('../middleware/auth'); // You'll need to create this middleware
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Check if API key exists
if (!process.env.GOOGLE_API_KEY) {
    console.error('GOOGLE_API_KEY is not set in environment variables');
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// @route POST /api/chat/message
// @desc Send message to AI and get response
// @access Private
router.post('/message', auth, async (req, res) => {
    try {
        const { message } = req.body;
        
        // Call Gemini API
        let aiResponse;
        try {
            // Get the model first
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            // Generate content using the model
            const result = await model.generateContent(message);
            const response = await result.response;
            aiResponse = response.text();
        } catch (apiError) {
            console.error('Gemini API Error:', apiError);
            return res.status(429).json({
                message: 'AI Service error',
                error: apiError.message
            });
        }

        // Save the chat message
        const chatMessage = new ChatMessage({
            userId: req.user.id,
            message: message,
            response: aiResponse
        });

        await chatMessage.save();

        res.json({
            success: true,
            message: chatMessage
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ 
            message: 'Server error', 
            error: err.message,
            errorCode: err.status || 500
        });
    }
});

// @route GET /api/chat/history
// @desc Get chat history for user
// @access Private
router.get('/history', auth, async (req, res) => {
    try {
        const messages = await ChatMessage.find({ userId: req.user.id })
            .sort({ timestamp: -1 })
            .limit(50);

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router; 