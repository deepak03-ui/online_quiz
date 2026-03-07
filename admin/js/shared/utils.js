// NEW: This entire file is new to create a reusable utility.
import { db } from './firebase-config.js'; // Ensure this path is correct for your project structure
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-firestore.js";
import { getFromCache, setInCache } from './cache.js';

/**
 * Populates multiple select/dropdown elements from the metadata collection.
 * It uses an in-memory cache to prevent redundant Firestore reads.
 * @param {Array<Object>} filterConfigs - Array of { elementId: string, metadataKey: string, placeholder: string }
 */
export async function populateFiltersFromMetadata(filterConfigs) {
    const cachedMetadata = getFromCache('metadata');
    if (cachedMetadata) {
        console.log("Populating filters from CACHED metadata.");
        filterConfigs.forEach(config => {
            const selectEl = document.getElementById(config.elementId);
            if (selectEl) {
                const data = cachedMetadata[config.metadataKey] || [];
                selectEl.innerHTML = `<option value="">${config.placeholder}</option>`;
                data.sort().forEach(item => {
                    selectEl.innerHTML += `<option value="${item}">${item}</option>`;
                });
            }
        });
        return;
    }

    console.log("Populating filters from FIRESTORE metadata...");
    try {
        const metadataRef = doc(db, 'metadata', 'appData'); // Central metadata document
        const docSnap = await getDoc(metadataRef);

        if (docSnap.exists()) {
            const metadata = docSnap.data();
            setInCache('metadata', metadata); // Cache the entire metadata object

            filterConfigs.forEach(config => {
                const selectEl = document.getElementById(config.elementId);
                if (selectEl) {
                    const data = metadata[config.metadataKey] || [];
                    selectEl.innerHTML = `<option value="">${config.placeholder}</option>`;
                    data.sort().forEach(item => {
                        selectEl.innerHTML += `<option value="${item}">${item}</option>`;
                    });
                }
            });
        } else {
            console.error("Metadata document 'appData' not found!");
        }
    } catch (error) {
        console.error("Error populating filters from metadata:", error);
    }
}