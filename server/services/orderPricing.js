/**
 * Order fee arithmetic.
 *
 * The same three lines were duplicated in order creation, the Stripe webhook
 * and payment verification. Three copies of money arithmetic is three places
 * for them to drift apart, and the clamp in the original
 * (`Math.max(0, total - platformFee - gatewayFee)`) silently broke the
 * identity the ledger depends on: on a small order the fees could exceed the
 * total, merchantNet was clamped to zero, and the posting no longer balanced.
 *
 * Everything here is integer satang. The one invariant, which the ledger and
 * the tests both rely on:
 *
 *     totalSatang === platformFeeSatang + gatewayFeeSatang + merchantNetSatang
 */

/** Platform commission. */
export const PLATFORM_FEE_RATE = 0.10;

/** Card/PromptPay gateway fee, including VAT on the fee itself. */
export const GATEWAY_FEE_RATE = 0.0165 * 1.07;

/**
 * Splits an order total between the merchant, the platform and the gateway.
 *
 * @param {number} totalSatang Integer satang the customer pays
 * @param {object} [options]
 * @param {boolean} [options.chargedByGateway=true] False for cash and wallet
 *        payments, where no card network is involved
 * @returns {{ platformFeeSatang: number, gatewayFeeSatang: number, merchantNetSatang: number }}
 */
export function computeFeeBreakdown(totalSatang, { chargedByGateway = true } = {}) {
  const total = Math.max(0, Math.round(Number(totalSatang) || 0));
  if (total === 0) {
    return { platformFeeSatang: 0, gatewayFeeSatang: 0, merchantNetSatang: 0 };
  }

  let gatewayFeeSatang = chargedByGateway ? Math.round(total * GATEWAY_FEE_RATE) : 0;
  let platformFeeSatang = Math.round(total * PLATFORM_FEE_RATE);

  // On a very small order the rounded fees can add up to more than the order
  // itself. Clamping the merchant's share to zero would leave the books short
  // by the overflow, so the fees give way instead, gateway first.
  if (gatewayFeeSatang + platformFeeSatang > total) {
    gatewayFeeSatang = Math.min(gatewayFeeSatang, total);
    platformFeeSatang = total - gatewayFeeSatang;
  }

  // The merchant takes the remainder, so the three parts always re-add to the
  // total no matter how the rounding fell.
  const merchantNetSatang = total - platformFeeSatang - gatewayFeeSatang;

  return { platformFeeSatang, gatewayFeeSatang, merchantNetSatang };
}

/**
 * Reads the breakdown already stored on an order, falling back to recomputing
 * it. Used by the webhook and payment verification, which run against an order
 * written earlier and must not invent a different split.
 *
 * @param {object} order Firestore order document
 * @returns {{ totalSatang: number, platformFeeSatang: number, gatewayFeeSatang: number, merchantNetSatang: number }}
 */
export function resolveOrderBreakdown(order) {
  const totalSatang = Number(order?.totalSatang) || Math.round(Number(order?.total || 0) * 100);

  const stored = {
    platformFeeSatang: Number(order?.platformFeeSatang),
    gatewayFeeSatang: Number(order?.estimatedGatewayFeeSatang),
    merchantNetSatang: Number(order?.merchantNetSatang)
  };

  const allStored = Object.values(stored).every((v) => Number.isFinite(v));
  const storedBalances = allStored
    && stored.platformFeeSatang + stored.gatewayFeeSatang + stored.merchantNetSatang === totalSatang;

  // A stored split that does not re-add to the total would post an unbalanced
  // ledger group, so it is recomputed rather than trusted.
  if (storedBalances) return { totalSatang, ...stored };

  return {
    totalSatang,
    ...computeFeeBreakdown(totalSatang, {
      chargedByGateway: order?.paymentMethod !== 'cash' && !order?.paidFromWallet
    })
  };
}
