# API Curl Examples

## Authentication
All endpoints require Clerk authentication. You'll need to include your Clerk session token in one of these ways:

**Option 1: Using Authorization Header**
```bash
Authorization: Bearer <your-clerk-session-token>
```

**Option 2: Using Cookie**
```bash
Cookie: __session=<your-clerk-session-token>
```

To get your session token:
- From browser DevTools: Check the `__session` cookie after logging in
- From Clerk Dashboard: Use the API key for server-to-server calls
- From frontend: Extract from Clerk session object

---

## Trip Suggestions

### 1. Get Trip Suggestions
Generate 3 trip suggestions based on user's travel preferences.

```bash
curl -X GET "http://localhost:3000/api/trip-suggestions" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Trips & Itineraries

### 2. Create Trip with Itinerary
Create a new trip and generate a 3-day itinerary based on a selected trip suggestion.

```bash
curl -X POST "http://localhost:3000/api/trips" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "selectedTrip": {
      "destination": "Tokyo, Japan",
      "vibe": "cultural",
      "title": "Cultural Immersion in Tokyo",
      "description": "Explore traditional temples, modern districts, and authentic Japanese cuisine",
      "highlights": [
        "Visit Senso-ji Temple",
        "Explore Shibuya Crossing",
        "Try authentic sushi",
        "Experience traditional tea ceremony"
      ],
      "duration": "3-5 days",
      "bestTimeToVisit": "March-May, September-November",
      "estimatedBudget": "$1,500-$2,500"
    }
  }'
```

### 3. Get All User Trips
Retrieve all trips for the authenticated user.

```bash
curl -X GET "http://localhost:3000/api/trips" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### 4. Get Specific Trip
Get a specific trip by ID.

```bash
curl -X GET "http://localhost:3000/api/trips/TRIP_ID_HERE" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Update Activities for a Day
Replace all activities for a specific day (day 1, 2, or 3).

```bash
curl -X PUT "http://localhost:3000/api/trips/TRIP_ID_HERE/days/1/activities" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "name": "Morning Yoga Session",
        "time": "7:00 AM",
        "description": "Start your day with a peaceful yoga session overlooking the city",
        "type": "activity",
        "location": "Hotel Rooftop"
      },
      {
        "name": "Breakfast at Local Cafe",
        "time": "9:00 AM",
        "description": "Enjoy traditional breakfast at a local neighborhood cafe",
        "type": "restaurant",
        "location": "Shibuya District"
      },
      {
        "name": "Meiji Shrine Visit",
        "time": "10:30 AM",
        "description": "Explore the peaceful Meiji Shrine and its surrounding forest",
        "type": "attraction",
        "location": "Shibuya, Tokyo"
      }
    ]
  }'
```

### 6. Add Activities to a Day
Add new activities to an existing day (appends to existing activities).

```bash
curl -X POST "http://localhost:3000/api/trips/TRIP_ID_HERE/days/2/activities" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "activities": [
      {
        "name": "Evening Food Tour",
        "time": "6:00 PM",
        "description": "Explore local street food and hidden gems",
        "type": "activity",
        "location": "Shinjuku District"
      },
      {
        "name": "Karaoke Night",
        "time": "9:00 PM",
        "description": "Experience Japanese karaoke culture",
        "type": "activity",
        "location": "Shibuya"
      }
    ]
  }'
```

---

## Example Response: Create Trip

```json
{
  "success": true,
  "message": "Trip created successfully with itinerary",
  "data": {
    "id": "abc123xyz",
    "userId": "user_123",
    "selectedTrip": {
      "destination": "Tokyo, Japan",
      "vibe": "cultural",
      "title": "Cultural Immersion in Tokyo",
      ...
    },
    "itinerary": {
      "day1": {
        "activities": [
          {
            "name": "Arrival and Check-in",
            "time": "2:00 PM",
            "description": "Check into your hotel and get settled",
            "type": "accommodation",
            "location": "Hotel in Shibuya"
          },
          {
            "name": "Shibuya Crossing",
            "time": "4:00 PM",
            "description": "Experience the world's busiest intersection",
            "type": "attraction",
            "location": "Shibuya, Tokyo"
          },
          ...
        ]
      },
      "day2": {
        "activities": [...]
      },
      "day3": {
        "activities": [...]
      }
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## Notes

- Replace `YOUR_CLERK_SESSION_TOKEN` with your actual Clerk session token
- Replace `TRIP_ID_HERE` with the actual trip ID from the create trip response
- Replace `http://localhost:3000` with your actual server URL
- Day numbers must be 1, 2, or 3
- All timestamps are in ISO 8601 format
- Activity types: "attraction", "restaurant", "activity", "transport", "accommodation", "other"

---

## Inspiration Module

### Link → Trip Activity Summary
Parse a travel blog or article URL and get a concise summary plus suggested trip activities you can attach to an itinerary.

```bash
curl -X POST "http://localhost:3000/api/inspiration/summarize-link" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com/travel-blog-post"
  }'
```

### TikTok Video Analysis
Analyze a TikTok video URL to generate inspiration content.

```bash
curl -X POST "http://localhost:3000/api/inspiration/analyze-tiktok" \
  -H "Authorization: Bearer YOUR_CLERK_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.tiktok.com/@user/video/1234567890"
  }'
```

**Response shape**
- `sourceUrl`: echo of the URL
- `summary`: 2–3 sentence overview
- `keyPoints`: array of highlights or tips
- `suggestedActivities`: array of items with `title`, `description`, and `category` for itinerary use
