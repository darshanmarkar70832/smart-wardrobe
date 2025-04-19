const multer = require('multer');
const path = require('path');
const express = require('express');
const { check, validationResult } = require('express-validator');
const isLoggedIn = require('../middlewares/isLoggedIn');
const UserCloth = require('../models/userclothmodel');
const { bucket } = require('../config/firebase'); // Import bucket from the firebase.js
const router = express.Router();
const fs = require('fs');

// Use memory storage for multer
const upload = multer({
    storage: multer.memoryStorage(), // Use memory storage to handle file uploads in memory
    limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
    fileFilter: (req, file, cb) => {
        const fileTypes = /jpeg|jpg|png|gif/;
        const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = fileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            return cb(new Error("Only jpeg, jpg, png files are allowed"), false);
        }
    }
});

// Helper function to handle validation
const validateClothingData = [
    check('gender').notEmpty().withMessage('Gender is required.'),
    check('subcategory').notEmpty().withMessage('Subcategory is required.'),
    check('size').notEmpty().withMessage('Size is required.'),
    check('color').notEmpty().withMessage('Color is required.'),
    check('fabric').notEmpty().withMessage('Fabric type is required.'),
    check('occasion').notEmpty().withMessage('Occasion is required.'),
    check('weather').notEmpty().withMessage('Weather type is required.'),
];

// Helper function to handle errors
const handleValidationErrors = (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(400).json({ 
                success: false, 
                error: errors.array().map(err => err.msg).join(', ') 
            });
        }
        req.flash('error', errors.array().map(err => err.msg).join(', '));
        return res.redirect('/clothes/add-clothes');
    }
    return null;
};

