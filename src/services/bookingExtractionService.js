const OpenAI = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract structured booking data from text content using AI
 * @param {string} textContent - The text content to extract from
 * @returns {Promise<Object>} - Structured booking data
 */
const extractBookingData = async (textContent) => {
  const prompt = `
You are a data extraction assistant that reads booking-related content and outputs a clean JSON object.
The JSON structure must adapt to the booking category.

You must:
1. Detect the category (hotel, flight, car, restaurant, or unknown).
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

❓ Unknown Category:
{
  "category": "unknown",
  "bookingId": string | null,
  "customerName": string | null,
  "email": string | null,
  "summary": string | null
}

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
1. Detect the category (hotel, flight, car, restaurant, or unknown).
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
