# Aitineri Backend

A Node.js/Express backend API for the Aitineri. This backend provides APIs for trip suggestions, itinerary generation, travel preferences management, TikTok video analysis, link summarization, and Gmail booking confirmation extraction.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Deployment to Vercel](#deployment-to-vercel)
- [Project Structure](#project-structure)
- [Technologies Used](#technologies-used)

## Features

- 🔐 **Authentication**: Clerk-based authentication for protected endpoints
- 🗺️ **Trip Planning**: Generate trip suggestions and create detailed itineraries
- 📱 **TikTok Integration**: Analyze TikTok videos to extract travel inspiration
- 🔗 **Link Summarization**: Summarize travel blog posts and articles
- 📧 **Gmail Integration**: Extract booking confirmations from Gmail
- 🎨 **Image Generation**: Generate images using OpenAI
- 📊 **Travel Preferences**: Manage user travel preferences and settings
- 📝 **Swagger Documentation**: Interactive API documentation

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v16 or higher)
- **npm** (v7 or higher) or **yarn**
- **Git**

You'll also need accounts and API keys for:

- [Clerk](https://clerk.com/) - Authentication service
- [Firebase](https://firebase.google.com/) - Database (Firestore)
- [OpenAI](https://openai.com/) - AI services
- [Google Cloud Platform](https://cloud.google.com/) - Video Intelligence API, Cloud Storage, Gmail API
- [RapidAPI](https://rapidapi.com/) - TikTok API (optional)
- [Vercel](https://vercel.com/) - Deployment platform

## Local Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd nomad-navigator-be
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env  # If you have an example file
# Or create .env manually
```

See the [Environment Variables](#environment-variables) section below for all required variables.

### 4. Configure Firebase

You have several options for Firebase configuration:

**Option 1: Base64 Encoded Service Account (Recommended for Vercel)**
```env
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded-service-account-json>
```

**Option 2: Service Account File Path**
```env
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/service-account.json
```

**Option 3: Individual Environment Variables**
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
```

### 5. Configure Google Cloud Services

**For Google Cloud Storage and Video Intelligence:**

**Option 1: Base64 Encoded Credentials (Recommended for Vercel)**
```env
GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64-encoded-service-account-json>
```

**Option 2: Local File**
Place your `google-service-key.json` file in the project root.

**For Gmail OAuth:**
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
```

### 6. Configure Clerk Authentication

Set up your Clerk application and add the secret key:

```env
CLERK_SECRET_KEY=sk_test_...  # Or CLERK_PUBLISHABLE_KEY for frontend
```

## Environment Variables

Here's a complete list of all environment variables:

### Required Variables

```env
# Server
PORT=3000

# Clerk Authentication
CLERK_SECRET_KEY=sk_test_...

# Firebase (choose one method)
FIREBASE_SERVICE_ACCOUNT_BASE64=<base64-encoded-json>
# OR
FIREBASE_SERVICE_ACCOUNT_PATH=./path/to/service-account.json
# OR
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com

# OpenAI
OPENAI_API_KEY=sk-...

# Google Cloud Services
GOOGLE_APPLICATION_CREDENTIALS_BASE64=<base64-encoded-json>
GCS_BUCKET=your-gcs-bucket-name

# Google OAuth (for Gmail integration)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

# RapidAPI (for TikTok service)
RAPIDAPI_KEY=your-rapidapi-key
```

### Optional Variables

```env
# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100  # Max requests per window
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

This will start the server with `nodemon` for automatic reloading on file changes.

### Production Mode

```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in `PORT` environment variable).

### Verify Installation

1. Visit `http://localhost:3000` to see the home page
2. Visit `http://localhost:3000/api-docs` to access Swagger API documentation

## API Documentation

Once the server is running, you can access the interactive Swagger API documentation at:

```
http://localhost:3000/api-docs
```

The API documentation includes:
- All available endpoints
- Request/response schemas
- Authentication requirements
- Example requests and responses

## Deployment to Vercel

### Prerequisites

1. A [Vercel account](https://vercel.com/)
2. Vercel CLI installed (optional, but recommended):
   ```bash
   npm i -g vercel
   ```

### Step 1: Prepare Your Project

The project already includes a `vercel.json` configuration file. Ensure it's properly configured:

```json
{
  "version": 2,
  "builds": [
    { 
      "src": "src/app.js", 
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["node_modules/swagger-ui-dist/**"]
      }
    }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "src/app.js" }
  ]
}
```

### Step 2: Set Up Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add all required environment variables:

   **Important Notes for Vercel:**
   - Use base64-encoded credentials for Firebase and Google Cloud
   - Update `GOOGLE_REDIRECT_URI` to your Vercel deployment URL:
     ```
     GOOGLE_REDIRECT_URI=https://your-app.vercel.app/auth/google/callback
     ```
   - Ensure `CLERK_SECRET_KEY` is set correctly

### Step 3: Deploy via Vercel Dashboard

1. **Connect your repository:**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **Add New Project**
   - Import your Git repository
   - Vercel will auto-detect Node.js

2. **Configure build settings:**
   - Framework Preset: **Other**
   - Build Command: Leave empty (Vercel will auto-detect)
   - Output Directory: Leave empty
   - Install Command: `npm install`

3. **Deploy:**
   - Click **Deploy**
   - Wait for the build to complete

### Step 4: Deploy via CLI (Alternative)

1. **Login to Vercel:**
   ```bash
   vercel login
   ```

2. **Link your project:**
   ```bash
   vercel link
   ```
   Follow the prompts to link to an existing project or create a new one.

3. **Set environment variables:**
   ```bash
   vercel env add CLERK_SECRET_KEY
   vercel env add OPENAI_API_KEY
   vercel env add FIREBASE_SERVICE_ACCOUNT_BASE64
   # ... add all other environment variables
   ```

4. **Deploy:**
   ```bash
   vercel --prod
   ```

### Step 5: Update OAuth Redirect URIs

After deployment, update your OAuth redirect URIs:

1. **Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Credentials**
   - Edit your OAuth 2.0 Client ID
   - Add your Vercel URL to **Authorized redirect URIs**:
     ```
     https://your-app.vercel.app/auth/google/callback
     ```

2. **Clerk Dashboard:**
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Update your application settings
   - Add your Vercel URL to allowed origins

### Step 6: Verify Deployment

1. Visit your Vercel deployment URL
2. Check the API documentation at `https://your-app.vercel.app/api-docs`
3. Test a few endpoints to ensure everything works

### Troubleshooting Vercel Deployment

**Issue: Build fails**
- Check that all dependencies are listed in `package.json`
- Ensure Node.js version is compatible (Vercel uses Node 18.x by default)

**Issue: Environment variables not working**
- Verify all variables are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)
- Redeploy after adding new environment variables

**Issue: Firebase/Google Cloud credentials not working**
- Ensure credentials are base64-encoded
- Verify the credentials JSON is valid
- Check that service account has necessary permissions

**Issue: Swagger UI not loading**
- Verify `vercel.json` includes the `includeFiles` config for swagger-ui-dist
- Check that the build completed successfully

**Issue: Timeout errors**
- Vercel has a 10-second timeout for Hobby plan
- Consider upgrading to Pro plan for longer timeouts
- Optimize your API endpoints for faster responses

## Project Structure

```
nomad-navigator-be/
├── src/
│   ├── app.js                 # Main application entry point
│   ├── config/
│   │   ├── database.js        # Firebase configuration
│   │   ├── googleClient.js    # Google Cloud clients
│   │   └── swagger.js         # Swagger documentation config
│   ├── controllers/
│   │   ├── linkController.js
│   │   ├── travelConfirmationController.js
│   │   ├── travelPreferenceController.js
│   │   ├── tripController.js
│   │   ├── tripSuggestionController.js
│   │   └── videoController.js
│   ├── middleware/
│   │   └── rateLimit.js       # Rate limiting middleware
│   ├── models/                # Data models (if any)
│   ├── routes/
│   │   ├── linkRoutes.js
│   │   ├── travelConfirmationRoutes.js
│   │   ├── travelPreferenceRoutes.js
│   │   ├── tripRoutes.js
│   │   ├── tripSuggestionRoutes.js
│   │   └── videoRoutes.js
│   └── services/
│       ├── aiSummaryService.js
│       ├── bookingExtractionService.js
│       ├── categorizationService.js
│       ├── gcsService.js
│       ├── imageGenerationService.js
│       ├── itineraryService.js
│       ├── linkSummaryService.js
│       ├── locationExtractionService.js
│       ├── tiktokService.js
│       ├── tiktokServiceV1.js
│       ├── travelPreferenceService.js
│       ├── tripService.js
│       ├── tripSuggestionService.js
│       └── videoAIService.js
├── vercel.json                # Vercel deployment configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

## Technologies Used

- **Express.js** - Web framework
- **Clerk** - Authentication and user management
- **Firebase/Firestore** - Database
- **OpenAI** - AI services (GPT models, image generation)
- **Google Cloud Platform**:
  - Video Intelligence API
  - Cloud Storage
  - Gmail API
- **Swagger/OpenAPI** - API documentation
- **Multer** - File upload handling
- **Axios** - HTTP client
- **CORS** - Cross-origin resource sharing

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [Clerk Documentation](https://clerk.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Vercel Documentation](https://vercel.com/docs)
- [OpenAI API Documentation](https://platform.openai.com/docs)

## Support

For issues or questions, please open an issue in the repository or contact the development team.

---

**Note**: Remember to disable the Cloud Video Intelligence API after POC completion to avoid unnecessary costs. See the `readme` file for the API console link.