// Route to add clothes - handles both multipart form data and JSON
router.post('/add-clothes', isLoggedIn, async (req, res) => {
    try {
        // Check if it's a JSON request from camera
        if (req.headers['content-type']?.includes('application/json')) {
            const { gender, subcategory, size, color, fabric, occasion, weather, image, weight } = req.body;
            
            // Validate required fields
            if (!gender || !subcategory || !size || !color || !fabric || !occasion || !weather) {
                return res.status(400).json({
                    success: false,
                    error: 'All fields are required'
                });
            }

            // Validate image URL
            if (!image || !image.startsWith('https://firebasestorage.googleapis.com/')) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid image URL'
                });
            }

            // Save to database
            const userId = req.user._id;
            const newCloth = new UserCloth({
                userId,
                gender,
                subcategory,
                size,
                color,
                fabric,
                occasion,
                weather,
                image: image,
                weight: weight || 0
            });

            await newCloth.save();
            return res.json({
                success: true,
                message: 'Clothing item successfully added to your wardrobe.'
            });
        }
        
        // Handle multipart form data (traditional form submission)
        upload.single('image')(req, res, async (err) => {
            if (err) {
                req.flash('error', err.message);
                return res.redirect('/clothes/add-clothes');
            }

            if (!req.file) {
                req.flash('error', 'Image is required.');
                return res.redirect('/clothes/add-clothes');
            }

            const validationError = handleValidationErrors(req, res);
            if (validationError) return validationError;

            const { gender, size, subcategory, color, fabric, occasion, weather, weight } = req.body;

            try {
                const filename = `${Date.now()}_${req.file.originalname}`;
                const file = bucket.file(filename);

                const stream = file.createWriteStream({
                    metadata: {
                        contentType: req.file.mimetype,
                    },
                });

                stream.on('error', (err) => {
                    console.error('Upload to Firebase failed:', err);
                    req.flash('error', 'Upload failed, please try again later.');
                    return res.redirect('/clothes/add-clothes');
                });

                stream.on('finish', async () => {
                    const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media`;

                    const userId = req.user._id;
                    const newCloth = new UserCloth({
                        userId,
                        gender,
                        subcategory,
                        size,
                        color,
                        fabric,
                        occasion,
                        weather,
                        image: imageUrl,
                        weight: weight || 0
                    });

                    await newCloth.save();
                    req.flash("success", "Clothing item successfully added to your wardrobe.");
                    return res.redirect('/clothes/successpage');
                });

                stream.end(req.file.buffer);
            } catch (error) {
                console.error('Error adding clothes:', error);
                req.flash('error', 'Server error, please try again later.');
                return res.redirect('/clothes/add-clothes');
            }
        });
    } catch (error) {
        console.error('Error in add-clothes route:', error);
        if (req.headers['content-type']?.includes('application/json')) {
            return res.status(500).json({
                success: false,
                error: 'Server error, please try again later.'
            });
        }
        req.flash('error', 'Server error, please try again later.');
        return res.redirect('/clothes/add-clothes');
    }
});

// Route to render the add clothes page
router.get('/add-clothes', isLoggedIn, (req, res) => {
    const error = req.flash('error');
    const success = req.flash('success');
    res.render('add-clothes', { error, success });
});

router.get("/successpage", (req, res) => {
    res.render("successpage")
});

// Route to get outfits based on filters
router.get('/get-outfits', isLoggedIn, async (req, res) => {
    const location = req.query.location;
    const apiKey = process.env.WEATHER_API_KEY;
    const userId = req.user._id;

    const { gender = '', size = '', occasion = '', weather = '', subcategory = '', color = '', fabric = '' } = req.query;

    const filterConditions = {
        userId: userId,
    };

    if (occasion) filterConditions.occasion = occasion;
    if (gender) filterConditions.gender = gender;
    if (size) filterConditions.size = size;
    if (weather) filterConditions.weather = weather;
    if (subcategory) filterConditions.subcategory = subcategory;
    if (color) filterConditions.color = color;
    if (fabric) filterConditions.fabric = fabric;

    try {
        const clothes = await UserCloth.find(filterConditions);
        res.render('get-outfits', {
            clothes,
            occasion,
            weather,
            subcategory,
            color,
            fabric,
            gender,
            size
        });
    } catch (error) {
        console.error('Error fetching wardrobe:', error);
        req.flash('error', 'Failed to fetch wardrobe items.');
        res.redirect('/intro');
    }
});

// Route to get alternative clothing options
router.get('/alternatives', isLoggedIn, async (req, res) => {
    try {
        const { type, occasion, weather } = req.query;
        const userId = req.user._id;

        // Build the query based on the clothing type and other parameters
        const query = {
            userId,
            $or: [
                { subcategory: { $regex: type, $options: 'i' } },
                { category: { $regex: type, $options: 'i' } }
            ]
        };

        // Add optional filters if provided
        if (occasion) query.occasion = occasion;
        if (weather) query.weather = weather;

        // Find alternative clothing items
        const alternatives = await UserCloth.find(query).limit(6);

        res.json({ success: true, alternatives });
    } catch (error) {
        console.error('Error fetching alternatives:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch alternative options' 
        });
    }
});

// Route to handle Gemini's outfit suggestions
router.post('/api/gemini/generate-description', async (req, res) => {
    try {
        const { prompt } = req.body;
        
        // Get the response from Gemini (this is a placeholder - replace with actual Gemini API call)
        const description = await getGeminiResponse(prompt);
        
        // Format the response to be concise (max 2 lines)
        const formattedDescription = formatGeminiResponse(description);
        
        res.json({ success: true, description: formattedDescription });
    } catch (error) {
        console.error('Error getting Gemini response:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get outfit suggestions' 
        });
    }
});

function formatGeminiResponse(description) {
    // Remove any extra explanations and keep only the outfit recommendation
    const lines = description.split('\n').filter(line => line.trim());
    const mainRecommendation = lines[0]; // Take only the first line
    
    // Ensure the response is concise and properly formatted
    return mainRecommendation
        .replace(/Given your wardrobe and .+?, /g, '')  // Remove context prefix
        .replace(/\. The .+ are .+$/g, '')  // Remove explanations
        .replace(/\. However.+$/g, '')      // Remove additional context
        .trim();
}

module.exports = router; 
