const admin = require("firebase-admin");
const { getFirestore } = require("../config/database");
const { extractLocations } = require("./locationExtractionService");
const crypto = require("crypto");

const COLLECTION_NAME = "inspirationsCollection";

/**
 * Generate a unique ID for an inspiration item
 * @returns {string} - Unique ID string
 */
const generateItemId = () => {
  return crypto.randomBytes(16).toString("hex");
};

/**
 * Normalize location name for matching (removes common words and standardizes format)
 * @param {string} location - Location name
 * @returns {string} - Normalized location for comparison
 */
const normalizeLocationForMatching = (location) => {
  if (!location) return "";
  
  // Convert to lowercase for comparison
  let normalized = location.toLowerCase().trim();
  
  // Remove common location descriptors that might cause duplicates
  const descriptorsToRemove = [
    // Generic
    "island", "isl",
    "city",
    "town",
    "village", "vill",
    "province", "prov",
    "region", "reg",
    "municipality", "mun",
    "district", "dist",
    "area",
    "zone",
    "capital", "island",
    "isle",
    "archipelago",
    "peninsula",
    "coast",
    "bay",
    "harbor",
    "harbour",
    "mount",
    "mountain",
    "lake",
    "river",
  
    // Philippines-specific
    "barangay", "brgy",
    "poblacion",
    "sitio",
    "compound",
  
    // International / common
    "state",
    "county",
    "prefecture", "pref",
    "governorate",
    "territory",
    "metropolitan", "metro",
  ];
  
  
  // Split by comma to handle "Location, Country" format
  const parts = normalized.split(",").map(part => part.trim());
  
  if (parts.length > 1) {
    // Has country/region part
    const mainLocation = parts[0];
    const countryPart = parts.slice(1).join(", ");
    
    // Remove descriptors from main location
    let cleanedMain = mainLocation;
    descriptorsToRemove.forEach(descriptor => {
      const regex = new RegExp(`\\b${descriptor}\\b`, "gi");
      cleanedMain = cleanedMain.replace(regex, "").trim();
    });
    
    // Remove extra spaces
    cleanedMain = cleanedMain.replace(/\s+/g, " ").trim();
    
    return `${cleanedMain}, ${countryPart}`;
  } else {
    // No comma, just clean the location
    let cleaned = normalized;
    descriptorsToRemove.forEach(descriptor => {
      const regex = new RegExp(`\\b${descriptor}\\b`, "gi");
      cleaned = cleaned.replace(regex, "").trim();
    });
    cleaned = cleaned.replace(/\s+/g, " ").trim();
    return cleaned;
  }
};

/**
 * Check if two locations refer to the same place
 * @param {string} location1 - First location
 * @param {string} location2 - Second location
 * @returns {boolean} - True if locations match
 */
const areLocationsMatching = (location1, location2) => {
  const normalized1 = normalizeLocationForMatching(location1);
  const normalized2 = normalizeLocationForMatching(location2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) return true;
  
  // Check if one location contains the other (e.g., "Siargao" vs "Siargao, Philippines")
  const longer = normalized1.length > normalized2.length ? normalized1 : normalized2;
  const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1;
  
  if (longer.includes(shorter) && shorter.length > 3) {
    return true;
  }
  
  return false;
};

/**
 * Save or append content to location-based categories
 * @param {Array} contentData - Array of content items (from video or link summary)
 * @param {string} sourceType - "video" or "link"
 * @param {string} sourceUrl - Original URL of the content
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object>} - Result with saved locations and items
 */
