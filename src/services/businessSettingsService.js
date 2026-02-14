import {
    collection,
    doc,
    setDoc,
    getDoc,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'businessSettings';

/**
 * Save business settings
 */
export const saveBusinessSettings = async (userId, settingsData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        await setDoc(docRef, {
            ...settingsData,
            userId,
            updatedAt: Timestamp.now(),
        }, { merge: true });
    } catch (error) {
        console.error('Error saving business settings:', error);
        throw error;
    }
};

/**
 * Get business settings
 */
export const getBusinessSettings = async (userId) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            // Return default settings if none exist
            return {
                businessName: '',
                gstNumber: '',
                address: '',
                phone: '',
                email: '',
            };
        }
    } catch (error) {
        console.error('Error getting business settings:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time business settings updates
 */
export const subscribeToBusinessSettings = (userId, callback) => {
    const docRef = doc(db, COLLECTION_NAME, userId);

    return onSnapshot(
        docRef,
        (docSnap) => {
            if (docSnap.exists()) {
                callback(docSnap.data());
            } else {
                // Return default settings if none exist
                callback({
                    businessName: '',
                    gstNumber: '',
                    address: '',
                    phone: '',
                    email: '',
                });
            }
        },
        (error) => {
            console.error('Error in business settings subscription:', error);
            callback({
                businessName: '',
                gstNumber: '',
                address: '',
                phone: '',
                email: '',
            });
        }
    );
};
