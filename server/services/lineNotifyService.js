/**
 * LINE Notify Service for QueueUp
 * Dispatches real-time queue, order, and status alerts to LINE.
 */
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

    try {
      const response = await fetch('https://notify-api.line.me/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${notifyToken.trim()}`
        },
        body: new URLSearchParams({
          message: `\n${message}`
        })
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
