# Smart Wardrobe System

A smart wardrobe system that helps users manage their clothing inventory and get outfit recommendations using AI.

## Features

- User authentication and authorization
- Clothing inventory management
- AI-powered outfit recommendations
- Smart LED control system (ESP32 integration)
- Image upload and processing
- Google OAuth integration
- Firebase integration

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: EJS (Embedded JavaScript)
- **Database**: MongoDB (Mongoose)
- **Authentication**: Passport.js, JWT
- **AI Integration**: Google Generative AI
- **Hardware**: ESP32
- **Cloud Services**: Firebase
- **Email**: Nodemailer

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- ESP32 microcontroller
- Google Cloud Platform account
- Firebase account

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd smart-wardrobe
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FIREBASE_CREDENTIALS=path_to_firebase_credentials
```

4. Set up the ESP32 hardware following the instructions in `ESP32_LED_SETUP.md`

## Running the Application

1. Start the development server:
```bash
npm run build
```

2. The application will be available at `http://localhost:3000`

## Project Structure

```
smart-wardrobe/
├── config/           # Configuration files
├── middlewares/      # Express middlewares
├── models/          # Database models
├── public/          # Static files
├── routes/          # API routes
├── uploads/         # User uploads
├── utils/           # Utility functions
├── views/           # EJS templates
├── app.js           # Main application file
└── package.json     # Project dependencies
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


