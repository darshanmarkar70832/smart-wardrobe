#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <FastLED.h>
#include <HX711_ADC.h>

// WiFi credentials - Replace with your WiFi details
const char* ssid = "";       // 👈 Change this to your WiFi name
const char* password = ""; // 👈 Change this to your WiFi password

// LED configuration
#define LED_PIN     5  // GPIO pin connected to the LED strip
#define NUM_LEDS    60 // Maximum number of LEDs in your strip
#define LED_TYPE    WS2811
#define COLOR_ORDER GRB

// Load Cell pins
const int HX711_dout = 19; //mcu > HX711 dout pin
const int HX711_sck = 18; //mcu > HX711 sck pin

// HX711 constructor
HX711_ADC LoadCell(HX711_dout, HX711_sck);

// Variables
float weight = 0.0;
bool ledState = false;
int activeLeds = NUM_LEDS;
const float calibrationValue = 696.0; // This value needs to be calibrated with a known weight

// Create FastLED object
CRGB leds[NUM_LEDS];

// Create web server object
WebServer server(80);

void setup() {
  // Initialize serial communication
  Serial.begin(115200);
  
  // Clear the serial monitor
  for(int i = 0; i < 5; i++) {
    Serial.println();
  }
  
  Serial.println("=======================================");
  Serial.println("   ESP32 LED & Weight Controller      ");
  Serial.println("=======================================");
  
  // Initialize LED strip first (faster response)
  FastLED.addLeds<LED_TYPE, LED_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(50);
  FastLED.clear();
  FastLED.show();
  
  // Initialize HX711
  LoadCell.begin();
  LoadCell.start(2000, false); // Don't tare on startup
  LoadCell.setCalFactor(calibrationValue);
  
  // Set to single sample for faster readings
  LoadCell.setSamplesInUse(1);
  
  // Tare the scale
  Serial.println("Taring scale...");
  LoadCell.tare();
  Serial.println("Tare complete");
  
  // Connect to WiFi
  Serial.print("\nConnecting to WiFi network: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  // Try to connect to WiFi for maximum 10 seconds
  int wifiAttempts = 0;
  while (WiFi.status() != WL_CONNECTED && wifiAttempts < 20) {
    delay(500);
    Serial.print(".");
    wifiAttempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n=======================================");
    Serial.println("          WiFi Connected!             ");
    Serial.println("---------------------------------------");
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("MAC Address: ");
    Serial.println(WiFi.macAddress());
    Serial.print("Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.println("=======================================");
  } else {
    Serial.println("\n=======================================");
    Serial.println("          WiFi Connection Failed!      ");
    Serial.println("=======================================");
  }
  
  // Define server routes
  server.on("/", HTTP_GET, handleRoot);
  server.on("/weight", HTTP_GET, handleWeight);
  server.on("/tare", HTTP_POST, handleTare);
  server.on("/led", HTTP_POST, handleLed);
  
  // Start server
  server.begin();
  Serial.println("\nHTTP server started");
  Serial.println("You can now access the controller at:");
  Serial.print("http://");
  Serial.println(WiFi.localIP());
  Serial.println("=======================================\n");
}

void loop() {
  static unsigned long lastUpdate = 0;
  const unsigned long updateInterval = 50; // 20Hz update rate for weight
  
  // Update load cell at fixed intervals
  if (millis() - lastUpdate >= updateInterval) {
    if (LoadCell.update()) {
      weight = LoadCell.getData();
    }
    lastUpdate = millis();
  }

  // Handle web server clients
  server.handleClient();
}

void handleWeight() {
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["weight"] = weight;
  doc["unit"] = "g";
  
  String response;
  serializeJson(doc, response);
  Serial.print("Sending weight: ");
  Serial.println(response);
  server.send(200, "application/json", response);
}

void handleTare() {
  Serial.println("Tare requested");
  
  // Perform tare
  LoadCell.tare();
  delay(250); // Give some time for the tare to complete
  
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["message"] = "Scale tared successfully";
  
  String response;
  serializeJson(doc, response);
  Serial.print("Tare response: ");
  Serial.println(response);
  server.send(200, "application/json", response);
}

void handleLed() {
  if (!server.hasArg("plain")) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"No data received\"}");
    return;
  }
  
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, server.arg("plain"));
  
  if (error) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid JSON\"}");
    return;
  }
  
  int numLeds = doc["numLeds"] | 0;
  
  if (numLeds < 0 || numLeds > NUM_LEDS) {
    server.send(400, "application/json", "{\"success\":false,\"message\":\"Invalid number of LEDs\"}");
    return;
  }
  
  // Optimize LED updates
  if (numLeds == 0) {
    memset(leds, 0, NUM_LEDS * sizeof(CRGB)); // Fast clear
    ledState = false;
  } else {
    for (int i = 0; i < NUM_LEDS; i++) {
      leds[i] = (i < numLeds) ? CRGB::White : CRGB::Black;
    }
    ledState = true;
  }
  
  FastLED.show();
  activeLeds = numLeds;

  // Send response before updating LEDs for faster response
  StaticJsonDocument<200> response;
  response["success"] = true;
  response["status"] = ledState ? "on" : "off";
  response["activeLeds"] = activeLeds;

  String responseStr;
  serializeJson(response, responseStr);
  server.send(200, "application/json", responseStr);
}

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>ESP32 Controller</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;text-align:center;margin:0;padding:20px;background:#f0f0f0;}";
  html += ".container{max-width:800px;margin:0 auto;background:white;padding:20px;border-radius:10px;box-shadow:0 2px 5px rgba(0,0,0,0.1);}";
  html += ".weight-display{font-size:24px;margin:20px 0;padding:20px;background:#f8f9fa;border-radius:5px;}";
  html += "button{padding:10px 20px;font-size:16px;margin:10px;cursor:pointer;border-radius:5px;border:none;}";
  html += ".on{background-color:#4CAF50;color:white;}";
  html += ".off{background-color:#f44336;color:white;}";
  html += "</style></head><body>";
  html += "<div class='container'>";
  html += "<h1>ESP32 LED & Weight Controller</h1>";
  
  // Weight Display Section
  html += "<div class='weight-display'>";
  html += "<h2>Current Weight</h2>";
  html += "<div id='weightValue'>Loading...</div>";
  html += "</div>";
  
  // LED Control Section
  html += "<div class='led-control'>";
  html += "<h2>LED Control</h2>";
  html += "<p>Current status: <span id='status'>" + String(ledState ? "ON" : "OFF") + "</span></p>";
  html += "<p>Active LEDs: <span id='activeLeds'>" + String(activeLeds) + "</span></p>";
  html += "<button id='toggleBtn' class='" + String(ledState ? "on" : "off") + "'>";
  html += String(ledState ? "Turn OFF" : "Turn ON") + "</button>";
  html += "</div>";
  
  // JavaScript for real-time updates
  html += "<script>";
  // LED Control
  html += "const btn=document.getElementById('toggleBtn');const status=document.getElementById('status');";
  html += "btn.addEventListener('click',()=>{fetch('/led',{method:'POST',headers:{'Content-Type':'application/json'},";
  html += "body:JSON.stringify({action:status.textContent==='ON'?'off':'on',numLeds:" + String(activeLeds) + "})}).then(r=>r.json()).then(data=>{";
  html += "if(data.success){status.textContent=data.status.toUpperCase();btn.textContent=data.status==='on'?'Turn OFF':'Turn ON';";
  html += "btn.className=data.status==='on'?'on':'off';}});});";
  
  // Weight Updates
  html += "function updateWeight(){fetch('/weight').then(r=>r.json()).then(data=>{";
  html += "document.getElementById('weightValue').textContent=`${data.weight.toFixed(1)} ${data.unit}`;});}";
  html += "updateWeight();setInterval(updateWeight,1000);"; // Update weight every second
  html += "</script></div></body></html>";
  
  server.send(200, "text/html", html);
} 