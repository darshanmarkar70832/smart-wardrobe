const express = require("express");
const router = express.Router();
const flash = require("flash")
const isLoggedIn = require('../middlewares/isLoggedIn')
const UserCloth = require('../models/userclothmodel');


router.get("/", (req, res) => {
    const messages = {
        error: req.flash("error"),
        success: req.flash("success"),
    };
    res.render("index",{messages});
});

router.get("/intro",isLoggedIn, (req, res) => {
    const messages = {
        error: req.flash("error"),
        success: req.flash("success"),
    };
    res.render("intro",{messages});
});
router.get('/add-clothes', (req, res) => {
    // Get flash messages from session
    const error = req.flash('error');
    const success = req.flash('success');
    
    // Render the add-clothes view and pass the messages
    res.render('add-clothes', { error, success }); // Pass error and success to the view
});
router.get('/get-outfits', isLoggedIn, async (req, res) => {
    const { occasion, weather, subcategory, color, fabric } = req.query; // Get filter values from query

    try {
        // Create filter conditions based on user ID and optional filters
        const filterConditions = { userId: req.user._id }; // Always include userId

        if (occasion) filterConditions.occasion = occasion;
        if (weather) filterConditions.weather = weather;
        if (subcategory) filterConditions.subcategory = subcategory;
        if (color) filterConditions.color = color;
        if (fabric) filterConditions.fabric = fabric;

        const clothes = await UserCloth.find(filterConditions); // Fetch clothes based on filters
        res.render('get-outfits', {
            clothes,
            occasion, // Pass occasion to the view
            weather, // Pass weather to the view
            subcategory, // Pass subcategory to the view
            color, // Pass color to the view
            fabric, // Pass fabric to the view
        }); // Render the get-outfit view and pass the clothes
    } catch (error) {
        console.error('Error retrieving clothes:', error);
        req.flash('error', 'Error retrieving your wardrobe.'); // Set flash error message
        res.redirect('/intro'); // Redirect to intro on error
    }
});

    
  


module.exports = router;