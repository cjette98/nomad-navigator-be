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
    // Normalize location name (capitalize first letter, lowercase rest)
    const normalizedLocation = location
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // Check if category exists for this user
    const categoryQuery = await categoriesRef
      .where("location", "==", normalizedLocation)
      .where("userId", "==", userId)
      .limit(1)
      .get();

    let categoryDocRef;
    let existingItems = [];

    if (!categoryQuery.empty) {
      // Category exists - get existing document
      categoryDocRef = categoryQuery.docs[0].ref;
      const existingData = categoryQuery.docs[0].data();
      existingItems = existingData.items || [];
      console.log(`✅ Found existing category: ${normalizedLocation}`);
    } else {
      // Create new category
      categoryDocRef = categoriesRef.doc();
      console.log(`🆕 Creating new category: ${normalizedLocation}`);
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
    const allUserCategories = await categoriesRef
      .where("userId", "==", userId)
      .get();
    
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
      await categoryDocRef.set(
        {
          userId,
          location: normalizedLocation,
          items: updatedItems,
          itemCount: updatedItems.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          ...(categoryQuery.empty && {
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
        },
        { merge: true }
      );

      console.log(
        `✅ Saved ${newItems.length} item(s) to category: ${normalizedLocation}`
      );
    } else {
      console.log(
        `ℹ️ No new items to add to category: ${normalizedLocation} (duplicates skipped)`
      );
    }

    return {
      locations: [normalizedLocation],
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
 * Delete an inspiration item by ID
 * @param {string} itemId - The ID of the inspiration item to delete
 * @param {string} userId - The user ID from Clerk
 * @returns {Promise<object>} - Result with deleted item info and updated location
 */
const deleteInspirationItem = async (itemId, userId) => {
  try {
    if (!itemId) {
      throw new Error("Item ID is required to delete inspiration item");
    }

    if (!userId) {
      throw new Error("UserId is required to delete inspiration item");
    }

    const db = getFirestore();
    const categoriesRef = db.collection(COLLECTION_NAME);

    // Find the category that contains this item
    const allUserCategories = await categoriesRef
      .where("userId", "==", userId)
      .get();

    let deletedItem = null;
    let updatedCategory = null;

    for (const doc of allUserCategories.docs) {
      const categoryData = doc.data();
      const items = categoryData.items || [];
      
      // Find the item with matching ID
      const itemIndex = items.findIndex((item) => item.id === itemId);
      
      if (itemIndex !== -1) {
        deletedItem = items[itemIndex];
        
        // Remove the item from the array
        const updatedItems = items.filter((item) => item.id !== itemId);
        
        // Update the category document
        await doc.ref.update({
          items: updatedItems,
          itemCount: updatedItems.length,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        updatedCategory = {
          id: doc.id,
          location: categoryData.location,
          itemCount: updatedItems.length,
        };

        console.log(`✅ Deleted inspiration item ${itemId} from location: ${categoryData.location}`);
        break;
      }
    }

    if (!deletedItem) {
      throw new Error("Inspiration item not found");
    }

    return {
      deletedItem,
      updatedCategory,
    };
  } catch (error) {
    console.error("❌ Error deleting inspiration item:", error);
    throw error;
  }
};

module.exports = {
  saveCategorizedContent,
  getCategoryItems,
  getAllCategories,
  deleteInspirationItem,
};
