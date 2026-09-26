import { auth } from '../config/firebase';
import { QueueStatus, PaymentMethodId } from '../types';
import { AuthoritativeOrder } from '../types/schema';

export type PayoutStatus = 'REQUESTED' | 'PAID' | 'FAILED';

/** A merchant withdrawal request as the platform operator sees it. */
export interface PlatformPayout {
  id: string;
  storeId: string;
  storeName: string;
  amountSatang: number;
  status: PayoutStatus;
  bankAccountSnapshot?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    accountNumberMasked?: string;
  };
  failureReason?: string | null;
  createdAt: string;
  updatedAt?: string;
  paidAt?: string | null;
}

/** Money that arrived at the gateway but could not be applied to its order. */
export interface PaymentException {
  id: string;
  orderId: string;
  reason: string;
  amountSatang: number | null;
  expectedSatang: number | null;
  detail?: string;
  status: 'OPEN' | 'RESOLVED';
  providerPaymentIntentId?: string | null;
  providerCheckoutSessionId?: string | null;
  resolvedAction?: string;
  resolvedNote?: string;
  resolvedByEmail?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export interface CreateOrderItemInput {
  menuItemId: string;
  quantity: number;
  selectedOptions?: {
    groupName: string;
    choiceName: string;
    priceDelta?: number;
  }[];
  specialNote?: string;
}

export interface CreateOrderRequest {
  storeId: string;
  items: CreateOrderItemInput[];
  paymentMethod: PaymentMethodId;
  allergenAcknowledged: boolean;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  pickupTime?: string;
  specialNote?: string;
  idempotencyKey?: string;
  reservationId?: string;
  slotId?: string;
  workload?: number;
}

export interface SlotCapacityInfo {
  slotId: string;
  startTime: string;
  endTime: string;
  capacity: number;
  confirmedWorkload: number;
  pendingWorkload: number;
  usedWorkload: number;
  remainingWorkload: number;
  status: 'AVAILABLE' | 'NEAR_CAPACITY' | 'FULL';
}

export interface CapacityDateResponse {
  storeId: string;
  date: string;
  slots: SlotCapacityInfo[];
}

export interface ReserveCapacityRequest {
  storeId: string;
  scheduledSlotId?: string;
  pickupType?: 'NOW' | 'SCHEDULED';
  items: { menuItemId?: string; quantity: number; workload?: number }[];
  reservationId?: string;
  idempotencyKey?: string;
  customerId?: string;
  schoolId?: string;
  ttlMs?: number;
}

export interface ReserveCapacityResponse {
  success: boolean;
  reservationId: string;
  slotId: string;
  workload: number;
  pickupType: 'NOW' | 'SCHEDULED';
  expiresAt: number;
  remainingWorkload: number;
}

export interface CampusWalletTransaction {
  id: string;
  type: 'TOPUP' | 'SPEND' | 'REFUND' | 'ADJUSTMENT';
  amountSatang: number;
  balanceAfterSatang: number;
  orderId?: string | null;
  note?: string;
  createdAt: string;
}

export interface CampusWallet {
  uid: string;
  balanceSatang: number;
  balanceBaht: number;
  transactions: CampusWalletTransaction[];
}

export interface CreateOrderResponse {
  success: boolean;
  orderId: string;
  /** Present when the order was paid from the Campus Wallet. */
  walletBalanceSatang?: number | null;
  orderNumber: string;
  order: AuthoritativeOrder;
  exchangePin?: string;
  warning?: string;
}

export interface UpdateOrderStatusRequest {
  orderId: string;
  nextStatus: QueueStatus;
  note?: string;
  expectedVersion?: number;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  orderId: string;
  status: QueueStatus;
  version: number;
}

/**
 * Generate cryptographically secure UUID for idempotency
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `idemp_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

class ApiClient {
  private baseUrl: string = '/api';

  private async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        const token = await currentUser.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      } catch (err) {
        console.warn('[ApiClient] Failed to acquire Firebase ID token:', err);
      }
    } else {
      // Local session / guest fallback
      try {
        const sessionStr = typeof window !== 'undefined'
          ? (localStorage.getItem('queueup_session_v1') || localStorage.getItem('queueup_session'))
          : null;
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          const userData = session?.user || session;
          if (userData?.id) {
            headers['X-Mock-User-Id'] = userData.id;
            headers['X-Mock-User-Email'] = userData.email || 'customer@queueup.app';
            headers['X-Mock-User-Name'] = encodeURIComponent(userData.fullName || userData.name || 'คุณลูกค้า');
            headers['X-Mock-User-Role'] = userData.role || 'customer';
            if (userData.schoolId) {
              headers['X-Mock-School-Id'] = userData.schoolId;
            }
          }
        }
      } catch {
        // Ignore JSON error
      }
    }

    return headers;
  }

  /**
   * Command Model: Create new order via Express Backend Transaction
   */
  async createOrder(payload: CreateOrderRequest): Promise<CreateOrderResponse> {
    const idempotencyKey = payload.idempotencyKey || generateIdempotencyKey();
    const headers = await this.getAuthHeaders();
    headers['X-Idempotency-Key'] = idempotencyKey;

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        idempotencyKey
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to create order');
    }

