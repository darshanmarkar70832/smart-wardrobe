const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const isLoggedIn = require('../middlewares/isLoggedIn');
const { google } = require('googleapis');
const axios = require('axios');
const cheerio = require('cheerio');

let lastData = null;
let lastUpdateTimestamp = 0;
const CONNECTION_TIMEOUT = 5000; // 5 seconds timeout

// ESP32 configuration
const ESP32_IP = '192.168.1.44';
const ESP32_PORT = process.env.ESP32_PORT || '80';

const FOLDER_ID = '1G9iMKgp5fZtNuvIqnIJnvtSMps--Th7X';
const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const auth = new google.auth.GoogleAuth({
    keyFile: 'credentials.json',
    scopes: SCOPES,
});
const drive = google.drive({ version: 'v3', auth });

// Weight data endpoint
router.get('/weight', async (req, res) => {
    try {
        console.log('Fetching weight from ESP32...');
        const url = `http://${ESP32_IP}:${ESP32_PORT}/weight`;
        console.log('Fetching from URL:', url);
        
        const response = await fetch(url, {
            timeout: 500000 // 5 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`ESP32 responded with status ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
            // Initialize session variables if they don't exist
            if (!req.session.weightHistory) {
                req.session.weightHistory = [];
            }
            if (!req.session.currentWeight) {
                req.session.currentWeight = 0;
            }

            req.session.currentWeight = data.weight;
            
            res.json({
                success: true,
                weight: data.weight,
                totalWeight: req.session.currentWeight,
                weightHistory: req.session.weightHistory,
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to get weight data',
                error: data.error
            });
        }
    } catch (error) {
        console.error('Error fetching weight:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch weight data',
            error: error.message
        });
    }
});

// Add new endpoint to handle weight measurement button click
router.post('/measure-weight', async (req, res) => {
    try {
        console.log('Measuring weight...');
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/weight`, {
            timeout: 5000
        });
        
        if (!response.ok) {
            throw new Error(`ESP32 responded with status ${response.status}`);
        }
        
        const data = await response.json();
        if (data.success) {
            // Initialize session variables if they don't exist
            if (!req.session.weightHistory) {
                req.session.weightHistory = [];
            }
            if (!req.session.currentWeight === undefined) {
                req.session.currentWeight = 0;
            }
            if (!req.session.lastTotalWeight) {
                req.session.lastTotalWeight = 0;
            }

            const currentTotalWeight = data.weight;
            console.log('Current total weight on scale:', currentTotalWeight);
            console.log('Previous total weight:', req.session.lastTotalWeight);
            console.log('Current weight history:', req.session.weightHistory);

            // Calculate the new item's weight based on the change in total weight
            const newItemWeight = currentTotalWeight - req.session.lastTotalWeight;
            
            // Only add to history if the new weight is positive and significant (> 1g)
            if (newItemWeight > 1) {
                // Store the individual item weight
                req.session.weightHistory.push(newItemWeight);
                req.session.lastTotalWeight = currentTotalWeight; // Update the last total weight
                req.session.currentWeight = newItemWeight; // Store current item weight
                
                console.log('New item weight:', newItemWeight);
                console.log('Updated weight history:', req.session.weightHistory);
                console.log('Updated last total weight:', req.session.lastTotalWeight);
                
                res.json({
                    success: true,
                    weight: newItemWeight,
                    totalWeight: currentTotalWeight,
                    weightHistory: req.session.weightHistory,
                    timestamp: new Date().toISOString()
                });
            } else {
                // If no significant weight change, return current values
                res.json({
                    success: true,
                    weight: 0,
                    totalWeight: currentTotalWeight,
                    weightHistory: req.session.weightHistory,
                    timestamp: new Date().toISOString()
                });
            }
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to get weight data',
                error: data.error
            });
        }
    } catch (error) {
        console.error('Error measuring weight:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to measure weight',
            error: error.message
        });
    }
});

// Reset weight history endpoint
router.post('/reset-weight', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/reset-weight`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`ESP32 responded with status ${response.status}`);
        }
        
        // Clear all weight-related session variables
        req.session.weightHistory = [];
        req.session.currentWeight = 0;
        req.session.lastTotalWeight = 0;
        
        res.json({
            success: true,
            message: 'Weight tracking reset',
            weightHistory: [],
            totalWeight: 0
        });
    } catch (error) {
        console.error('Error resetting weight:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset weight',
            error: error.message
        });
    }
});

// Get current weight state endpoint
router.get('/weight-state', async (req, res) => {
    try {
        // Initialize session variables if they don't exist
        if (!req.session.weightHistory) {
            req.session.weightHistory = [];
        }
        if (!req.session.currentWeight === undefined) {
            req.session.currentWeight = 0;
        }
        if (!req.session.lastTotalWeight === undefined) {
            req.session.lastTotalWeight = 0;
        }

        res.json({
            success: true,
            currentWeight: req.session.currentWeight,
            totalWeight: req.session.lastTotalWeight,
            weightHistory: req.session.weightHistory
        });
    } catch (error) {
        console.error('Error getting weight state:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get weight state',
            error: error.message
        });
    }
});

