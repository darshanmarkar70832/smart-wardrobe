const mongoose = require("mongoose");

const userClothSchema = mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
    },
    subcategory: {
        type: String,
        required: true,
        trim: true,
        // Allow any string value for subcategory to support custom entries
    },
    color: {
        type: String,
        required: true,
        trim: true,
    },
    fabric: {
        type: String,
        required: true,
        trim: true
    },
    occasion: {
        type: String,
        required: true,
        trim: true
    },
    weather: {
        type: String,
        required: true,
        trim: true
    },
    size: {
        type: String,
        required: true,
        trim: true
    },
    gender: {
        type: String,
        required: true,
        trim: true
    },
    image: {
        type: String, // Store the image URL after upload to Firebase
        required: true,
    },
}, {
    timestamps: true, // Automatically create createdAt and updatedAt fields
});

module.exports = mongoose.model("UserCloth", userClothSchema);
