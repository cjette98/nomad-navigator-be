const admin = require("firebase-admin");

let db = null;

const initializeFirebase = async () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length > 0) {
      db = admin.firestore();
      console.log("✅ Firebase already initialized");
      return;
    }

    // Initialize Firebase Admin SDK
    // Option 1: Using service account JSON (base64 encoded in env)
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
      try {
        const serviceAccount = JSON.parse(
          Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8")
        );

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });

        db = admin.firestore();
        console.log("✅ Firebase initialized from base64 service account");
      } catch (error) {
        console.error("❌ Error parsing Firebase service account:", error.message);
        throw error;
      }
    }
    // Option 2: Using service account JSON file path
    else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });

      db = admin.firestore();
      console.log("✅ Firebase initialized from service account file");
    }
    // Option 3: Using individual environment variables
    else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_PRIVATE_KEY &&
      process.env.FIREBASE_CLIENT_EMAIL
    ) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });

      db = admin.firestore();
      console.log("✅ Firebase initialized from environment variables");
    }
    // Option 4: Default credentials (for Google Cloud environments)
    else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });

      db = admin.firestore();
      console.log("✅ Firebase initialized with default credentials");
    }

    console.log("✅ Firestore connected successfully");
  } catch (error) {
    console.error("❌ Firebase initialization error:", error.message);
    // Don't throw error to allow server to start even if DB is not available
    // In production, you might want to handle this differently
  }
};

const getFirestore = () => {
  if (!db) {
    throw new Error("Firestore not initialized. Call initializeFirebase() first.");
  }
  return db;
};

module.exports = { initializeFirebase, getFirestore };
