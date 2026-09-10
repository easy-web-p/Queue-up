/* eslint-disable no-unused-vars */
/**
 * 💳 Payment Gateway Provider Interface
 *
 * Provides a clean abstraction layer for payment channels (PromptPay, Credit/Debit, etc.)
 * allowing QueueUp to swap or extend payment providers (2C2P, Opn, GB Prime Pay)
 * without rewriting core order logic.
 */

export class PaymentProvider {
  /**
   * Generates a PromptPay QR code payment intent
   * @param {object} params
   * @param {string} params.orderId - QueueUp Order ID
   * @param {number} params.amountSatang - Canonical amount in Satang (1 THB = 100 Satang)
   * @param {string} params.description - Item/Order description
   * @param {number} [params.expiresInMinutes=15] - QR Time-to-Live
   * @returns {Promise<{ qrPayload: string, qrImageUrl: string, referenceId: string, expiresAt: string }>}
   */
  async createPromptPayIntent(params) {
    throw new Error("createPromptPayIntent must be implemented by payment provider");
  }

  /**
   * Verifies the authenticity and signature of an incoming webhook notification
   * @param {object} headers - HTTP request headers
   * @param {string|Buffer} rawBody - Raw unparsed HTTP body
   * @returns {Promise<{ isValid: boolean, orderId: string, paymentStatus: 'PAID' | 'FAILED', transactionRef: string, paidAmountSatang: number }>}
   */
  async verifyWebhookSignature(headers, rawBody) {
    throw new Error("verifyWebhookSignature must be implemented by payment provider");
  }
}
