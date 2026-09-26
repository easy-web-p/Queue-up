import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { apiClient } from './apiClient';
import type { StoreCustomerChatThread, CustomerChatMessage } from '../types';

export interface SendMessageParams {
  storeId: string;
  customerId: string;
  senderRole: 'customer' | 'merchant' | 'buyer' | 'seller';
  senderName: string;
  senderId?: string;
  message: string;
  orderId?: string;
  customerName?: string;
  customerAvatar?: string;
  customerPhone?: string;
  chatId?: string;
}

export const ChatService = {
  /**
   * Fetch all customer threads for a store from the server / Firestore
   */
  async fetchStoreThreads(storeId: string): Promise<StoreCustomerChatThread[]> {
    try {
      const res = await apiClient.get<{ success: boolean; threads: StoreCustomerChatThread[] }>(
        `/chat/threads/${encodeURIComponent(storeId)}`
      );
      if (res?.success && Array.isArray(res.threads)) {
        return res.threads;
      }
    } catch (err) {
      console.warn('[ChatService] fetchStoreThreads API error:', err);
    }
    return [];
  },

  /**
   * Fetch messages for a specific thread
   */
  async fetchThreadMessages(chatId: string): Promise<CustomerChatMessage[]> {
    try {
      const res = await apiClient.get<{ success: boolean; messages: CustomerChatMessage[] }>(
        `/chat/messages/${encodeURIComponent(chatId)}`
      );
      if (res?.success && Array.isArray(res.messages)) {
        return res.messages;
      }
    } catch (err) {
      console.warn('[ChatService] fetchThreadMessages API error:', err);
    }
    return [];
  },

  /**
   * Real-time subscription to customer threads for a merchant's store
   */
  subscribeStoreThreads(
    storeId: string,
    onUpdate: (threads: StoreCustomerChatThread[]) => void
  ): () => void {
    if (!storeId || typeof storeId !== 'string') {
      return () => {};
    }

    let isCleanedUp = false;

    // 1. Initial fast fetch via API
    this.fetchStoreThreads(storeId).then(initialThreads => {
      if (!isCleanedUp && Array.isArray(initialThreads) && initialThreads.length > 0) {
        onUpdate(initialThreads);
      }
    }).catch(() => {});

    // 2. Set up Firestore Realtime Snapshot
    let unsubscribeFirestore = () => {};
    try {
      if (db) {
        const q = query(
          collection(db, 'chats'),
          where('storeId', '==', storeId)
        );

        unsubscribeFirestore = onSnapshot(
          q,
          async (snap) => {
            if (isCleanedUp) return;
            if (snap.empty) {
              const apiThreads = await this.fetchStoreThreads(storeId);
              if (!isCleanedUp && Array.isArray(apiThreads) && apiThreads.length > 0) {
                onUpdate(apiThreads);
              }
              return;
            }

            const threads: StoreCustomerChatThread[] = [];

            for (const docSnap of snap.docs) {
              const data = docSnap.data() || {};
              const threadId = docSnap.id;

              // Load latest messages
              let messages: CustomerChatMessage[] = [];
              try {
                const msgSnap = await getDocs(
                  query(
                    collection(db, 'chats', threadId, 'messages'),
                    orderBy('timestamp', 'asc')
                  )
                );
                messages = msgSnap.docs.map(m => ({
                  id: m.id,
                  ...(m.data() || {})
                } as CustomerChatMessage));
              } catch {
                // fallback if subcollection query is restricted
              }

              const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

              threads.push({
                id: threadId,
                storeId: data.storeId || storeId,
                customerId: data.customerId || '',
                customerName: data.customerName || 'ลูกค้า',
                customerPhone: data.customerPhone || '',
                customerAvatar: data.customerAvatar || '',
                queueNumber: data.queueNumber || '',
                orderSummary: data.orderSummary || '',
                orderTotal: data.orderTotal || 0,
                orderStatus: data.orderStatus || '',
                lastMessage: lastMsg?.message || data.lastMessage || '',
                lastTimestamp: lastMsg?.timestamp || data.lastTimestamp || data.updatedAt || new Date().toISOString(),
                unreadCount: typeof data.unreadCountMerchant === 'number' ? data.unreadCountMerchant : (data.unreadCount || 0),
                aiAutoReply: data.aiAutoReply !== false,
                aiSilencedUntil: data.aiSilencedUntil || null,
                messages: Array.isArray(messages) ? messages : []
              });
            }

            threads.sort((a, b) => {
              const timeB = new Date(b.lastTimestamp || 0).getTime() || 0;
              const timeA = new Date(a.lastTimestamp || 0).getTime() || 0;
              return timeB - timeA;
            });
            if (!isCleanedUp) onUpdate(threads);
          },
          (err) => {
            console.warn('[ChatService] Firestore thread subscription error (will poll API):', err.message);
          }
        );
      }
    } catch (e) {
      console.warn('[ChatService] Failed to attach onSnapshot listener:', e);
    }


    // 3. Periodic API polling fallback every 8 seconds
    const pollInterval = setInterval(() => {
      if (isCleanedUp) return;
      this.fetchStoreThreads(storeId).then(threads => {
        if (!isCleanedUp && threads.length > 0) {
          onUpdate(threads);
        }
      }).catch(() => {});
    }, 8000);

    return () => {
      isCleanedUp = true;
      clearInterval(pollInterval);
      unsubscribeFirestore();
    };
  },

  /**
   * Real-time subscription to messages inside a specific chat thread
   */
  subscribeThreadMessages(
    chatId: string,
    onUpdate: (messages: CustomerChatMessage[]) => void
  ): () => void {
    if (!chatId || typeof chatId !== 'string' || !chatId.trim()) {
      return () => {};
    }

    let isCleanedUp = false;

    // Fast initial fetch
    this.fetchThreadMessages(chatId).then(initialMsgs => {
      if (!isCleanedUp && Array.isArray(initialMsgs) && initialMsgs.length > 0) {
        onUpdate(initialMsgs);
      }
    }).catch(() => {});

    let unsubscribeFirestore = () => {};
    try {
      if (db) {
        const q = query(
          collection(db, 'chats', chatId, 'messages'),
          orderBy('timestamp', 'asc')
        );

        unsubscribeFirestore = onSnapshot(
          q,
          (snap) => {
            if (isCleanedUp) return;
            const msgs: CustomerChatMessage[] = snap.docs.map(d => ({
              id: d.id,
              ...(d.data() || {})
            } as CustomerChatMessage));
            onUpdate(msgs);
          },
          (err) => {
            console.warn('[ChatService] Message onSnapshot warning:', err.message);
          }
        );
      }
    } catch (e) {
      console.warn('[ChatService] Message subscription init error:', e);
    }


    const pollInterval = setInterval(() => {
      if (isCleanedUp) return;
      this.fetchThreadMessages(chatId).then(msgs => {
        if (!isCleanedUp && msgs.length > 0) {
          onUpdate(msgs);
        }
      }).catch(() => {});
    }, 5000);

    return () => {
      isCleanedUp = true;
      clearInterval(pollInterval);
      unsubscribeFirestore();
    };
  },

  /**
   * Send message to backend / Firestore with auto AI assistant & push notifications
   */
  async sendMessage(params: SendMessageParams): Promise<{
    success: boolean;
    message?: CustomerChatMessage;
    aiReply?: CustomerChatMessage | null;
    thread?: StoreCustomerChatThread;
    error?: string;
  }> {
    try {
      const res = await apiClient.post<{
        success: boolean;
        message: CustomerChatMessage;
        aiReply?: CustomerChatMessage | null;
        thread: StoreCustomerChatThread;
        error?: string;
      }>('/chat/messages', params);

      return res;
    } catch (err: any) {
      console.error('[ChatService] sendMessage error:', err);
      return { success: false, error: err.message };
    }
  },

  /**
   * Mark a thread as read
   */
  async markThreadRead(storeId: string, chatId: string, role: 'merchant' | 'customer' = 'merchant'): Promise<void> {
    try {
      await apiClient.post('/chat/mark-read', { storeId, chatId, role });
    } catch (err) {
      console.warn('[ChatService] markThreadRead warning:', err);
    }
  },

  /**
   * Fetch all store chat threads for a customer from the server / Firestore
   */
  async fetchCustomerThreads(customerId: string): Promise<CustomerStoreChatThread[]> {
    try {
      const res = await apiClient.get<{ success: boolean; threads: CustomerStoreChatThread[] }>(
        `/chat/customer-threads/${encodeURIComponent(customerId)}`
      );
      if (res?.success && Array.isArray(res.threads)) {
        return res.threads;
      }
    } catch (err) {
      console.warn('[ChatService] fetchCustomerThreads API error:', err);
    }
    return [];
  },

  /**
   * Real-time subscription to chat threads for a customer across stores
   */
  subscribeCustomerThreads(
    customerId: string,
    onUpdate: (threads: CustomerStoreChatThread[]) => void
  ): () => void {
    if (!customerId || typeof customerId !== 'string') {
      return () => {};
    }

    let isCleanedUp = false;

    // 1. Initial fast fetch via API
    this.fetchCustomerThreads(customerId).then(initialThreads => {
      if (!isCleanedUp && Array.isArray(initialThreads) && initialThreads.length > 0) {
        onUpdate(initialThreads);
      }
    }).catch(() => {});

    // 2. Set up Firestore Realtime Snapshot
    let unsubscribeFirestore = () => {};
    try {
      if (db) {
        const q = query(
          collection(db, 'chats'),
          where('customerId', '==', customerId)
        );

        unsubscribeFirestore = onSnapshot(
          q,
          async (snap) => {
            if (isCleanedUp) return;
            if (snap.empty) {
              const apiThreads = await this.fetchCustomerThreads(customerId);
              if (!isCleanedUp && Array.isArray(apiThreads) && apiThreads.length > 0) {
                onUpdate(apiThreads);
              }
              return;
            }

            const threads: CustomerStoreChatThread[] = [];

            for (const docSnap of snap.docs) {
              const data = docSnap.data() || {};
              const threadId = docSnap.id;

              // Load latest messages
              let messages: CustomerChatMessage[] = [];
              try {
                const msgSnap = await getDocs(
                  query(
                    collection(db, 'chats', threadId, 'messages'),
                    orderBy('timestamp', 'asc')
                  )
                );
                messages = msgSnap.docs.map(m => ({
                  id: m.id,
                  ...(m.data() || {})
                } as CustomerChatMessage));
              } catch {
                // fallback
              }

              const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;

              threads.push({
                id: threadId,
                storeId: data.storeId || '',
                storeName: data.storeName || '',
                storeLogo: data.storeLogo || '',
                customerId: data.customerId || customerId,
                customerName: data.customerName || 'ลูกค้า',
                queueId: data.queueId || data.orderId || '',
                queueNumber: data.queueNumber || '',
                orderSummary: data.orderSummary || '',
                lastMessage: lastMsg?.message || data.lastMessage || '',
                lastTimestamp: lastMsg?.timestamp || data.lastTimestamp || data.updatedAt || new Date().toISOString(),
                unreadCount: typeof data.unreadCountCustomer === 'number' ? data.unreadCountCustomer : 0,
                unreadCountCustomer: typeof data.unreadCountCustomer === 'number' ? data.unreadCountCustomer : 0,
                messages: Array.isArray(messages) ? messages : []
              });
            }

            threads.sort((a, b) => {
              const timeB = new Date(b.lastTimestamp || 0).getTime() || 0;
              const timeA = new Date(a.lastTimestamp || 0).getTime() || 0;
              return timeB - timeA;
            });
            if (!isCleanedUp) onUpdate(threads);
          },
          (err) => {
            console.warn('[ChatService] Firestore customer thread subscription error (will poll API):', err.message);
          }
        );
      }
    } catch (e) {
      console.warn('[ChatService] Failed to attach onSnapshot customer listener:', e);
    }

    // 3. Periodic API polling fallback every 8 seconds
    const pollInterval = setInterval(() => {
      if (isCleanedUp) return;
      this.fetchCustomerThreads(customerId).then(threads => {
        if (!isCleanedUp && threads.length > 0) {
          onUpdate(threads);
        }
      }).catch(() => {});
    }, 8000);

    return () => {
      isCleanedUp = true;
      clearInterval(pollInterval);
      unsubscribeFirestore();
    };
  }
};

export interface CustomerStoreChatThread {
  id: string;
  storeId: string;
  storeName?: string;
  storeLogo?: string;
  customerId: string;
  customerName?: string;
  queueId?: string;
  queueNumber?: string;
  orderSummary?: string;
  orderTotal?: number;
  orderStatus?: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
  unreadCountCustomer?: number;
  messages?: CustomerChatMessage[];
}
