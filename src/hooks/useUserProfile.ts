import { useState, useEffect } from 'react';
import { userRepository } from '../repositories/userRepository';
import { PublicUserProfile, PrivateUserProfile, UserStats } from '../types/schema';
import { auth } from '../config/firebase';

export interface UseUserProfileResult {
  userId: string | null;
  publicProfile: PublicUserProfile | null;
  privateProfile: PrivateUserProfile | null;
  stats: UserStats | null;
  isOwner: boolean;
  isLoading: boolean;
  error: string | null;
  updateProfile: (updates: Partial<PrivateUserProfile>) => Promise<void>;
}

export function useUserProfile(userId?: string | null): UseUserProfileResult {
  const [publicProfile, setPublicProfile] = useState<PublicUserProfile | null>(null);
  const [privateProfile, setPrivateProfile] = useState<PrivateUserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentAuthUid = auth.currentUser?.uid || null;
  const targetUid = userId || currentAuthUid;
  const isOwner = Boolean(currentAuthUid && targetUid && currentAuthUid === targetUid);

  useEffect(() => {
    if (!targetUid) {
      setPublicProfile(null);
      setPrivateProfile(null);
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // 1. Subscribe to Public Profile (realtime from Firestore cache / server)
    const unsubPublic = userRepository.subscribePublicProfile(targetUid, (profile) => {
      setPublicProfile(profile);
      setIsLoading(false);
    });

    // 2. Subscribe to User Order Stats Summary
    const unsubStats = userRepository.subscribeUserStats(targetUid, (s) => {
      setStats(s);
    });

    // 3. Subscribe to Private Profile if and only if the viewer is the account owner or admin
    let unsubPrivate = () => {};
    if (isOwner) {
      unsubPrivate = userRepository.subscribePrivateProfile(targetUid, (privateData) => {
        setPrivateProfile(privateData);
      });
    }

    return () => {
      unsubPublic();
      unsubStats();
      unsubPrivate();
    };
  }, [targetUid, isOwner]);

  const updateProfile = async (updates: Partial<PrivateUserProfile>) => {
    if (!targetUid || !isOwner) {
      throw new Error('Unauthorized: You can only edit your own private profile.');
    }
    await userRepository.updatePrivateProfile(targetUid, updates);
  };

  return {
    userId: targetUid,
    publicProfile,
    privateProfile,
    stats,
    isOwner,
    isLoading,
    error,
    updateProfile
  };
}
