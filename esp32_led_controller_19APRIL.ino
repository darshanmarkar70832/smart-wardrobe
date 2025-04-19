#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <WebServer.h>
#include <HX711.h>
#include <ArduinoJson.h>

HX711 scale;
const int PIN_WS2811B = 15;  //--> The ESP32 pin GPIO15 connected to WS2811B.
#define NUM_PIXELS  20
const int LOADCELL_DOUT_PIN = 5;
const int LOADCELL_SCK_PIN = 3;

const char* ssid = "";  //--> Your wifi name.
const char* password = "";
Adafruit_NeoPixel WS2811B_LED_STRIP(NUM_PIXELS, PIN_WS2811B, NEO_GRB + NEO_KHZ800);

WebServer server(80);
String SendHTML();

// Calibration factor - this should be adjusted based on known weights
const float SCALE_CALIBRATION_FACTOR = 2280.0;
const int SAMPLES_PER_READING = 10;

// Add global variables for weight tracking
float previousWeight = 0;
bool isFirstMeasurement = true;
unsigned long lastStableTime = 0;
const unsigned long STABILITY_DELAY = 2000; // Wait 2 seconds for weight to stabilize

float getLoadcellWeight() {
 

  // Take multiple readings for stability
  float total = 0;
  int validReadings = 0;
  
  for (int i = 0; i < SAMPLES_PER_READING; i++) {
    if (scale.wait_ready_timeout(100)) {
      float reading = scale.get_units();
      if (reading != -1) {  // Valid reading
        total += reading;
        validReadings++;
      }
    }
  }
  
  // Only return average if we got enough valid readings
  if (validReadings > SAMPLES_PER_READING / 2) {
    float currentWeight = total / validReadings;
    
    // Print both current and differential weights for debugging
    Serial.printf("Current total weight: %.1f g\n", currentWeight);
    
    if (isFirstMeasurement) {
      previousWeight = currentWeight;
      isFirstMeasurement = false;
      Serial.println("First measurement - setting baseline");
      return currentWeight;
    }
    
    // Check if weight has changed significantly (more than 5g)
    if (abs(currentWeight - previousWeight) > 5.0) {
      // Reset the stability timer
      lastStableTime = millis();
    }
    
    // If weight has been stable for STABILITY_DELAY
    if (millis() - lastStableTime >= STABILITY_DELAY) {
      float differentialWeight = currentWeight - previousWeight;
      previousWeight = currentWeight; // Update previous weight
      Serial.printf("Weight change detected: %.1f g\n", differentialWeight);
      return differentialWeight;
    }
    
    return currentWeight - previousWeight; // Return current differential
  }
  
  Serial.println("Failed to get stable reading");
  return -1;
}

float min_max(float min,float max,float length)
{ 
 float pixel=length;
 int dis=1;
 int count1=0;
 float total=0;
 int flag=0;
 int min_pixel=0;
 float minx=0.0;
 int max_pixel=0;
 int min_flag=0;
 while (true)
 {if (flag==0) 
   {total=pixel+total;
   flag=1;
   count1++;}
  else 
   {total=dis+total;
   flag=0;}
     
  if (min_flag==0 && flag==1 && total>=min)
  {if(length==0.5 || (length==3.5 && abs(total-min)>=1.75))
   { 
   min_pixel=count1-1;
   minx=min_pixel*100;
   min_flag=1;
   }}
  if (flag==1 && total>=max)
 {if ((length==0.5 && abs(total-max)<0.5)|| (length==3.5 && abs(total-max)<=1.75))
  {
   max_pixel=count1-1;
   return(max_pixel+minx);
 }
  else
 {
  max_pixel=count1-2;
  if (max_pixel<0)
  {max_pixel=0;}
  return(max_pixel+minx);}
 }}}
