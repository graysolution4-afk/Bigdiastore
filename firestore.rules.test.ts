/**
 * Security Rule Verification Suite for DIAMOND STORE
 * Validates the "Dirty Dozen" adversarial payloads against firestore.rules invariants.
 */

export const DIRTY_DOZEN_CASES = [
  { name: 'Admin privilege escalation by customer', collection: 'admins', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field injection on user profile', collection: 'users', expected: 'PERMISSION_DENIED' },
  { name: 'Order identity spoofing (mismatched userId)', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'Unauthorized order list scraping', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified admin email spoofing', collection: 'products', expected: 'PERMISSION_DENIED' },
  { name: 'Oversized document ID poisoning', collection: 'reviews', expected: 'PERMISSION_DENIED' },
  { name: '1MB review comment payload', collection: 'reviews', expected: 'PERMISSION_DENIED' },
  { name: 'Unbounded cart items array (>50)', collection: 'carts', expected: 'PERMISSION_DENIED' },
  { name: 'Customer self-marking order as paid', collection: 'orders', expected: 'PERMISSION_DENIED' },
  { name: 'List query on order_tracking_public', collection: 'order_tracking_public', expected: 'PERMISSION_DENIED' },
  { name: 'Backdated createdAt timestamp injection', collection: 'reviews', expected: 'PERMISSION_DENIED' },
  { name: 'Admin activity log deletion', collection: 'admin_activity_logs', expected: 'PERMISSION_DENIED' },
] as const;
