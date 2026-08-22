import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    getDocs,
    onSnapshot,
    Timestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION_NAME = 'returns';

/**
 * Add a new return record
 */
export const addReturn = async (userId, returnData) => {
    try {
        const docRef = await addDoc(collection(db, COLLECTION_NAME), {
            ...returnData,
            userId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
        return docRef.id;
    } catch (error) {
        console.error('Error adding return:', error);
        throw error;
    }
};

/**
 * Update a return record
 */
export const updateReturn = async (returnId, returnData) => {
    try {
        const docRef = doc(db, COLLECTION_NAME, returnId);
        await updateDoc(docRef, {
            ...returnData,
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error updating return:', error);
        throw error;
    }
};

/**
 * Delete a return record
 */
export const deleteReturn = async (returnId) => {
    try {
        await deleteDoc(doc(db, COLLECTION_NAME, returnId));
    } catch (error) {
        console.error('Error deleting return:', error);
        throw error;
    }
};

/**
 * Subscribe to real-time return updates for a user
 */
export const subscribeToReturns = (userId, callback) => {
    const q = query(
        collection(db, COLLECTION_NAME),
        where('userId', '==', userId)
    );

    return onSnapshot(
        q,
        (querySnapshot) => {
            const returnsList = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                returnDate: doc.data().returnDate?.toDate?.() || new Date(doc.data().returnDate),
            }));
            callback(returnsList);
        },
        (error) => {
            console.error('Error in returns subscription:', error);
            callback([]);
        }
    );
};

/**
 * Get returns by orderId
 */
export const getReturnsByOrderId = async (orderId) => {
    try {
        const q = query(
            collection(db, COLLECTION_NAME),
            where('orderId', '==', orderId)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            returnDate: doc.data().returnDate?.toDate?.() || new Date(doc.data().returnDate),
        }));
    } catch (error) {
        console.error('Error getting returns by orderId:', error);
        throw error;
    }
};