const saveCategorizedContent = async (contentData, sourceType, sourceUrl = null, userId = null) => {
  try {
    if (!Array.isArray(contentData) || contentData.length === 0) {
      console.log("⚠️ No content data to categorize");
      return { locations: [], savedItems: [] };
    }

    if (!userId) {
      throw new Error("UserId is required to save categorized content");
    }

    // Extract primary location from content
    console.log("📍 Extracting primary location from content...");
    const locations = await extractLocations(contentData);
    console.log("📍 Extracted locations:", locations);

    // Use only the primary (first) location to avoid duplicates
    const primaryLocation = locations.length > 0 ? locations[0] : "Uncategorized";
    
    if (primaryLocation === "Uncategorized") {
      console.log("⚠️ No locations found, saving to 'Uncategorized'");
    } else {
      console.log(`📍 Using primary location: ${primaryLocation}`);
    }

    const db = getFirestore();
    const categoriesRef = db.collection(COLLECTION_NAME);
    const savedItems = [];

    // Process only the primary location
    const location = primaryLocation;
    // Normalize location name (capitalize first letter, lowercase rest) for storage
    const normalizedLocation = location
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // First, try exact match
    let categoryQuery = await categoriesRef
      .where("location", "==", normalizedLocation)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    let categoryDocRef;
    let existingItems = [];
    let existingLocation = normalizedLocation;
    let matchedCategory = null;

    if (!categoryQuery.empty) {
      // Exact match found - use existing category
      categoryDocRef = categoryQuery.docs[0].ref;
      const existingData = categoryQuery.docs[0].data();
      existingItems = existingData.items || [];
      existingLocation = existingData.location || normalizedLocation;
      console.log(`✅ Found existing category (exact match): ${existingLocation}`);
    } else {
      // No exact match - check for similar locations
      console.log(`🔍 No exact match found for "${normalizedLocation}", checking for similar locations...`);
      
      // Get all categories for this user to check for similar locations
      allUserCategoriesSnapshot = await categoriesRef
        .where("userId", "==", userId)
        .get();
      
      allUserCategoriesSnapshot.forEach((doc) => {
        const categoryData = doc.data();
        const existingCatLocation = categoryData.location || "";
        
        if (areLocationsMatching(existingCatLocation, normalizedLocation)) {
          matchedCategory = {
            ref: doc.ref,
            data: categoryData,
            location: existingCatLocation,
          };
        }
      });

      if (matchedCategory) {
        // Similar location found - use existing category
        categoryDocRef = matchedCategory.ref;
        existingItems = matchedCategory.data.items || [];
        existingLocation = matchedCategory.location;
        console.log(`✅ Found existing category (similar match): "${existingLocation}" (matched with "${normalizedLocation}")`);
      } else {
        // No similar match - create new category
        categoryDocRef = categoriesRef.doc();
        console.log(`🆕 Creating new category: ${normalizedLocation}`);
      }
    }

    // Add metadata and unique ID to each content item
    const enrichedItems = contentData.map((item) => ({
      ...item,
      id: generateItemId(), // Add unique ID to each item
      sourceType,
      sourceUrl,
      addedAt: admin.firestore.Timestamp.now(),
    }));

    // Merge with existing items (avoid duplicates based on title + sourceUrl)
    // Also check if this sourceUrl already exists in ANY location for this user to prevent cross-location duplicates
    // Reuse allUserCategoriesSnapshot if we already fetched it, otherwise fetch it
    let allUserCategories = allUserCategoriesSnapshot;
    if (!allUserCategories) {
      allUserCategories = await categoriesRef
        .where("userId", "==", userId)
        .get();
    }
    
    const allExistingItems = [];
    allUserCategories.forEach((doc) => {
      const items = doc.data().items || [];
      allExistingItems.push(...items);
    });

    const newItems = enrichedItems.filter((newItem) => {
      // Check against items in current location
      const existsInCurrentLocation = existingItems.some(
        (existingItem) =>
          existingItem.title === newItem.title &&
          existingItem.sourceUrl === newItem.sourceUrl
      );
      
      // Check against items in other locations (prevent duplicate sourceUrl across locations)
      const existsInOtherLocation = allExistingItems.some(
        (existingItem) =>
          existingItem.sourceUrl === newItem.sourceUrl &&
          existingItem.title === newItem.title
      );
      
      return !existsInCurrentLocation && !existsInOtherLocation;
    });

    if (newItems.length > 0) {
      const updatedItems = [...existingItems, ...newItems];
      savedItems.push(...newItems);

      // Update or create category document
      // Use existingLocation if we found a match, otherwise use normalizedLocation
      const locationToUse = existingLocation || normalizedLocation;
      
      await categoryDocRef.set(
        {
          userId,
          location: locationToUse,
          items: updatedItems,
          itemCount: updatedItems.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...((categoryQuery.empty && !matchedCategory) && {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
        },
        { merge: true }
      );

      console.log(
        `✅ Saved ${newItems.length} item(s) to category: ${locationToUse}`
      );
    } else {
      console.log(
        `ℹ️ No new items to add to category: ${normalizedLocation} (duplicates skipped)`
      );
    }

    return {
      locations: [existingLocation || normalizedLocation],
      savedItems,
    };
  } catch (error) {
    console.error("❌ Error saving categorized content:", error);
    throw error;
  }
};

/**
 * Get all items for a specific location category
 * @param {string} location - Location name
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array>} - Array of items in that category
 */
const getCategoryItems = async (location, userId) => {
  try {
    if (!userId) {
      throw new Error("UserId is required to get category items");
    }

    const db = getFirestore();
    const normalizedLocation = location
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    const categoryQuery = await db
      .collection(COLLECTION_NAME)
      .where("location", "==", normalizedLocation)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (categoryQuery.empty) {
      return [];
    }

    const categoryData = categoryQuery.docs[0].data();
    return categoryData.items || [];
  } catch (error) {
    console.error("❌ Error getting category items:", error);
    throw error;
  }
};

/**
 * Get all categories for a user
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array>} - Array of all category documents for the user
 */
const getAllCategories = async (userId) => {
  try {
    if (!userId) {
      throw new Error("UserId is required to get all categories");
    }

    const db = getFirestore();
    const categoriesSnapshot = await db
      .collection(COLLECTION_NAME)
      .where("userId", "==", userId)
      .get();

    return categoriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      location: doc.data().location,
      itemCount: doc.data().itemCount || 0,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("❌ Error getting all categories:", error);
    throw error;
  }
};

/**
 * Delete inspiration items by IDs (bulk deletion)
 * @param {Array<string>} itemIds - Array of IDs of inspiration items to delete
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object>} - Result with deleted items info and updated categories
 */
const deleteInspirationItems = async (itemIds, userId) => {
  try {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new Error("Item IDs array is required and must not be empty");
    }

    if (!userId) {
      throw new Error("UserId is required to delete inspiration items");
    }

    const db = getFirestore();
    const categoriesRef = db.collection(COLLECTION_NAME);

    // Find all categories for this user
    const allUserCategories = await categoriesRef
      .where("userId", "==", userId)
      .get();

    const deletedItems = [];
    const updatedCategories = [];
    const notFoundIds = [];
    const itemIdSet = new Set(itemIds); // For efficient lookup

    // Process each category
    for (const doc of allUserCategories.docs) {
      const categoryData = doc.data();
      const items = categoryData.items || [];
      
      // Find items in this category that match any of the IDs to delete
      const itemsToDelete = items.filter((item) => item.id && itemIdSet.has(item.id));
      const remainingItems = items.filter((item) => !item.id || !itemIdSet.has(item.id));
      
      if (itemsToDelete.length > 0) {
        // Add to deleted items list
        deletedItems.push(...itemsToDelete);
        
        // Update the category document
        await doc.ref.update({
          items: remainingItems,
          itemCount: remainingItems.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updatedCategories.push({
          id: doc.id,
          location: categoryData.location,
          itemCount: remainingItems.length,
        });

        console.log(`✅ Deleted ${itemsToDelete.length} inspiration item(s) from location: ${categoryData.location}`);
      }
    }

    // Check which IDs were not found
    const deletedIds = new Set(deletedItems.map((item) => item.id));
    itemIds.forEach((id) => {
      if (!deletedIds.has(id)) {
        notFoundIds.push(id);
      }
    });

    if (deletedItems.length === 0) {
      throw new Error("None of the inspiration items were found");
    }

    return {
      deletedItems,
      deletedCount: deletedItems.length,
      updatedCategories,
      notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
    };
  } catch (error) {
    console.error("❌ Error deleting inspiration items:", error);
    throw error;
  }
};

/**
 * Get inspiration items by their IDs
 * @param {Array<string>} itemIds - Array of inspiration item IDs
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<Array>} - Array of inspiration items with their location
 */
const getInspirationItemsByIds = async (itemIds, userId) => {
  try {
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      throw new Error("Item IDs array is required and must not be empty");
    }

    if (!userId) {
      throw new Error("UserId is required to get inspiration items");
    }

    const db = getFirestore();
    const categoriesRef = db.collection(COLLECTION_NAME);

    // Find all categories for this user
    const allUserCategories = await categoriesRef
      .where("userId", "==", userId)
      .get();

    const itemIdSet = new Set(itemIds);
    const foundItems = [];

    // Search through all categories for matching items
    for (const doc of allUserCategories.docs) {
      const categoryData = doc.data();
      const items = categoryData.items || [];
      const categoryLocation = categoryData.location || "";

      // Find items that match the requested IDs
      items.forEach((item) => {
        if (item.id && itemIdSet.has(item.id)) {
          foundItems.push({
            ...item,
            categoryLocation, // Add the location from the category
          });
        }
      });
    }

    // Check if all IDs were found
    const foundIds = new Set(foundItems.map((item) => item.id));
    const notFoundIds = itemIds.filter((id) => !foundIds.has(id));

    if (notFoundIds.length > 0) {
      console.warn(`⚠️ Some inspiration item IDs were not found: ${notFoundIds.join(", ")}`);
    }

    return foundItems;
  } catch (error) {
    console.error("❌ Error getting inspiration items by IDs:", error);
    throw error;
  }
};

/**
 * Map inspiration category to activity type
 * @param {string} category - Inspiration category
 * @returns {string} - Activity type
 */
const mapCategoryToActivityType = (category) => {
  const categoryLower = (category || "").toLowerCase();
  
  if (categoryLower.includes("restaurant") || categoryLower.includes("cafe") || categoryLower.includes("food")) {
    return "restaurant";
  }
  if (categoryLower.includes("lodging") || categoryLower.includes("accommodation")) {
    return "accommodation";
  }
  if (categoryLower.includes("sightseeing") || categoryLower.includes("travel") || categoryLower.includes("attraction")) {
    return "attraction";
  }
  if (categoryLower.includes("transport") || categoryLower.includes("logistics")) {
    return "transport";
  }
  if (categoryLower.includes("shopping")) {
    return "activity";
  }
  
  return "activity"; // Default to "activity" for other categories
};

/**
 * Format inspiration items into trip activity format
 * @param {Array} inspirationItems - Array of inspiration items with categoryLocation
 * @returns {Array} - Array of formatted activity objects
 */
const formatInspirationItemsToActivities = (inspirationItems) => {
  const { determineTimeBlock } = require("./autoArrangementService");
  
  return inspirationItems.map((item) => {
    const activityType = mapCategoryToActivityType(item.category);
    const timeBlock = determineTimeBlock(item.time || null, activityType);
    
    const activity = {
      name: item.title || "Untitled Activity",
      description: item.description || "",
      location: item.categoryLocation || "", // Use the location from the category
      type: activityType,
      timeBlock, // Add timeBlock field
      sourceType: "inspiration",
      sourceId: item.id, // Link to inspiration item ID
    };
    
    // Only include time if it exists (Firestore doesn't allow undefined)
    if (item.time) {
      activity.time = item.time;
    }
    
    return activity;
  });
};

/**
 * Get all activity names from trips for a user
 * @param {string} userId - The user ID from Clerk
 * @param {string|null} tripId - Optional specific trip ID to filter by
 * @returns {Promise<Set<string>>} - Set of activity names (normalized for matching)
 */
const getActivityNamesFromTrips = async (userId, tripId = null) => {
  try {
    const { getFirestore } = require("../config/database");
    const db = getFirestore();
    const tripsRef = db.collection("trips");
    
    let tripsSnapshot;
    if (tripId) {
      // Get specific trip
      const tripDoc = await tripsRef.doc(tripId).get();
      if (!tripDoc.exists || tripDoc.data().userId !== userId) {
        return new Set();
      }
      tripsSnapshot = { docs: [tripDoc] };
    } else {
      // Get all trips for user
      tripsSnapshot = await tripsRef.where("userId", "==", userId).get();
    }
    
    const activityNames = new Set();
    
    tripsSnapshot.docs.forEach((doc) => {
      const tripData = doc.data();
      const itinerary = tripData.itinerary || {};
      
      // Iterate through all days
      Object.keys(itinerary).forEach((dayKey) => {
        if (dayKey.startsWith("day")) {
          const day = itinerary[dayKey];
          const activities = day.activities || [];
          
          activities.forEach((activity) => {
            if (activity.name) {
              // Normalize activity name for matching (lowercase, trim)
              const normalizedName = activity.name.toLowerCase().trim();
              if (normalizedName) {
                activityNames.add(normalizedName);
              }
            }
          });
        }
      });
    });
    
    return activityNames;
  } catch (error) {
    console.error("❌ Error getting activity names from trips:", error);
    throw error;
  }
};

/**
 * Filter inspiration items based on status, trip, and category
 * @param {string} userId - The user ID from Clerk
 * @param {object} filters - Filter options
 * @param {string} filters.status - "Unassigned", "Assigned to trip", or "All Inspiration"
 * @param {string} filters.tripId - "all" or a specific trip ID
 * @param {string|null} filters.category - Category filter (Restaurant, Activity, Landmark, Shop, Accomodation, Other) or null for all
 * @returns {Promise<object>} - Filtered inspiration items organized by location
 */
const filterInspirations = async (userId, filters = {}) => {
  try {
    if (!userId) {
      throw new Error("UserId is required to filter inspirations");
    }
    
    const { status = "All Inspiration", tripId = "all", category = null } = filters;
    
    // Validate status filter
    const validStatuses = ["Unassigned", "Assigned to trip", "All Inspiration"];
    if (!validStatuses.includes(status)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`);
    }
    
    // Validate category filter if provided
    // Note: Using "Accomodation" (one 'm') to match existing data from AI summary service
    const validCategories = ["Restaurant", "Activity", "Landmark", "Shop", "Accomodation", "Other"];
    if (category && !validCategories.includes(category)) {
      throw new Error(`Invalid category. Must be one of: ${validCategories.join(", ")}`);
    }
    
    // Get all inspirations for the user
    const allCategories = await getAllCategories(userId);
    
    // Get activity names from trips if we need to check assignment status
    let activityNamesSet = new Set();
    const checkAssignment = status === "Unassigned" || status === "Assigned to trip";
    
    if (checkAssignment) {
      const specificTripId = tripId === "all" ? null : tripId;
      activityNamesSet = await getActivityNamesFromTrips(userId, specificTripId);
    }
    
    // Filter and organize inspirations
    const filteredCategories = [];
    let totalFilteredItems = 0;
    
    for (const categoryDoc of allCategories) {
      const items = categoryDoc.items || [];
      const filteredItems = [];
      
      for (const item of items) {
        // Filter by category
        if (category && item.category !== category) {
          continue;
        }
        
        // Filter by assignment status
        if (checkAssignment) {
          const itemTitle = (item.title || "").toLowerCase().trim();
          const isAssigned = activityNamesSet.has(itemTitle);
          
          if (status === "Unassigned" && isAssigned) {
            continue;
          }
          if (status === "Assigned to trip" && !isAssigned) {
            continue;
          }
        }
        
        filteredItems.push(item);
      }
      
      // Only include category if it has filtered items
      if (filteredItems.length > 0) {
        filteredCategories.push({
          id: categoryDoc.id,
          location: categoryDoc.location,
          itemCount: filteredItems.length,
          items: filteredItems,
          createdAt: categoryDoc.createdAt,
          updatedAt: categoryDoc.updatedAt,
        });
        totalFilteredItems += filteredItems.length;
      }
    }
    
    return {
      organizedByLocation: filteredCategories,
      totalCategories: filteredCategories.length,
      totalItems: totalFilteredItems,
      filters: {
        status,
        tripId,
        category,
      },
    };
  } catch (error) {
    console.error("❌ Error filtering inspirations:", error);
    throw error;
  }
};

module.exports = {
  saveCategorizedContent,
  getCategoryItems,
  getAllCategories,
  deleteInspirationItems,
  getInspirationItemsByIds,
  formatInspirationItemsToActivities,
  filterInspirations,
};
