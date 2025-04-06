const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const isLoggedIn = require('../middlewares/isLoggedIn');

let lastData = null;
let lastUpdateTimestamp = 0;
const CONNECTION_TIMEOUT = 5000; // 5 seconds timeout

// ESP32 configuration
const ESP32_IP = process.env.ESP32_IP || '192.168.0.110'; // Updated IP address
const ESP32_PORT = process.env.ESP32_PORT || '80';

// Store the last received weight value
let currentWeight = 0;

// Function to check if ESP32 is connected
async function checkESP32Connection() {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/status`);
        return response.ok;
    } catch (error) {
        console.error('Error checking ESP32 connection:', error);
        return false;
    }
}

// ESP32 monitor page
router.get('/monitor', isLoggedIn, (req, res) => {
    res.render('esp32-monitor', { 
        sensorData: checkESP32Connection() ? lastData : {
            test: 'No data available',
            counter: 'N/A',
            wifi_strength: 'N/A',
            lastUpdate: 'Never'
        }
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
    if (!checkESP32Connection()) {
        return res.status(503).json({
            error: 'ESP32 disconnected',
            lastUpdateTimestamp: lastUpdateTimestamp
        });
    }
    res.json(lastData);
});

// LED status endpoint
router.get('/status', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/status`);
        res.json(response.data);
    } catch (error) {
        console.error('Error getting LED status:', error.message);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get LED status',
            error: error.message
        });
    }
});

// LED control endpoint
router.post('/led', async (req, res) => {
    try {
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/led`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error controlling LED:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to control LED'
        });
    }
});

// Weight data endpoint
router.get('/weight', async (req, res) => {
    try {
        console.log('Fetching weight from ESP32...');
        const response = await fetch(`http://${ESP32_IP}:${ESP32_PORT}/weight`);
        const data = await response.json();
       
        res.json(data);
    } catch (error) {
        console.error('Error fetching weight:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch weight data',
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

// LED page route
router.get('/', (req, res) => {
    res.render('led', {
        error: '',
        success: '',
        title: 'LED Control'
    });
});

module.exports = router; 