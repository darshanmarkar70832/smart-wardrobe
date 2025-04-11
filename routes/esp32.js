const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const isLoggedIn = require('../middlewares/isLoggedIn');

let lastData = null;
let lastUpdateTimestamp = 0;
const CONNECTION_TIMEOUT = 5000; // 5 seconds timeout

// ESP32 configuration
const ESP32_IP = process.env.ESP32_IP || '192.168.0.110';
const ESP32_PORT = process.env.ESP32_PORT || '80';

// Store the last received weight value
let currentWeight = 0;

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