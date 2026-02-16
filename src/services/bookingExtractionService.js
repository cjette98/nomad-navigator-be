const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract structured booking data from text content using AI
 * @param {string} textContent - The text content to extract from
 * @returns {Promise<Array<Object>>} - Array of structured booking objects (empty array if none found)
 */
const extractBookingData = async (textContent) => {
  const prompt = `
You are a precise data extraction assistant specializing in travel itineraries and booking confirmations.
TASK: Extract ALL bookings from the provided text and return them as a JSON array.
Return ONLY a valid JSON array: [ {booking1}, {booking2}, ... ]

CRITICAL RULES:
1. Extract EVERY distinct booking (flights, hotels, cars, activities, restaurants, events, tickets)
2. A consolidated itinerary may contain multiple bookings - extract each separately
3. Look for master/parent reference numbers AND individual booking confirmations
4. Parse dates in ISO format (YYYY-MM-DD) when possible
5. Extract times in 24-hour format (HH:MM) when possible
6. If a total amount applies to the entire trip, include it only in relevant bookings or note it separately
7. Return ONLY valid JSON array - no markdown, no explanations
8. If no bookings found, return []

Templates:

✈️ FLIGHT:
{
  "category": "flight",
  "bookingId": string | null,           // Flight confirmation or reference number
  "masterReference": string | null,      // Parent itinerary reference if exists
  "customerName": string | null,
  "airline": string | null,              // Carrier name
  "flightNumber": string | null,         // e.g., "UA 9087"
  "departureAirport": string | null,     // Airport code (e.g., "IAD") or full name
  "arrivalAirport": string | null,       // Airport code (e.g., "LIS") or full name
  "departureDate": string | null,        // ISO format: YYYY-MM-DD
  "departureTime": string | null,        // 24-hour format: HH:MM
  "arrivalDate": string | null,          // ISO format: YYYY-MM-DD
  "arrivalTime": string | null,          // 24-hour format: HH:MM
  "seat": string | null,                 // Seat assignment
  "cabin": string | null,                // Economy, Business, First, etc.
  "totalAmount": string | null,
  "email": string | null
}

🏨 HOTEL:
{
  "category": "hotel",
  "bookingId": string | null,            // Hotel confirmation number
  "masterReference": string | null,      // Parent itinerary reference if exists
  "customerName": string | null,
  "hotelName": string | null,            // Property name
  "checkInDate": string | null,          // ISO format: YYYY-MM-DD
  "checkInTime": string | null,          // 24-hour format: HH:MM
  "checkOutDate": string | null,         // ISO format: YYYY-MM-DD
  "checkOutTime": string | null,         // 24-hour format: HH:MM
  "roomType": string | null,             // Room category/type
  "numberOfGuests": number | null,       // Number of adults/guests
  "location": string | null,             // City or address
  "totalAmount": string | null,
  "email": string | null
}


🚗 CAR RENTAL:
{
  "category": "car",
  "bookingId": string | null,            // Rental agreement number
  "masterReference": string | null,      // Parent itinerary reference if exists
  "customerName": string | null,
  "rentalCompany": string | null,        // e.g., "Sixt Portugal"
  "carModel": string | null,             // Vehicle type/model
  "pickupLocation": string | null,       // Location name or address
  "pickupDate": string | null,           // ISO format: YYYY-MM-DD
  "pickupTime": string | null,           // 24-hour format: HH:MM
  "dropoffLocation": string | null,      // Location name or address
  "dropoffDate": string | null,          // ISO format: YYYY-MM-DD
  "dropoffTime": string | null,          // 24-hour format: HH:MM
  "totalAmount": string | null,
  "email": string | null
}

🎯 ACTIVITY/TOUR:
{
  "category": "activity",
  "bookingId": string | null,            // Activity reference number
  "masterReference": string | null,      // Parent itinerary reference if exists
  "customerName": string | null,
  "activityName": string | null,         // Tour or experience name
  "provider": string | null,             // Company providing the activity
  "activityDate": string | null,         // ISO format: YYYY-MM-DD
  "activityTime": string | null,         // 24-hour format: HH:MM
  "duration": string | null,             // e.g., "Full-Day", "2 hours"
  "numberOfParticipants": number | null, // Number of people
  "location": string | null,             // Starting point or venue
  "totalAmount": string | null,
  "email": string | null
}

🍽️ RESTAURANT:
{
  "category": "restaurant",
  "bookingId": string | null,
  "masterReference": string | null,
  "customerName": string | null,
  "restaurantName": string | null,
  "reservationDate": string | null,      // ISO format: YYYY-MM-DD
  "reservationTime": string | null,      // 24-hour format: HH:MM
  "numberOfGuests": number | null,
  "location": string | null,
  "totalAmount": string | null,
  "email": string | null
}

🎫 EVENT/TICKET:
{
  "category": "event",
  "bookingId": string | null,
  "masterReference": string | null,
  "customerName": string | null,
  "eventName": string | null,            // Concert, show, sports event name
  "performer": string | null,            // Artist, team, or performer
  "venue": string | null,                // Venue name
  "eventDate": string | null,            // ISO format: YYYY-MM-DD
  "eventTime": string | null,            // 24-hour format: HH:MM
  "numberOfTickets": number | null,
  "seat": string | null,                 // Seat number/location
  "section": string | null,              // Section identifier
  "location": string | null,             // City or full address
  "totalAmount": string | null,
  "email": string | null
}

❓ UNKNOWN:
{
  "category": "unknown",
  "bookingId": string | null,
  "masterReference": string | null,
  "customerName": string | null,
  "summary": string | null,              // Brief description of what was found
  "email": string | null
}

EXTRACTION GUIDELINES:
- Master Reference should be captured when present (applies to entire trip)
- Each booking should have its own specific confirmation/reference number
- Dates: Convert "June 14, 2026" → "2026-06-14"
- Times: Convert "5:40 PM" → "17:40", "6:20 AM" → "06:20"
- Handle multi-day arrivals ("+1 day" notations)
- Activities/tours should use "activity" category
- Extract participant/guest counts as numbers not strings
- Preserve location details (airport codes, city names, addresses)


Content to extract from:
"""${textContent}"""
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You extract structured booking data from text content.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0,
    });

    let parsed;
    try {
      const content = completion.choices[0].message.content.trim();
      // Remove markdown formatting if present
      const cleanedContent = content
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();
      parsed = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      return [];
    }

    // Prompt asks for an array; normalize so we never return a single object that gets saved as "empty nest"
    const arr = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
    return arr.filter((item) => item && typeof item === "object" && (item.category || item.bookingId || item.summary));
  } catch (error) {
    console.error("Error extracting booking data:", error);
    throw error;
  }
};

/**
 * Extract booking data from an image using OpenAI Vision API
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimeType - The image MIME type (e.g., 'image/png', 'image/jpeg')
 * @returns {Promise<Object>} - Structured booking data
 */
const extractBookingDataFromImage = async (imageBuffer, mimeType) => {
  const base64Image = imageBuffer.toString("base64");

  const prompt = `
You are a data extraction assistant that reads booking-related images (screenshots, photos of confirmations) and outputs a clean JSON object.
The JSON structure must adapt to the booking category.

You must:
1. Detect the category (hotel, flight, car, restaurant, event, ticket, or unknown).
2. Return a JSON object specific to that category, with only the relevant fields.
3. If data is missing, set the value to null.
4. Return ONLY valid JSON (no explanations or text).

Use the following templates:

📘 Hotel Booking:
{
  "category": "hotel",
  "bookingId": string | null,
  "customerName": string | null,
  "hotelName": string | null,
  "checkInDate": string | null,
  "checkOutDate": string | null,
  "totalAmount": string | null,
  "email": string | null,
  "location": string | null
}

✈️ Flight Booking:
{
  "category": "flight",
  "bookingId": string | null,
  "customerName": string | null,
  "airline": string | null,
  "flightNumber": string | null,
  "departureAirport": string | null,
  "arrivalAirport": string | null,
  "departureDate": string | null,
  "arrivalDate": string | null,
  "totalAmount": string | null,
  "email": string | null
}

🚗 Car Booking:
{
  "category": "car",
  "bookingId": string | null,
  "customerName": string | null,
  "carModel": string | null,
  "rentalCompany": string | null,
  "pickupLocation": string | null,
  "pickupDate": string | null,
  "dropoffDate": string | null,
  "totalAmount": string | null,
  "email": string | null
}

🍽️ Restaurant Booking:
{
  "category": "restaurant",
  "bookingId": string | null,
  "customerName": string | null,
  "restaurantName": string | null,
  "reservationDate": string | null,
  "reservationTime": string | null,
  "numberOfGuests": number | null,
  "totalAmount": string | null,
  "email": string | null
}

🎉 Events Booking:
{
  "category": "event",
  "bookingId": string | null,
  "customerName": string | null,
  "eventName": string | null,
  "eventDate": string | null,
  "eventTime": string | null,
  "venue": string | null,
  "location": string | null,
  "numberOfTickets": number | null,
  "totalAmount": string | null,
  "email": string | null
}

🎫 Tickets Booking (concerts, shows, sports, theater, etc.):
{
  "category": "ticket",
  "bookingId": string | null,
  "customerName": string | null,
  "ticketType": string | null,
  "eventName": string | null,
  "performer": string | null,
  "venue": string | null,
  "eventDate": string | null,
  "eventTime": string | null,
  "numberOfTickets": number | null,
  "seat": string | null,
  "section": string | null,
  "totalAmount": string | null,
  "email": string | null
}

❓ Unknown Category:
{
  "category": "unknown",
  "bookingId": string | null,
  "customerName": string | null,
  "email": string | null,
  "summary": string | null
}

Extract all visible booking information from this image.
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You extract structured booking data from images.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
              },
            },
          ],
        },
      ],
      temperature: 0,
    });

    let structuredData;
    try {
      const content = completion.choices[0].message.content.trim();
      // Remove markdown formatting if present
      const cleanedContent = content
        .replace(/```json\s*/g, "")
        .replace(/```/g, "")
        .trim();
      structuredData = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error("JSON parsing failed:", parseError);
      structuredData = {
        category: "unknown",
        summary: "Failed to parse AI response.",
      };
    }

    return structuredData;
  } catch (error) {
    console.error("Error extracting booking data from image:", error);
    throw error;
  }
};

module.exports = {
  extractBookingData,
  extractBookingDataFromImage,
};
