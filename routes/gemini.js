const express = require('express');
const axios = require('axios');
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const UserCloth = require('../models/userclothmodel');
const isLoggedIn = require('../middlewares/isLoggedIn');

const router = express.Router();

// Check if API key is available
if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set in environment variables');
}

// Initialize Google Generative AI with the API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Helper function to categorize wardrobe items
function categorizeWardrobe(items) {
    const categories = {
        tops: [],
        bottoms: [],
        outerwear: [],
        dresses: [],
        traditional: [],
        accessories: []
    };

    items.forEach(item => {
        const subcategory = item.subcategory.toLowerCase();
        if (subcategory.includes('shirt') || subcategory.includes('t-shirt') || subcategory.includes('top')) {
            categories.tops.push(item);
        } else if (subcategory.includes('jeans') || subcategory.includes('pants') || subcategory.includes('skirt') || subcategory.includes('short')) {
            categories.bottoms.push(item);
        } else if (subcategory.includes('jacket') || subcategory.includes('coat')) {
            categories.outerwear.push(item);
        } else if (subcategory.includes('dress')) {
            categories.dresses.push(item);
        } else if (subcategory.includes('saree') || subcategory.includes('sari') || subcategory.includes('lehenga') || subcategory.includes('kurta')) {
            categories.traditional.push(item);
        }
    });

    return categories;
}

// Route to handle AI-generated content
router.post('/generate-description', isLoggedIn, async (req, res) => {
    const { prompt } = req.body;
    const userId = req.user._id;

    try {
        // Validate prompt
        if (!prompt) {
            return res.status(400).json({ message: 'Prompt is required' });
        }

        // Get the user's wardrobe items
        const userWardrobe = await UserCloth.find({ userId });
        
        // Categorize wardrobe items
        const categorizedWardrobe = categorizeWardrobe(userWardrobe);
        
        // Create a detailed context about the user's wardrobe with image URLs
        const wardrobeContext = {
            tops: categorizedWardrobe.tops.map(item => ({
                description: `${item.subcategory} (${item.color}, ${item.fabric}, ${item.occasion}, ${item.weather})`,
                imageUrl: item.image,
                gender: item.gender
            })),
            bottoms: categorizedWardrobe.bottoms.map(item => ({
                description: `${item.subcategory} (${item.color}, ${item.fabric}, ${item.occasion}, ${item.weather})`,
                imageUrl: item.image,
                gender: item.gender
            })),
            outerwear: categorizedWardrobe.outerwear.map(item => ({
                description: `${item.subcategory} (${item.color}, ${item.fabric}, ${item.occasion}, ${item.weather})`,
                imageUrl: item.image,
                gender: item.gender
            })),
            dresses: categorizedWardrobe.dresses.map(item => ({
                description: `${item.subcategory} (${item.color}, ${item.fabric}, ${item.occasion}, ${item.weather})`,
                imageUrl: item.image,
                gender: item.gender
            })),
            traditional: categorizedWardrobe.traditional.map(item => ({
                description: `${item.subcategory} (${item.color}, ${item.fabric}, ${item.occasion}, ${item.weather})`,
                imageUrl: item.image,
                gender: item.gender
            }))
        };

        // Create a structured prompt with guidelines and image context
        const enhancedPrompt = `
As a fashion expert, suggest an outfit from my wardrobe for the following request: "${prompt}"

My wardrobe contains:
Tops: ${wardrobeContext.tops.map(item => `${item.description} (Gender: ${item.gender})`).join(', ')}
Bottoms: ${wardrobeContext.bottoms.map(item => `${item.description} (Gender: ${item.gender})`).join(', ')}
Outerwear: ${wardrobeContext.outerwear.map(item => `${item.description} (Gender: ${item.gender})`).join(', ')}
Dresses: ${wardrobeContext.dresses.map(item => `${item.description} (Gender: ${item.gender})`).join(', ')}
Traditional: ${wardrobeContext.traditional.map(item => `${item.description} (Gender: ${item.gender})`).join(', ')}

Available Images:
${Object.entries(wardrobeContext).map(([category, items]) => 
    `${category.charAt(0).toUpperCase() + category.slice(1)} Images:\n${items.map(item => 
        `${item.description} (Gender: ${item.gender})\nImage URL: ${item.imageUrl}`
    ).join('\n')}`
).join('\n\n')}

Guidelines for your suggestion:
1. Only suggest items that exist in my wardrobe
2. Consider the occasion, weather, and appropriateness
3. Suggest complete outfits (including traditional wear like sarees)
4. Format each suggested item as "**Color Fabric Type**"
5. If suggesting traditional wear, consider cultural appropriateness for the occasion
6. If suggesting multiple options, prioritize the most appropriate for the occasion
7. Consider color coordination and fabric compatibility
8. Include weather-appropriate suggestions if relevant
9. Use the provided images to ensure accurate color and style matching

Please provide your suggestion in this format:
1. Main recommendation with explanation of maximum 2 lines
2. Alternative options (if available)
3. Why this outfit works for the occasion`;

        // Get the generative model
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Generate content using the enhanced prompt
        const result = await model.generateContent(enhancedPrompt);
        console.log('Generated content successfully');

        // Validate suggestions against wardrobe
        const response = result.response.text();
        const suggestedItems = response.match(/\*\*(.*?)\*\*/g) || [];
        const validSuggestions = suggestedItems.every(suggestion => {
            const [color, fabric, ...typeWords] = suggestion.replace(/\*\*/g, '').toLowerCase().split(' ');
            const type = typeWords.join(' ');
            
            return userWardrobe.some(item => {
                const itemSubcategory = item.subcategory.toLowerCase();
                const itemColor = item.color.toLowerCase();
                const itemFabric = item.fabric.toLowerCase();
                
                // Check if colors match
                const colorMatch = itemColor === color;
                
                // Check if fabrics match
                const fabricMatch = itemFabric === fabric;
                
                // Check if subcategory matches, including handling custom/other subcategories
                const typeMatch = 
                    itemSubcategory === type || // Exact match
                    (type === 'suit' && itemSubcategory.includes('suit')) || // Handle suit variations
                    (type === 'jacket' && itemSubcategory.includes('jacket')) || // Handle jacket variations
                    (type === 'saree' && (itemSubcategory.includes('saree') || itemSubcategory.includes('sari'))) || // Handle saree variations
                    (type.includes(itemSubcategory) || itemSubcategory.includes(type)); // Partial matches
                
                return colorMatch && fabricMatch && typeMatch;
            });
        });

        if (!validSuggestions) {
            // Get available formal wear from wardrobe
            const formalWear = userWardrobe.filter(item => 
                item.occasion.toLowerCase() === 'formal' || 
                item.occasion.toLowerCase() === 'business'
            );
            
            // Create a helpful error message with suggestions
            let errorMessage = 'Generated suggestions contain items not in your wardrobe. ';
            if (formalWear.length > 0) {
                errorMessage += 'However, you have these formal items available: ' + 
                    formalWear.map(item => 
                        `${item.color} ${item.fabric} ${item.subcategory}`
                    ).join(', ');
            }
            
            return res.status(400).json({ message: errorMessage });
        }

        // Send the generated text as the response
        res.status(200).json({ description: response });
    } catch (error) {
        console.error('Detailed error:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        
        // Send more detailed error information
        res.status(500).json({ 
            message: 'Failed to generate content', 
            error: error.message,
            details: error.stack
        });
    }
});

module.exports = router;