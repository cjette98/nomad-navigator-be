const admin = require("firebase-admin");
const { getFirestore } = require("../config/database");
const { extractLocations } = require("./locationExtractionService");

const COLLECTION_NAME = "inspirationsCollection";

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

    // Extract locations from content
    console.log("📍 Extracting locations from content...");
    const locations = await extractLocations(contentData);
    console.log("📍 Extracted locations:", locations);

    if (locations.length === 0) {
      console.log("⚠️ No locations found, saving to 'Uncategorized'");
      locations.push("Uncategorized");
    }

    const db = getFirestore();
    const categoriesRef = db.collection(COLLECTION_NAME);
    const savedItems = [];

    // Process each location
    for (const location of locations) {
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

      // Add metadata to each content item
      const enrichedItems = contentData.map((item) => ({
        ...item,
        sourceType,
        sourceUrl,
        addedAt: admin.firestore.Timestamp.now(),
      }));

      // Merge with existing items (avoid duplicates based on title + sourceUrl)
      const newItems = enrichedItems.filter((newItem) => {
        return !existingItems.some(
          (existingItem) =>
            existingItem.title === newItem.title &&
            existingItem.sourceUrl === newItem.sourceUrl
        );
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
    }

    return {
      locations: locations.map((loc) =>
        loc
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ")
      ),
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

module.exports = {
  saveCategorizedContent,
  getCategoryItems,
  getAllCategories,
};
