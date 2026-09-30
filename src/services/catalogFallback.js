/**
 * What the app shows when the database has no catalogue yet.
 *
 * The old policy did two harmful things. It merged the demo dataset *over* the
 * real one, so six fabricated stores and their menus appeared alongside genuine
 * shops in every deployment — and ordering from one failed with
 * STORE_NOT_FOUND, because the server had never heard of it. And when the
 * collection came back empty it wrote the demo dataset to Firestore, so a
 * platform administrator opening the app on a fresh project seeded production
 * with invented shops, owners and prices.
 *
 * The policy now: real data wins outright, the demo dataset is a development
 * convenience only, and nothing is ever written back from the browser.
 */

/**
 * @template T
 * @param {T[]} cloudItems What the database returned
 * @param {T[]} demoItems The bundled demo dataset
 * @param {{ isDevelopment?: boolean }} [options]
 * @returns {T[]}
 */
export function resolveCatalog(cloudItems, demoItems, { isDevelopment = false } = {}) {
  const cloud = Array.isArray(cloudItems) ? cloudItems.filter(Boolean) : [];

  // Anything real, and only that. Mixing the demo set in was how a shop nobody
  // could order from ended up on the home screen.
  if (cloud.length > 0) {
    const byId = new Map();
    for (const item of cloud) {
      const id = item && item.id;
      if (id) byId.set(id, item);
    }
    return byId.size > 0 ? Array.from(byId.values()) : cloud;
  }

  // Nothing real. A developer wants something to look at; a customer must not be
  // shown shops that do not exist.
  if (isDevelopment) return Array.isArray(demoItems) ? demoItems : [];
  return [];
}

/** True when running against a dev server rather than a built deployment. */
export function isDevelopmentBuild() {
  try {
    return Boolean(import.meta.env && import.meta.env.DEV);
  } catch {
    return false;
  }
}
