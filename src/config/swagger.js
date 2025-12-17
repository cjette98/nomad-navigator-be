const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Aitineri API",
      version: "1.0.0",
      description: "API documentation for Aitinery",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            "Clerk authentication token. Get this from your Clerk session.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error message here",
            },
            error: {
              type: "string",
              example: "Detailed error message",
            },
          },
        },
        TripSuggestionRequest: {
          type: "object",
          required: ["destinationOrVibe"],
          properties: {
            destinationOrVibe: {
              type: "string",
              description:
                'Destination name or travel vibe (e.g., "Lisbon, food + culture")',
              example: "Lisbon, food + culture",
            },
            mustHaves: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of must-have experiences or requirements",
              example: ["great coffee", "walkable areas", "historic sites"],
            },
            durationDays: {
              type: "number",
              description: "Number of days for the trip",
              example: 5,
            },
            startDate: {
              type: "string",
              format: "date",
              description: "Trip start date (YYYY-MM-DD)",
              example: "2025-02-10",
            },
            endDate: {
              type: "string",
              format: "date",
              description: "Trip end date (YYYY-MM-DD)",
              example: "2025-02-15",
            },
            travelPace: {
              type: "string",
              enum: ["slow", "moderate", "fast"],
              description: "Preferred travel pace",
              example: "slow",
            },
            travelers: {
              type: "number",
              description: "Number of travelers",
              example: 2,
            },
            budget: {
              type: "string",
              enum: ["budget", "mid", "luxury"],
              description: "Budget level",
              example: "mid",
            },
          },
        },
        TripSuggestionResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Trip suggestions generated successfully",
            },
            data: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  destination: {
                    type: "string",
                    example: "Lisbon",
                  },
                  title: {
                    type: "string",
                    example: "Food + Culture long weekend",
                  },
                  description: {
                    type: "string",
                    example:
                      "A perfect blend of Portuguese cuisine and historic charm",
                  },
                },
              },
            },
          },
        },
        CreateTripRequest: {
          type: "object",
          required: ["selectedTrip"],
          properties: {
            selectedTrip: {
              type: "object",
              description: "The selected trip suggestion data",
              properties: {
                destination: {
                  type: "string",
                  example: "Lisbon",
                },
                title: {
                  type: "string",
                  example: "Food + Culture long weekend",
                },
                startDate: {
                  type: "string",
                  format: "date",
                  example: "2025-02-10",
                },
                endDate: {
                  type: "string",
                  format: "date",
                  example: "2025-02-13",
                },
                durationDays: {
                  type: "number",
                  example: 4,
                },
                travelers: {
                  type: "number",
                  example: 2,
                },
                budget: {
                  type: "string",
                  example: "mid",
                },
                vibe: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  example: ["food", "history", "walkable core"],
                },
              },
            },
          },
        },
        Activity: {
          type: "object",
          required: ["name", "time"],
          properties: {
            name: {
              type: "string",
              description: "Activity name",
              example: "Arrival at Sorsogon Airport",
            },
            time: {
              type: "string",
              description: "Activity time",
              example: "10:00 AM",
            },
            description: {
              type: "string",
              description: "Detailed description of the activity",
              example: "Arrive in Sorsogon and transfer to your accommodation.",
            },
            type: {
              type: "string",
              description: "Activity type (e.g., transport, meal, sightseeing)",
              example: "transport",
            },
            location: {
              type: "string",
              description: "Location of the activity",
              example: "Sorsogon Airport",
            },
          },
        },
        UpdateActivitiesRequest: {
          type: "object",
          required: ["activities"],
          properties: {
            activities: {
              type: "array",
              description:
                "Array of activities to replace existing activities for the day",
              items: {
                $ref: "#/components/schemas/Activity",
              },
            },
          },
        },
        AddActivitiesRequest: {
          type: "object",
          required: ["activities"],
          properties: {
            activities: {
              type: "array",
              description: "Array of new activities to add to the day",
              items: {
                $ref: "#/components/schemas/Activity",
              },
            },
          },
        },
        Trip: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "trip123",
            },
            userId: {
              type: "string",
              example: "user_abc123",
            },
            selectedTrip: {
              type: "object",
            },
            itinerary: {
              type: "object",
              properties: {
                day1: {
                  type: "object",
                  properties: {
                    activities: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Activity",
                      },
                    },
                  },
                },
                day2: {
                  type: "object",
                  properties: {
                    activities: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Activity",
                      },
                    },
                  },
                },
                day3: {
                  type: "object",
                  properties: {
                    activities: {
                      type: "array",
                      items: {
                        $ref: "#/components/schemas/Activity",
                      },
                    },
                  },
                },
              },
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        TripResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Trip created successfully with itinerary",
            },
            data: {
              $ref: "#/components/schemas/Trip",
            },
          },
        },
        TripsListResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Trip",
              },
            },
          },
        },
        TripBudget: {
          type: "object",
          properties: {
            currency: {
              type: "string",
              description: "Currency code (e.g., USD, EUR)",
              example: "USD",
            },
            min: {
              type: "number",
              description: "Minimum budget amount",
              example: 1000,
            },
            max: {
              type: "number",
              description: "Maximum budget amount",
              example: 5000,
            },
          },
        },
        LoyaltyProgram: {
          type: "object",
          properties: {
            programName: {
              type: "string",
              description: "Name of the loyalty program",
              example: "Marriott Bonvoy",
            },
            membershipNumber: {
              type: "string",
              description: "Membership number",
              example: "123456789",
            },
            tier: {
              type: "string",
              description: "Membership tier level",
              example: "Gold",
            },
          },
        },
        PersonalInfo: {
          type: "object",
          properties: {
            country: {
              type: "string",
              description: "Country of residence",
              example: "United States",
            },
            phoneNumber: {
              type: "string",
              description: "Phone number with country code",
              example: "+1234567890",
            },
          },
        },
        TravelPreferences: {
          type: "object",
          description: "User travel preferences",
          properties: {
            whoIsGoing: {
              type: "string",
              description: "Travel companion type",
              example: "solo",
            },
            preferredTravelDocuments: {
              type: "array",
              items: {
                type: "string",
              },
              description: "List of preferred travel documents",
              example: ["passport", "visa"],
            },
            preferredFlightStyle: {
              type: "string",
              description: "Preferred flight class/style",
              example: "business",
            },
            preferredInDestinationTransport: {
              type: "string",
              description: "Preferred main transport at destination",
              example: "rent a car",
            },
            travelPerYear: {
              type: "string",
              description: "Rough number of trips per year",
              example: "rarely (1-2) trips",
            },
            travelerType: {
              type: "string",
              description: "Type of traveler",
              example: "hybrid",
            },
            preferredTripDuration: {
              type: "string",
              description: "Preferred trip duration",
              example: "standard vacation",
            },
            tripBudget: {
              type: "string",
              description: "Overall trip budget level",
              example: "cheap",
            },
            accommodationStyle: {
              type: "string",
              description: "Preferred accommodation style",
              example: "luxury hotel",
            },
            loyaltyPrograms: {
              type: "string",
              description: "Loyalty program preference (e.g. both, airline_only, hotel_only, none)",
              example: "both",
            },
            interestsAndVibes: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Travel interests and vibes",
              example: [
                "beaches",
                "mountains",
                "nightlife",
                "culture",
                "adventure",
              ],
            },
          },
        },
        TravelPreferencesRequest: {
          type: "object",
          description: "Travel preferences data to save or update",
          properties: {
            whoIsGoing: {
              type: "string",
              example: "solo",
            },
            preferredTravelDocuments: {
              type: "array",
              items: {
                type: "string",
              },
              example: ["passport", "visa"],
            },
            preferredFlightStyle: {
              type: "string",
              example: "business",
            },
            preferredInDestinationTransport: {
              type: "string",
              example: "rent a car",
            },
            travelPerYear: {
              type: "string",
              example: "rarely (1-2) trips",
            },
            travelerType: {
              type: "string",
              example: "hybrid",
            },
            preferredTripDuration: {
              type: "string",
              example: "standard vacation",
            },
            tripBudget: {
              type: "string",
              example: "cheap",
            },
            accommodationStyle: {
              type: "string",
              example: "luxury hotel",
            },
            loyaltyPrograms: {
              type: "string",
              example: "both",
            },
            interestsAndVibes: {
              type: "array",
              items: {
                type: "string",
              },
              example: [
                "beaches",
                "mountains",
                "nightlife",
                "culture",
                "adventure",
              ],
            },
          },
        },
        TravelPreferencesResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            message: {
              type: "string",
              example: "Travel preferences saved successfully",
            },
            data: {
              $ref: "#/components/schemas/TravelPreferences",
            },
          },
        },
        TikTokAnalysisItem: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Name of the place, event, or subject featured in the video",
              example: "Tokyo Ramen Shop",
            },
            description: {
              type: "string",
              description: "Short description (1-2 sentences) based on the title and context",
              example: "A hidden gem in Shibuya serving authentic tonkotsu ramen with rich, creamy broth",
            },
            category: {
              type: "string",
              enum: ["Restaurant", "Cafe", "Travel", "Food", "Product", "Lifestyle"],
              description: "Category of the inspiration item",
              example: "Restaurant",
            },
          },
        },
        TikTokAnalysisResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "array",
              description: "Array of inspiration items extracted from the TikTok video",
              items: {
                $ref: "#/components/schemas/TikTokAnalysisItem",
              },
            },
          },
        },
        SuggestedActivity: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Short activity/place name",
              example: "Visit Senso-ji Temple",
            },
            description: {
              type: "string",
              description: "1-2 sentence description of what to do/expect",
              example: "Experience Tokyo's oldest temple and explore the traditional Nakamise shopping street",
            },
            category: {
              type: "string",
              enum: ["Food", "Lodging", "Sightseeing", "Experience", "Logistics", "Shopping", "Other"],
              description: "Category of the suggested activity",
              example: "Sightseeing",
            },
          },
        },
        LinkSummaryResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            data: {
              type: "object",
              properties: {
                sourceUrl: {
                  type: "string",
                  description: "The original URL that was summarized",
                  example: "https://example.com/travel-blog-post",
                },
                summary: {
                  type: "string",
                  description: "2-3 sentence overview of the article focused on travel takeaways",
                  example: "A comprehensive guide to Tokyo's best neighborhoods, covering everything from traditional temples in Asakusa to modern shopping districts in Shibuya.",
                },
                keyPoints: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "3-5 short bullet points highlighting places, tips, or logistics",
                  example: [
                    "Shibuya is perfect for shopping and nightlife",
                    "Asakusa offers traditional temple experiences",
                    "Best visited during cherry blossom season (late March to early April)",
                  ],
                },
                suggestedActivities: {
                  type: "array",
                  description: "Suggested activities that can be attached to trip itineraries",
                  items: {
                    $ref: "#/components/schemas/SuggestedActivity",
                  },
                },
              },
            },
          },
        },
        TravelPreferencesSettingsGetResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: [
                {
                  id: "string",
                  preferred_travel_documents: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                  ],
                  prefered_travel_flights: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                  ],
                  who_is_going: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "Friends",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                  ],
                  loyalty_programs: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                  ],
                  traveller_type: [
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                  ],
                  travel_per_year: [
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                  ],
                  trip_budget: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "💎",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                  ],
                  preferred_in_destination_transport: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                  ],
                  trip_duration: [
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                    {
                      id: "number",
                      label: "string",
                      value: "string",
                    },
                  ],
                  interest_and_vibes: [
                    {
                      id: "number",
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                    },
                  ],
                  accomodation_style: [
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                    {
                      id: "number",
                      value: "string",
                      label: "string",
                      emoji: "string",
                      subtitle: "string",
                    },
                  ],
                },
              ],
            },
            data: {
              $ref: "#/components/schemas/TravelPreferences",
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes/*.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