void ws2811b(int ledFlag)
{  
    float lis = min_max(server.arg("value4").toFloat(), server.arg("value5").toFloat(), 3.5);
    int min = lis / 100;
    int max = abs(lis - min * 100);
    Serial.println(lis);
    
    if (ledFlag == 0) {
      WS2811B_LED_STRIP.clear();   
      for (int i = min; i <= max; i++) {
        WS2811B_LED_STRIP.setPixelColor(i, WS2811B_LED_STRIP.Color(server.arg("value1").toInt(), server.arg("value2").toInt(), server.arg("value3").toInt()));
        WS2811B_LED_STRIP.show();
        WS2811B_LED_STRIP.setPixelColor(19-i, WS2811B_LED_STRIP.Color(server.arg("value1").toInt(), server.arg("value2").toInt(), server.arg("value3").toInt()));
        WS2811B_LED_STRIP.show();
      } 
    } else if (ledFlag == 1) {
      WS2811B_LED_STRIP.clear();
      for (int i = min; i <= max; i++) {
        WS2811B_LED_STRIP.setPixelColor(i, WS2811B_LED_STRIP.Color(server.arg("value1").toInt(), server.arg("value2").toInt(), server.arg("value3").toInt()));
        WS2811B_LED_STRIP.show();
        WS2811B_LED_STRIP.setPixelColor(19-i, WS2811B_LED_STRIP.Color(server.arg("value1").toInt(), server.arg("value2").toInt(), server.arg("value3").toInt()));
        WS2811B_LED_STRIP.show();
      }
    }
}

// Web server handlers
void handleRoot() {
  server.send(200, "text/html", SendHTML());
}

