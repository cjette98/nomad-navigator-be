# Swagger API Documentation

This project includes comprehensive Swagger/OpenAPI documentation for all API endpoints. The documentation is automatically generated and provides an interactive interface for testing and exploring the API.

## 📚 Accessing the Documentation

Once your server is running, you can access the Swagger UI at:

```
http://localhost:3000/api-docs
```

The Swagger UI provides:
- Complete API endpoint documentation
- Request/response schemas
- Interactive API testing interface
- Example requests and responses

## 🚀 Getting Started

### 1. Start the Server

```bash
npm run start:dev
```

### 2. Open Swagger UI

Navigate to `http://localhost:3000/api-docs` in your browser.

### 3. Authenticate Requests

All API endpoints require authentication via Clerk. To test endpoints in Swagger UI:

1. Click the **"Authorize"** button at the top of the Swagger UI
2. Enter your Clerk JWT token or session token in the format:
   ```
   Bearer <your-token-here>
   ```
   Or just:
   ```
   <your-token-here>
   ```
3. Click **"Authorize"** and then **"Close"**

Now all API requests will include the authentication header automatically.

## 📖 Available Endpoints

### Travel Preferences

#### POST `/api/travel-preferences`
Save or update travel preferences for the authenticated user.

**Request Body Fields:**
- `whoIsGoing` (string) - Travel companion type (e.g., "solo", "couple", "family")
- `preferredTravelDocuments` (array) - List of preferred travel documents (e.g., ["passport", "visa"])
- `preferredFlightStyle` (string) - Preferred flight class/style (e.g., "business", "economy")
- `preferredInDestinationTransport` (array) - Preferred transportation methods at destination (e.g., ["rental_car", "public_transport", "taxi"])
- `travelFrequencyPerYear` (string) - Number of trips per year (e.g., "6-10")
- `travelerType` (string) - Type of traveler (e.g., "adventure", "luxury", "budget")
- `preferredTripDuration` (string) - Preferred trip duration (e.g., "2_weeks", "1_week")
- `tripBudget` (object) - Budget range with currency, min, and max
- `accommodationStyle` (string) - Preferred accommodation style (e.g., "luxury_hotel", "budget_hotel")
- `loyaltyPrograms` (array) - List of loyalty program memberships with programName, membershipNumber, and tier
- `interestsAndVibes` (array) - Travel interests and vibes (e.g., ["beaches", "mountains", "nightlife"])
- `personalInfo` (object) - Personal information including country and phoneNumber

**Example Request:**
```json
{
  "whoIsGoing": "solo",
  "preferredTravelDocuments": ["passport", "visa"],
  "preferredFlightStyle": "business",
  "preferredInDestinationTransport": ["rental_car", "public_transport", "taxi"],
  "travelFrequencyPerYear": "6-10",
  "travelerType": "adventure",
  "preferredTripDuration": "2_weeks",
  "tripBudget": {
    "currency": "USD",
    "min": 1000,
    "max": 5000
  },
  "accommodationStyle": "luxury_hotel",
  "loyaltyPrograms": [
    {
      "programName": "Marriott Bonvoy",
      "membershipNumber": "123456789",
      "tier": "Gold"
    },
    {
      "programName": "United MileagePlus",
      "membershipNumber": "987654321",
      "tier": "Silver"
    }
  ],
  "interestsAndVibes": ["beaches", "mountains", "nightlife", "culture", "adventure"],
  "personalInfo": {
    "country": "United States",
    "phoneNumber": "+1234567890"
  }
}
```

#### GET `/api/travel-preferences`
Get travel preferences for the authenticated user.

**Responses:**
- `200` - Travel preferences retrieved successfully
- `404` - Travel preferences not found

#### DELETE `/api/travel-preferences`
Delete all travel preferences for the authenticated user.

**Responses:**
- `200` - Travel preferences deleted successfully
- `404` - Travel preferences not found

### Trip Suggestions

#### POST `/api/trip-suggestions`
Generate AI-powered trip suggestions based on destination and preferences.

**Required Fields:**
- `destinationOrVibe` (string) - Destination name or travel vibe

**Optional Fields:**
- `mustHaves` (array) - List of must-have experiences
- `durationDays` (number) - Number of days for the trip
- `startDate` (string) - Trip start date (YYYY-MM-DD)
- `endDate` (string) - Trip end date (YYYY-MM-DD)
- `travelPace` (string) - "slow", "moderate", or "fast"
- `travelers` (number) - Number of travelers
- `budget` (string) - "budget", "mid", or "luxury"

**Example Request:**
```json
{
  "destinationOrVibe": "Lisbon, food + culture",
  "mustHaves": ["great coffee", "walkable areas"],
  "durationDays": 5,
  "startDate": "2025-02-10",
  "endDate": "2025-02-15",
  "travelPace": "slow",
  "travelers": 2,
  "budget": "mid"
}
```

### Trips

