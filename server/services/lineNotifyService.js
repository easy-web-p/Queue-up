/**
 * LINE alerts for QueueUp.
 *
 * LINE shut LINE Notify down on 31 March 2025, so notify-api.line.me answers
 * nothing useful any more. Every call from here was a request that could only
 * fail — quietly, since the failure was logged and swallowed — while still
 * costing a round trip on a serverless function with no timeout on it.
 *
 * Rather than delete the integration and the token plumbing around it, the
 * service now refuses immediately and says why, so nobody spends an afternoon
 * wondering why their token does not work. Setting LINE_NOTIFY_ENDPOINT points
 * it at a replacement — the LINE Messaging API, or a bridge of your own — and
 * it starts sending again, with a timeout so a hanging endpoint can never hold
 * a function open.
 */

/** Discontinued 2025-03-31. Kept to recognise a stale configuration. */
const DISCONTINUED_ENDPOINT = 'https://notify-api.line.me/api/notify';

/** How long to wait before giving up on whatever endpoint is configured. */
const SEND_TIMEOUT_MS = 5000;

export class LineNotifyService {
  /**
   * Send notification via LINE Notify API
   * @param {Object} params
   * @param {string} params.token - User or Merchant LINE Notify Token
   * @param {string} params.message - Message body to send
   * @returns {Promise<{ success: boolean, status?: number, error?: string }>}
   */
  static async send({ token, message }) {
    const notifyToken = token || process.env.LINE_NOTIFY_TOKEN;
    if (!notifyToken) {
      return { success: false, reason: 'NO_TOKEN_CONFIGURED' };
    }

    if (!message) {
      return { success: false, reason: 'EMPTY_MESSAGE' };
    }

    const endpoint = (process.env.LINE_NOTIFY_ENDPOINT || '').trim();
    if (!endpoint || endpoint === DISCONTINUED_ENDPOINT) {
      return {
        success: false,
        reason: 'LINE_NOTIFY_DISCONTINUED',
        error: 'LINE Notify was shut down on 2025-03-31. Set LINE_NOTIFY_ENDPOINT to a '
          + 'replacement (the LINE Messaging API, or your own bridge) to send LINE alerts again.'
      };
    }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${notifyToken.trim()}`
        },
        body: new URLSearchParams({
          message: `\n${message}`
        }),
        // Without this a hanging endpoint holds a serverless invocation open
        // until the platform kills it.
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS)
      });

      if (response.ok) {
        console.log('[LineNotifyService] Notification sent successfully to LINE');
        return { success: true, status: response.status };
      } else {
        const errorText = await response.text();
        console.warn(`[LineNotifyService] Failed to send LINE alert (${response.status}):`, errorText);
        return { success: false, status: response.status, error: errorText };
      }
    } catch (err) {
      console.warn('[LineNotifyService] Network or dispatch error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Helper: Alert Customer when their queue is approaching (<= 2 queues remaining)
   */
  static async notifyQueueApproaching({ token, storeName, queueNumber, remainingQueues = 2 }) {
    const msg = `🔔 [QueueUp แจ้งเตือนคิว]\nร้าน: ${storeName}\nคิวของคุณ: #${queueNumber}\nเหลืออีกเพียง ${remainingQueues} คิวก่อนหน้า!\n👉 กรุณาเตรียมตัวไปรอที่หน้าร้านนะคะ`;
    return this.send({ token, message: msg });
  }

  /**
   * Helper: Alert Customer when food is ready
   */
  static async notifyOrderReady({ token, storeName, queueNumber }) {
    const msg = `🍽️ [QueueUp อาหารพร้อมแล้ว!]\nร้าน: ${storeName}\nคิวของคุณ: #${queueNumber}\nปรุงเสร็จเรียบร้อยแล้วค่ะ\n👉 สามารถแสดงหมายเลขคิวเพื่อรับอาหารที่หน้าร้านได้ทันที!`;
    return this.send({ token, message: msg });
  }

  /**
   * Helper: Alert Merchant when new pre-order / order is received
   */
  static async notifyNewOrderToMerchant({ token, storeName, queueNumber, totalAmount, itemCount }) {
    const msg = `🛎️ [มีออเดอร์ใหม่เข้า!]\nร้าน: ${storeName}\nคิว: #${queueNumber} (${itemCount} รายการ)\nยอดรวม: ฿${totalAmount}\n👉 เปิดดูออเดอร์ในหน้า KDS ได้เลยค่ะ`;
    return this.send({ token, message: msg });
  }
}
