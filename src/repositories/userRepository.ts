import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  publicProfileConverter,
  privateProfileConverter,
  userStatsConverter
} from './converter';
import { PublicUserProfile, PrivateUserProfile, UserStats } from '../types/schema';

const PUBLIC_PROFILES_COLLECTION = 'public_profiles';
const USERS_COLLECTION = 'users';
const STATS_COLLECTION = 'stats';

export const userRepository = {
  /**
   * Fetch public user profile from Firestore (IndexedDB cache or Server)
   */
  async getPublicProfile(uid: string): Promise<PublicUserProfile | null> {
    if (!uid) return null;
    const ref = doc(db, PUBLIC_PROFILES_COLLECTION, uid).withConverter(publicProfileConverter);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  /**
   * Realtime subscription for public profile (used in user profile page)
   */
  subscribePublicProfile(
    uid: string,
    callback: (profile: PublicUserProfile | null) => void
  ): Unsubscribe {
    if (!uid) {
      callback(null);
      return () => {};
    }
    const ref = doc(db, PUBLIC_PROFILES_COLLECTION, uid).withConverter(publicProfileConverter);
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.warn(`[userRepository] Failed to subscribe to public profile ${uid}:`, error);
        callback(null);
      }
    );
  },

  /**
   * Fetch private user profile (Only accessible by current user or Admin)
   */
  async getPrivateProfile(uid: string): Promise<PrivateUserProfile | null> {
    if (!uid) return null;
    const ref = doc(db, USERS_COLLECTION, uid).withConverter(privateProfileConverter);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  /**
   * Realtime subscription for private profile
   */
  subscribePrivateProfile(
    uid: string,
    callback: (profile: PrivateUserProfile | null) => void
  ): Unsubscribe {
    if (!uid) {
      callback(null);
      return () => {};
    }
    const ref = doc(db, USERS_COLLECTION, uid).withConverter(privateProfileConverter);
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.warn(`[userRepository] Private profile subscription error for ${uid}:`, error);
        callback(null);
      }
    );
  },

  /**
   * Fetch pre-aggregated user statistics (/users/{uid}/stats/summary)
   */
  async getUserStats(uid: string): Promise<UserStats | null> {
    if (!uid) return null;
    const ref = doc(db, USERS_COLLECTION, uid, STATS_COLLECTION, 'summary').withConverter(userStatsConverter);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  },

  /**
   * Realtime subscription for pre-aggregated user statistics
   */
  subscribeUserStats(
    uid: string,
    callback: (stats: UserStats | null) => void
  ): Unsubscribe {
    if (!uid) {
      callback(null);
      return () => {};
    }
    const ref = doc(db, USERS_COLLECTION, uid, STATS_COLLECTION, 'summary').withConverter(userStatsConverter);
    return onSnapshot(
      ref,
      (snap) => {
        callback(snap.exists() ? snap.data() : null);
      },
      (error) => {
        console.warn(`[userRepository] Stats summary subscription error for ${uid}:`, error);
        callback(null);
      }
    );
  },

  /**
   * Update private user profile (allergies, phone, studentId, etc.)
   */
  async updatePrivateProfile(uid: string, updates: Partial<PrivateUserProfile>): Promise<void> {
    if (!uid) throw new Error('UID is required to update profile');
    const ref = doc(db, USERS_COLLECTION, uid).withConverter(privateProfileConverter);
    await setDoc(ref, updates as PrivateUserProfile, { merge: true });
  }
};