    return data;
  }

  /**
   * Command Model: Transition queue status via State Machine on Express Backend
   */
  async updateOrderStatus(payload: UpdateOrderStatusRequest): Promise<UpdateOrderStatusResponse> {
    const headers = await this.getAuthHeaders();

    const response = await fetch(`${this.baseUrl}/orders/${payload.orderId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        status: payload.nextStatus,
        note: payload.note,
        version: payload.expectedVersion
      })
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to update order status');
    }

    return data;
  }

  /**
   * Stripe Payment: Create Checkout Session for PromptPay / Cards
   */
  async createCheckoutSession(payload: {
    orderId: string;
    amount: number;
    storeName?: string;
    items?: { name: string; price: number; quantity: number }[];
    customerEmail?: string;
    paymentMethodType?: 'promptpay' | 'card';
    returnUrl?: string;
  }): Promise<{ success: boolean; sessionId: string; url: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/payment/create-checkout-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to create payment session');
    }
    return data;
  }

  /**
   * Stripe Payment: Verify that a session was paid
   */
  async verifyPaymentSession(sessionId: string, orderId: string): Promise<{ paid: boolean; paymentStatus: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/payment/verify-session`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ sessionId, orderId })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Payment verification failed');
    }
    return data;
  }

  /**
   * Merchant: Get all store orders with financial breakdowns
   */
  async getMerchantOrders(storeId: string): Promise<AuthoritativeOrder[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/orders?storeId=${encodeURIComponent(storeId)}`, {
      method: 'GET',
      headers
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to load merchant orders');
    }
    return data.orders || [];
  }

  /**
   * Merchant: Accept paid order, assigns queue number and transitions to PREPARING
   */
  async acceptMerchantOrder(orderId: string): Promise<{ success: boolean; orderNumber: string; status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/orders/${orderId}/accept`, {
      method: 'POST',
      headers
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to accept order');
    }
    return data;
  }

  /**
   * Merchant: Reject order and initiate Stripe refund
   */
  async rejectMerchantOrder(orderId: string, reasonCode = 'ITEM_SOLD_OUT', reasonMessage = 'วัตถุดิบหมด'): Promise<{ success: boolean; status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/orders/${orderId}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reasonCode, reasonMessage })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to reject order');
    }
    return data;
  }

  /**
   * Merchant: Mark order food ready for customer pickup
   */
  async readyMerchantOrder(orderId: string): Promise<{ success: boolean; status: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/orders/${orderId}/ready`, {
      method: 'POST',
      headers
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Failed to mark order ready');
    }
    return data;
  }

  /**
   * Merchant: Complete order by verifying customer's 4-digit pickup PIN
   */
  async completeMerchantOrder(orderId: string, exchangePin: string): Promise<{ success: boolean; status: string; settlementStatus: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/orders/${orderId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ exchangePin })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'PIN verification failed');
    }
    return data;
  }

  /**
   * Merchant Wallet: Get balance summary
   */
  async getMerchantWallet(storeId: string): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/wallet/${encodeURIComponent(storeId)}`, {
      method: 'GET',
      headers
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch wallet');
    }
    return data.balance;
  }

  /**
   * Merchant Wallet: Get double-entry ledger entries
   */
  async getMerchantLedger(storeId: string): Promise<any[]> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/wallet/${encodeURIComponent(storeId)}/ledger`, {
      method: 'GET',
      headers
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || 'Failed to fetch ledger');
    }
    return data.entries || [];
  }

  /**
   * Merchant Wallet: Request payout
   */
  async requestMerchantPayout(
    storeId: string,
    amountSatang: number,
    bankAccountSnapshot: { bankName: string; accountName: string; accountNumberMasked: string }
  ): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/payouts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ storeId, amountSatang, bankAccountSnapshot })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || data.message || 'Payout request failed');
    }
    return data;
  }

  /**
   * Merchant Wallet: Release funds whose hold period has elapsed
   */
  async releaseHeldFunds(storeId: string): Promise<{ success: boolean; releasedCount: number; releasedOrders: string[] }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/wallet/release-held-funds`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ storeId })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to release held funds');
    }
    return data;
  }

  /**
   * Merchant Wallet: Create the store's Stripe Connect account
   */
  async createStripeConnectAccount(storeId: string, storeName?: string, storeEmail?: string): Promise<{ success: boolean; accountId: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/connect/account`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ storeId, storeName, storeEmail })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to create Stripe account');
    }
    return data;
  }

  /**
   * Merchant Wallet: Generate a Stripe Connect onboarding link.
   * storeId is required so the server can verify the account belongs to it.
   */
  async createStripeOnboardingLink(storeId: string, accountId: string): Promise<{ success: boolean; url: string }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/connect/onboarding-link`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ storeId, accountId })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to create onboarding link');
    }
    return data;
  }

  /**
   * Campus Wallet: the signed-in user's balance and recent transactions.
   * Returns null when the endpoint is unreachable, so callers can simply hide
   * the wallet option rather than blocking checkout.
   */
  async getWallet(): Promise<CampusWallet | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/wallet`, { method: 'GET', headers });
      if (!response.ok) return null;
      const data = await response.json();
      return data?.success ? { ...data.wallet, transactions: data.transactions || [] } : null;
    } catch {
      return null;
    }
  }

  /**
   * Campus Wallet: campus counter top-up. Restricted to institution admins by
   * the server; the idempotency key stops a retried request crediting twice.
   */
  async creditWallet(uid: string, amountSatang: number, idempotencyKey?: string): Promise<{ balanceSatang: number }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/wallet/${encodeURIComponent(uid)}/credit`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        amountSatang,
        idempotencyKey: idempotencyKey || generateIdempotencyKey()
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Wallet top-up failed');
    }
    return data;
  }

  async patch<T = any>(endpoint: string, body?: any): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }

  async put<T = any>(endpoint: string, body?: any): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: 'PUT',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }

  async get<T = any>(endpoint: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, { method: 'GET', headers });
    return response.json();
  }

  async post<T = any>(endpoint: string, body?: any): Promise<T> {
    const headers = await this.getAuthHeaders();
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return response.json();
  }

  /**
   * Capacity: Get 15-minute slot capacity for a specific date
   */
  async getCapacity(storeId: string, date: string): Promise<CapacityDateResponse> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/capacity/${encodeURIComponent(storeId)}/${encodeURIComponent(date)}`, {
      method: 'GET',
      headers
    });
    const data = await response.json();
    return data;
  }

  /**
   * Capacity: Reserve workload for a slot atomically
   */
  async reserveCapacity(payload: ReserveCapacityRequest): Promise<ReserveCapacityResponse> {
    const headers = await this.getAuthHeaders();
    if (payload.idempotencyKey) {
      headers['X-Idempotency-Key'] = payload.idempotencyKey;
    }
    // Identity headers are honoured only by the server's development mock-auth
    // path; in production the reservation is attributed from the verified token.
    if (payload.customerId && !headers['X-Mock-User-Id']) {
      headers['X-Mock-User-Id'] = payload.customerId;
    }
    if (payload.schoolId && !headers['X-Mock-School-Id']) {
      headers['X-Mock-School-Id'] = payload.schoolId;
    }
    const response = await fetch(`${this.baseUrl}/capacity/reserve`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      const err = new Error(data.message || data.error || 'Failed to reserve capacity');
      (err as any).details = data.details;
      (err as any).remainingWorkload = data.remainingWorkload;
      (err as any).code = data.code || data.error;
      throw err;
    }
    return data;
  }

  /**
   * Platform operator: withdrawal requests across every store.
   *
   * Restricted to platform administrators server-side; a merchant gets a 403.
   */
  async listPlatformPayouts(status?: PayoutStatus): Promise<{
    success: boolean;
    payouts: PlatformPayout[];
  }> {
    const headers = await this.getAuthHeaders();
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetch(`${this.baseUrl}/platform/payouts${query}`, { headers });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to load payout requests');
    }
    return data;
  }

  /** Platform operator: attest that a transfer actually left the bank account. */
  async completePayout(payoutId: string, reference?: string): Promise<{ success: boolean }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/payouts/${payoutId}/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ providerTransferId: reference || null })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to confirm the transfer');
    }
    return data;
  }

  /** Platform operator: a transfer failed, so the reserved funds go back. */
  async failPayout(payoutId: string, reason: string): Promise<{ success: boolean }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/merchant/payouts/${payoutId}/fail`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to record the failure');
    }
    return data;
  }

  /** Platform operator: money that arrived but could not be applied to an order. */
  async listPaymentExceptions(status: 'OPEN' | 'RESOLVED' | 'ALL' = 'OPEN'): Promise<{
    success: boolean;
    exceptions: PaymentException[];
    openCount: number;
  }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(
      `${this.baseUrl}/platform/payment-exceptions?status=${status}`, { headers }
    );
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to load payment exceptions');
    }
    return data;
  }

  /** Platform operator: record that a stuck payment has been dealt with. */
  async resolvePaymentException(
    id: string,
    action: string,
    note?: string
  ): Promise<{ success: boolean; alreadyResolved?: boolean }> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/platform/payment-exceptions/${id}/resolve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ action, note })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Failed to resolve the exception');
    }
    return data;
  }

  /**
   * Capacity: Release reserved capacity
   */
  async releaseCapacity(payload: { storeId: string; slotId: string; reservationId: string }): Promise<any> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}/capacity/release`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return response.json();
  }
}

export const apiClient = new ApiClient();