#### POST `/api/trips`
Create a new trip with AI-generated itinerary from a selected trip suggestion.

**Required Fields:**
- `selectedTrip` (object) - The selected trip suggestion data

**Example Request:**
```json
{
  "selectedTrip": {
    "destination": "Lisbon",
    "title": "Food + Culture long weekend",
    "startDate": "2025-02-10",
    "endDate": "2025-02-13",
    "durationDays": 4,
    "travelers": 2,
    "budget": "mid",
    "vibe": ["food", "history", "walkable core"]
  }
}
```

#### GET `/api/trips`
Get all trips for the authenticated user.

#### GET `/api/trips/{tripId}`
Get a specific trip by ID.

**Parameters:**
- `tripId` (path parameter) - The unique identifier of the trip

### Activities

#### PUT `/api/trips/{tripId}/days/{dayNumber}/activities`
Update (replace) all activities for a specific day in the trip itinerary.

**Parameters:**
- `tripId` (path parameter) - The unique identifier of the trip
- `dayNumber` (path parameter) - The day number (1, 2, 3, etc.)

**Required Fields:**
- `activities` (array) - Array of activity objects

**Activity Object Structure:**
```json
{
  "name": "Arrival at Sorsogon Airport",
  "time": "10:00 AM",
  "description": "Arrive in Sorsogon and transfer to your accommodation.",
  "type": "transport",
  "location": "Sorsogon Airport"
}
```

**Example Request:**
```json
{
  "activities": [
    {
      "name": "Arrival at Sorsogon Airport",
      "time": "10:00 AM",
      "description": "Arrive in Sorsogon and transfer to your accommodation.",
      "type": "transport",
      "location": "Sorsogon Airport"
    },
    {
      "name": "Check-in and lunch",
      "time": "12:30 PM",
      "description": "Check into hotel and grab lunch nearby.",
      "type": "meal",
      "location": "Sorsogon City"
    }
  ]
}
```

#### POST `/api/trips/{tripId}/days/{dayNumber}/activities`
Add new activities to a specific day (appends to existing activities).

**Parameters:**
- `tripId` (path parameter) - The unique identifier of the trip
- `dayNumber` (path parameter) - The day number (1, 2, 3, etc.)

**Required Fields:**
- `activities` (array) - Array of activity objects (non-empty)

**Example Request:**
```json
{
  "activities": [
    {
      "name": "Sunset by the bay",
      "time": "05:30 PM",
      "description": "Relax by Sorsogon Bay and enjoy the view.",
      "type": "sightseeing",
      "location": "Sorsogon Bay"
    }
  ]
}
```

## 🔑 Authentication

All endpoints require Clerk authentication. The authentication token should be included in the `Authorization` header:

```
Authorization: Bearer <your-clerk-token>
```

In Swagger UI, you can set this once using the "Authorize" button, and it will be included in all subsequent requests.

## 📝 Activity Object Schema

Each activity object can contain the following fields:

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | string | Yes | Activity name | "Arrival at Sorsogon Airport" |
| `time` | string | Yes | Activity time | "10:00 AM" |
| `description` | string | No | Detailed description | "Arrive in Sorsogon and transfer..." |
| `type` | string | No | Activity type | "transport", "meal", "sightseeing" |
| `location` | string | No | Location of activity | "Sorsogon Airport" |

## 🧪 Testing in Swagger UI

1. **Navigate to an endpoint** in the Swagger UI
2. **Click "Try it out"** button
3. **Fill in the required parameters** and request body
4. **Click "Execute"** to send the request
5. **View the response** including status code, headers, and body

## 🔄 Response Formats

All endpoints return JSON responses with the following structure:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## 📊 Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success (GET, PUT, POST for activities) |
| 201 | Created (POST for trips) |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Resource doesn't belong to user |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

## 🛠️ Development

### Updating Documentation

The Swagger documentation is generated from JSDoc comments in the route files:

- `src/routes/tripSuggestionRoutes.js`
- `src/routes/tripRoutes.js`

To update the documentation, modify the `@swagger` JSDoc comments in these files.

### Swagger Configuration

The Swagger configuration is located in:
- `src/config/swagger.js`

This file contains:
- API metadata (title, version, description)
- Server URLs
- Security schemes
- Reusable schema definitions

## 📚 Additional Resources

- [OpenAPI Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [Clerk Authentication](https://clerk.com/docs)

## 🐛 Troubleshooting

### Swagger UI not loading
- Ensure the server is running on port 3000
- Check that `swagger-ui-express` and `swagger-jsdoc` are installed
- Verify the route is accessible at `/api-docs`

### Authentication errors
- Ensure your Clerk token is valid
- Check that the token is properly formatted in the Authorization header
- Verify the token hasn't expired

### Endpoints not appearing
- Check that route files have proper `@swagger` JSDoc comments
- Verify the `apis` path in `swagger.js` matches your route file locations
- Restart the server after making changes
