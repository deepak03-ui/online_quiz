// NEW: This is a new module to implement a shared, in-memory caching strategy.
// This object holds cached data and is cleared automatically on a page refresh.
const appCache = {
  metadata: null,
};

/**
 * Gets the application metadata (all unique departments, years, sections, etc.).
 * Fetches from Firestore on the first call and caches the result for subsequent calls.
 * @param {object} db - The Firestore database instance.
 * @returns {Promise<object>} A promise that resolves to the metadata object.
 */
export async function getMetadata(db) {
  if (appCache.metadata) {
    console.log("Returning metadata from cache.");
    return appCache.metadata;
  }

  try {
    console.log("Fetching metadata from Firestore.");
    const metadataDoc = await db.collection('metadata').doc('appData').get();
    if (metadataDoc.exists) {
      // Store the fetched data in the in-memory cache.
      appCache.metadata = metadataDoc.data();
      return appCache.metadata;
    } else {
      console.warn("Metadata document ('metadata/appData') not found!");
      return {}; // Return empty object to prevent errors.
    }
  } catch (error) {
    console.error("Error fetching metadata:", error);
    return {}; // Return empty object on error.
  }
}