// ESP32 monitor page
router.get('/monitor', isLoggedIn, async (req, res) => {
    const isConnected = await checkESP32Connection();
    const defaultData = {
        test: 'No data available',
        counter: 'N/A',
        wifi_strength: 'N/A',
        lastUpdate: 'Never',
        temperature: 'N/A',
        humidity: 'N/A'
    };

    res.render('esp32-monitor', { 
        sensorData: isConnected ? lastData || defaultData : defaultData,
        isConnected: isConnected,
        esp32IP: ESP32_IP,
        esp32Port: ESP32_PORT
    });
});

// API endpoint for ESP32 data
router.post('/data', (req, res) => {
    lastData = {
        ...req.body,
        lastUpdate: new Date().toLocaleTimeString()
    };
    lastUpdateTimestamp = Date.now();
   
    res.sendStatus(200);
});

// Get last ESP32 data
router.get('/data', (req, res) => {
    const timeSinceLastUpdate = Date.now() - lastUpdateTimestamp;
    const isConnected = timeSinceLastUpdate < CONNECTION_TIMEOUT;

    if (!isConnected) {
        return res.status(503).json({
            error: 'ESP32 disconnected',
            lastUpdateTimestamp: lastUpdateTimestamp
        });
    }

    res.json(lastData || {
        test: 'No data available',
        counter: 'N/A',
        wifi_strength: 'N/A',
        lastUpdate: 'Never'
    });
});

// LED control endpoints
router.get('/status', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/status`, {
            timeout: 2000
        });
        res.json(await response.json());
    } catch (error) {
        console.error('Error getting LED status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get LED status',
            error: error.message
        });
    }
});

router.post('/led', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/led`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body),
            timeout: 2000
        });
        res.json(await response.json());
    } catch (error) {
        console.error('Error controlling LED:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to control LED',
            error: error.message
        });
    }
});

// Tare scale endpoint
router.post('/tare', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/tare`, {
            method: 'POST'
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error taring scale:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to tare scale'
        });
    }
});

// LED page route with additional inputs
router.get('/', (req, res) => {
    res.render('led', {
        error: '',
        success: '',
        title: 'LED Control',
        minValue: 0,
        maxValue: 100,
        numLeds: 0
    });
});

// Handle min/max values
router.post('/set-values', async (req, res) => {
    try {
        const { min, max, leds } = req.body;
        
        // Send to ESP32
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/set-values`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                min: parseInt(min) || 0,
                max: parseInt(max) || 100,
                leds: parseInt(leds) || 0
            }),
            timeout: 2000
        });

        if (!response.ok) {
            throw new Error('Failed to set values');
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error setting values:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to set values',
            error: error.message
        });
    }
});

// Function to check if ESP32 is connected
async function checkESP32Connection() {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/status`, {
            timeout: 2000 // 2 second timeout
        });
        return response.ok;
    } catch (error) {
        console.error('Error checking ESP32 connection:', error);
        return false;
    }
}

async function getLatestImageFileId() {
    try {
        const response = await drive.files.list({
            q: "mimeType contains 'image/'",
            orderBy: 'createdTime desc',
            pageSize: 5,
            fields: 'files(id, name, parents)',
        });
        console.log('Files found:', response.data.files);
        if (response.data.files && response.data.files.length > 0) {
            return response.data.files[0].id;
        }
        return null;
    } catch (error) {
        console.error('Error fetching latest image:', error);
        return null;
    }
}

// Route to render the EJS page
router.get('/esp32cam', isLoggedIn, (req, res) => {
    res.render('esp32cam');
});

// Route to stream the latest image from Google Drive
router.get('/esp32cam/latest-image', isLoggedIn, async (req, res) => {
    try {
        const fileId = await getLatestImageFileId();
        if (!fileId) {
            return res.status(404).send('No image found');
        }
        const driveResponse = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'stream' }
        );
        res.setHeader('Content-Type', 'image/jpeg');
        driveResponse.data.pipe(res);
    } catch (error) {
        console.error('Error proxying image:', error);
        res.status(500).send('Error fetching image');
    }
});

// Route to get the latest image file ID from the public folder
router.get('/esp32cam/latest-public-image', async (req, res) => {
    try {
        const folderId = '1G9iMKgp5fZtNuvIqnIJnvtSMps--Th7X';
        const url = `https://drive.google.com/drive/folders/${folderId}`;
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);

        // Find all file links (Google may change this structure, but this works for now)
        const regex = /\"(https:\/\/drive\.google\.com\/file\/d\/[a-zA-Z0-9_-]+\/view\?usp=drivesdk)\"/g;
        let match;
        let fileIds = [];
        while ((match = regex.exec(response.data)) !== null) {
            const fileId = match[1].split('/')[5];
            fileIds.push(fileId);
        }

        if (fileIds.length === 0) {
            return res.status(404).json({ error: 'No images found' });
        }

        // The last one is the latest (since Google Drive sorts by last modified)
        const latestFileId = fileIds[fileIds.length - 1];
        res.json({ imageUrl: `https://drive.google.com/uc?export=view&id=${latestFileId}` });
    } catch (error) {
        console.error('Error fetching latest public image:', error);
        res.status(500).json({ error: 'Failed to fetch latest image' });
    }
});

module.exports = router; 