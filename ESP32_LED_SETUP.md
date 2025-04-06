# ESP32 LED Strip Controller Setup

This guide will help you set up your ESP32 to control a WS2811B LED strip through your web application.

## Hardware Requirements

1. ESP32 development board
2. WS2811B LED strip
3. Power supply for the LED strip (5V)
4. Jumper wires
5. USB cable for programming the ESP32

## Wiring Diagram

```
ESP32          WS2811B LED Strip
-----          ----------------
5V or 3.3V  ->  VCC (Red)
GND         ->  GND (White)
GPIO 5      ->  DIN (Green)
```

## Software Setup

### 1. Install Required Libraries

In the Arduino IDE, install the following libraries:
- FastLED
- ArduinoJson
- WiFi (included with ESP32 board support)

### 2. Configure the ESP32 Code

1. Open `esp32_led_controller.ino` in the Arduino IDE
2. Update the WiFi credentials:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Adjust the LED configuration if needed:
   ```cpp
   #define LED_PIN     5  // GPIO pin connected to the LED strip
   #define NUM_LEDS    30 // Number of LEDs in your strip
   #define LED_TYPE    WS2811
   #define COLOR_ORDER GRB
   ```

### 3. Upload the Code to ESP32

1. Connect your ESP32 to your computer via USB
2. Select the correct board and port in the Arduino IDE
3. Upload the code
4. Open the Serial Monitor (115200 baud) to see the ESP32's IP address

### 4. Configure Your Web Application

1. Update the ESP32 IP address in your Express application:
   - Open `.env` file and add:
     ```
     ESP32_IP=192.168.1.100  # Replace with your ESP32's actual IP address
     ESP32_PORT=80
     ```
   - Or update the default values in `routes/esp32.js`:
     ```javascript
     const ESP32_IP = process.env.ESP32_IP || '192.168.1.100'; // Change this to your ESP32's IP address
     const ESP32_PORT = process.env.ESP32_PORT || '80';
     ```

## Testing

1. Make sure your ESP32 and web server are on the same network
2. Access the LED control page at: `http://your-server-address/esp32`
3. Click the "Turn ON LED Strip" button to control your LED strip

## Troubleshooting

### LED Strip Not Responding
- Check the wiring connections
- Verify the LED_PIN matches your physical connection
- Ensure the power supply is adequate for your LED strip

### ESP32 Not Connecting to WiFi
- Double-check your WiFi credentials
- Make sure your WiFi network is 2.4GHz (ESP32 doesn't support 5GHz)

### Web Interface Can't Connect to ESP32
- Verify the ESP32 and web server are on the same network
- Check if the ESP32 IP address is correct in your configuration
- Try pinging the ESP32 from your computer to verify connectivity

## Advanced Customization

### Changing LED Colors
To change the default color when turning on the LEDs, modify this line in the ESP32 code:
```cpp
fill_solid(leds, NUM_LEDS, CRGB::White); // Change White to any other color
```

Available colors include: Red, Green, Blue, Yellow, Purple, Pink, Orange, etc.

### Adding Animation Effects
You can add animations by modifying the `handleLedControl` function. For example, to add a rainbow effect:
```cpp
if (strcmp(action, "on") == 0) {
  // Rainbow effect
  static uint8_t hue = 0;
  for(int i = 0; i < NUM_LEDS; i++) {
    leds[i] = CHSV(hue + (i * 256 / NUM_LEDS), 255, 255);
  }
  hue = (hue + 1) % 256;
  FastLED.show();
  ledState = true;
}
```

## Security Considerations

This basic setup doesn't include authentication. For a production environment, consider:
1. Adding authentication to your web interface
2. Implementing HTTPS for secure communication
3. Adding a firewall to restrict access to your ESP32 