void handleGetWeight() {
  StaticJsonDocument<200> doc;
  float weight = getLoadcellWeight();
  
  if (weight >= 0) {
    doc["success"] = true;
    doc["weight"] = weight;
    doc["totalWeight"] = previousWeight;  // Also send total weight
    doc["isFirstMeasurement"] = isFirstMeasurement;
    doc["unit"] = "g";
  } else {
    doc["success"] = false;
    doc["error"] = "Failed to read weight";
  }
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleTare() {
  if (!scale.is_ready()) {
    server.send(500, "application/json", "{\"success\":false,\"error\":\"Scale not ready\"}");
    return;
  }
  
  scale.tare();
  server.send(200, "application/json", "{\"success\":true,\"message\":\"Scale tared successfully\"}");
}

void handleLightOn() {
  ws2811b(1); 
  Serial.println(server.arg("value1").toInt()) ;
  server.send(200, "text/plain", "Light turned ON");
}

void handleLightOff() {
  ws2811b(0); 
  server.send(200, "text/plain", "Light turned OFF");
}

void handleResetWeight() {
  isFirstMeasurement = true;
  previousWeight = 0;
  lastStableTime = 0;
  scale.tare();  // Also tare the scale
  
  StaticJsonDocument<200> doc;
  doc["success"] = true;
  doc["message"] = "Weight tracking reset";
  
  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleNotFound() {
  server.send(404, "text/plain", "Not found");
}

void setup() {
  // Initialize Serial first
  Serial.begin(115200);
  delay(1000); // Give serial a moment to initialize
  
  Serial.println("\n\n--- ESP32 Startup ---");
  Serial.println("Initializing components...");
  
  // Initialize components one by one with debug output
  
  // 1. LED Strip
  Serial.println("Initializing LED strip...");
  delay(500);
  WS2811B_LED_STRIP.begin();
  WS2811B_LED_STRIP.clear();
  WS2811B_LED_STRIP.show();
  Serial.println("LED strip initialized.");
  
  // 2. Scale
  Serial.println("Initializing scale...");
  delay(500);
  scale.begin(LOADCELL_DOUT_PIN, LOADCELL_SCK_PIN);
  // Try to check if scale is responding
  while (!scale.is_ready()) {
    Serial.println("HX711 not found or not ready. Check wiring!");
    // Continue anyway, but mark the error
  }
    Serial.println("HX711 found, setting up scale...");
    scale.set_scale(SCALE_CALIBRATION_FACTOR);
    scale.tare();
    Serial.println("Scale initialized.");
  
  
  // 3. WiFi - with timeout and status updates
  Serial.println("Connecting to WiFi...");
  WiFi.begin(ssid, password);
  
  // Wait for connection with timeout
  int wifiTimeout = 0;
  while (WiFi.status() != WL_CONNECTED && wifiTimeout < 20) { // 10 second timeout
    delay(500);
    Serial.print(".");
    wifiTimeout++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("");
    Serial.print("Connected to ");
    Serial.println(ssid);
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    // 4. Setup web server routes
    Serial.println("Setting up web server...");
    server.on("/", HTTP_GET, handleRoot);
    server.on("/weight", HTTP_GET, handleGetWeight);
    server.on("/tare", HTTP_POST, handleTare);
    server.on("/light/on", HTTP_GET, handleLightOn);
    server.on("/light/off", HTTP_GET, handleLightOff);
    server.on("/reset-weight", HTTP_POST, handleResetWeight);
    server.onNotFound(handleNotFound);
    
    // Start server
    server.begin();
    Serial.println("HTTP server started");
  } else {
    Serial.println("Failed to connect to WiFi!");
    // Continue anyway, will try to reconnect in loop
  }
  
  Serial.println("Setup complete.");
}

void loop() {
  server.handleClient();  // Handle client requests
  
  // Small delay to prevent overwhelming the ESP32
  delay(1);
}

String SendHTML() {
  String html = "";
  
  // HTML Head
  html += "<!DOCTYPE html><html><head>";
  html += "<title>ESP32 Control Panel</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial;text-align:center;margin:0 auto;padding:20px}";
  html += ".weight-display{background:#f0f0f0;padding:20px;border-radius:10px;margin:20px auto;max-width:300px}";
  html += ".weight-value{font-size:36px;font-weight:bold;color:#333}";
  html += ".weight-unit{font-size:18px;color:#666}";
  html += ".error{color:red;font-size:14px}";
  html += ".container{display:flex;flex-direction:column;margin:0 auto;width:80%;max-width:500px}";
  html += ".button{background-color:#4CAF50;border:none;color:white;padding:15px 32px;text-align:center;font-size:16px;margin:10px;cursor:pointer;border-radius:5px}";
  html += ".button-off{background-color:#f44336}";
  html += ".data-box{background-color:#f8f9fa;border-radius:5px;padding:20px;margin:10px}";
  html += ".input-group{margin:8px 0}";
  html += ".input-group label{display:inline-block;width:100px;text-align:right;margin-right:10px}";
  html += "input[type=number]{padding:8px;border:1px solid #ddd;border-radius:4px;width:150px}";
  html += "h1{color:#0F3376}";
  html += "#weight{font-size:24px;font-weight:bold;margin:15px 0}";
  html += ".weight-status{font-size:12px;color:#666}";
  html += "</style></head>";
  
  // HTML Body
  html += "<body>";
  html += "<h1>ESP32 Control Panel</h1>";
  html += "<div class='container'>";
  
  // Weight Display Section
  html += "<div class='data-box'>";
  html += "<h3>Weight Measurement</h3>";
  html += "<div class='weight-display'>";
  html += "<h2>Weight Measurement</h2>";
  html += "<div id='weightDisplay'>";
  html += "<span class='weight-value' id='weightValue'>0.0</span>";
  html += "<span class='weight-unit'> g</span>";
  html += "</div>";
  html += "<div class='error' id='weightError'></div>";
  html += "<button onclick='tareScale()' style='margin-top:10px'>Tare Scale</button>";
  html += "</div>";
  html += "</div>";
  
  // Input Values Section
  html += "<div class='data-box'>";
  html += "<h3>Input Values</h3>";
  
  html += "<div class='input-group'>";
  html += "<label for='value1'>RED:</label>";
  html += "<input type='number' id='value1' placeholder='Enter number'>";
  html += "</div>";
  
  html += "<div class='input-group'>";
  html += "<label for='value2'>GREEN:</label>";
  html += "<input type='number' id='value2' placeholder='Enter number'>";
  html += "</div>";
  
  html += "<div class='input-group'>";
  html += "<label for='value3'>BLUE:</label>";
  html += "<input type='number' id='value3' placeholder='Enter number'>";
  html += "</div>";
  
  html += "<div class='input-group'>";
  html += "<label for='value4'>MIN:</label>";
  html += "<input type='number' id='value4' placeholder='Enter number'>";
  html += "</div>";
  
  html += "<div class='input-group'>";
  html += "<label for='value5'>MAX:</label>";
  html += "<input type='number' id='value5' placeholder='Enter number'>";
  html += "</div>";
  html += "</div>";
  
  // Light Control Section
  html += "<div class='data-box'>";
  html += "<h3>Light Control</h3>";
  html += "<button class='button' id='lightOnBtn'>Light ON</button>";
  html += "<button class='button button-off' id='lightOffBtn'>Light OFF</button>";
  html += "</div>";
  html += "</div>";
  
  // Add JavaScript for weight updates
  html += "<script>";
  html += "let lastUpdate = 0;";
  html += "function updateWeight() {";
  html += "  fetch('/weight?' + new Date().getTime())"; // Add timestamp to prevent caching
  html += "    .then(response => response.json())";
  html += "    .then(data => {";
  html += "      if(data.success) {";
  html += "        if(data.timestamp > lastUpdate) {"; // Only update if newer data
  html += "          document.getElementById('weightValue').textContent = data.weight.toFixed(1);";
  html += "          document.getElementById('weightError').textContent = '';";
  html += "          lastUpdate = data.timestamp;";
  html += "        }";
  html += "      } else {";
  html += "        document.getElementById('weightError').textContent = data.error || 'Error reading weight';";
  html += "      }";
  html += "    })";
  html += "    .catch(error => {";
  html += "      document.getElementById('weightError').textContent = 'Failed to fetch weight';";
  html += "    });";
  html += "}";
  
  html += "function tareScale() {";
  html += "  fetch('/tare', { method: 'POST' })";
  html += "    .then(response => response.json())";
  html += "    .then(data => {";
  html += "      if(data.success) {";
  html += "        document.getElementById('weightError').textContent = 'Scale tared successfully';";
  html += "        setTimeout(() => document.getElementById('weightError').textContent = '', 2000);";
  html += "      } else {";
  html += "        document.getElementById('weightError').textContent = data.error || 'Failed to tare scale';";
  html += "      }";
  html += "    })";
  html += "    .catch(error => {";
  html += "      document.getElementById('weightError').textContent = 'Failed to tare scale';";
  html += "    });";
  html += "}";
  
  // Update more frequently
  html += "setInterval(updateWeight, 500);"; // Update every 500ms
  html += "updateWeight();"; // Initial update
  
  // Light Control Function
  html += "function setLight(state){";
  html += "const values={};";
  html += "for(let i=1;i<=5;i++){values['value'+i]=document.getElementById('value'+i).value;}";
  html += "const url=new URL(state===1?'/light/on':'/light/off',window.location.origin);";
  html += "Object.keys(values).forEach(k=>url.searchParams.append(k,values[k]));";
  html += "fetch(url).then(r=>r.text()).then(d=>alert(d)).catch(e=>alert('Error: '+e));";
  html += "}";
  
  // Setup Event Listeners
  html += "document.addEventListener('DOMContentLoaded',function(){";
  html += "document.getElementById('lightOnBtn').addEventListener('click',function(){setLight(1);});";
  html += "document.getElementById('lightOffBtn').addEventListener('click',function(){setLight(0);});";
  html += "});";
  
  html += "</script></body></html>";
  
  return html;
}






