export type CategoryGroup = 'mens-clothing' | 'shoes' | 'mens-accessories' | 'collections';

export type AdminRole = 'super_admin' | 'store_manager' | 'content_manager';

export type PaymentProviderId = 'paystack' | 'flutterwave' | 'stripe' | 'bank_transfer' | 'cod';

export type PaymentStatus = 'pending' | 'awaiting_verification' | 'paid' | 'failed' | 'refunded';

export type OrderStatus =
  | 'Pending Payment'
  | 'Payment Confirmed'
  | 'Processing'
  | 'Ready for Dispatch'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Refunded';

export interface UserProfile {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone?: string;
  defaultState?: string;
  defaultCity?: string;
  defaultAddress?: string;
  status: 'active' | 'suspended';
  createdAt: any;
  updatedAt: any;
}

export interface AdminProfile {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  group: CategoryGroup;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
  active: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description?: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  categoryGroup: 'mens-clothing' | 'shoes' | 'mens-accessories';
  regularPrice: number;
  discountPrice?: number | null;
  mainImage: string;
  images?: string[];
  sizes?: string[];
  colors?: string[];
  variantStock?: Record<string, number>;
  stockQuantity: number;
  soldCount?: number;
  ratingAvg?: number;
  reviewCount?: number;
  isFeatured?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  isNewArrival?: boolean;
  status: 'published' | 'draft' | 'hidden';
  createdAt: any;
  updatedAt: any;
}

export interface CartItem {
  productId: string;
  name: string;
  slug: string;
  sku: string;
  image: string;
  price: number;
  regularPrice: number;
  size: string;
  color: string;
  quantity: number;
  maxStock: number;
  availableSizes?: string[];
  availableColors?: string[];
  categorySlug?: string;
}

export interface TrackingEvent {
  status: OrderStatus;
  note: string;
  timestamp: string;
  updatedBy?: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  image: string;
  price: number;
  size: string;
  color: string;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  state: string;
  city: string;
  deliveryAddress: string;
  deliveryInstructions?: string;
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  couponCode?: string;
  deliveryFee: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paymentProvider: PaymentProviderId;
  paymentReference?: string;
  paymentProofUrl?: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  trackingNumber?: string;
  deliveryCompany?: string;
  riderName?: string;
  riderPhone?: string;
  estimatedDeliveryDate?: string;
  trackingHistory: TrackingEvent[];
  createdAt: any;
  updatedAt: any;
}

export interface PaymentGatewayConfig {
  id: string;
  provider: PaymentProviderId;
  displayName: string;
  publicKey?: string;
  mode: 'test' | 'live';
  active: boolean;
  isDefault: boolean;
  hasSecretConfigured?: boolean;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  paymentInstructions?: string;
  codEligibleStates?: string[];
  codExtraFee?: number;
  updatedAt: any;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  orderNumber: string;
  reference: string;
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  verifiedAt?: any;
  createdAt: any;
}

export interface ShippingZone {
  id: string;
  state: string;
  cities?: string[];
  fee: number;
  freeDeliveryThreshold?: number;
  estimatedDays?: string;
  deliveryCompany?: string;
  active: boolean;
  updatedAt: any;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxUses?: number;
  usedCount?: number;
  expiresAt?: string;
  applicableCategorySlugs?: string[];
  active: boolean;
  createdAt: any;
}

export interface Banner {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl: string;
  ctaText?: string;
  ctaLink?: string;
  placement: 'hero' | 'promo_mid' | 'category';
  active: boolean;
  sortOrder?: number;
  updatedAt: any;
}

export interface Review {
  id: string;
  productId: string;
  userId: string;
  authorName: string;
  rating: number;
  comment: string;
  approved: boolean;
  createdAt: any;
}

export interface StoreSettings {
  id: string;
  storeName: string;
  tagline: string;
  logoUrl?: string;
  businessEmail?: string;
  phone?: string;
  whatsappNumber?: string;
  address?: string;
  currencySymbol: string;
  freeDeliveryThreshold?: number;
  taxRatePercent?: number;
  allowGuestCheckout?: boolean;
  autoRestoreStockOnCancel?: boolean;
  socialInstagram?: string;
  socialTwitter?: string;
  socialFacebook?: string;
  aboutContent?: string;
  privacyPolicy?: string;
  termsConditions?: string;
  shippingPolicy?: string;
  updatedAt: any;
}

export interface AdminActivityLog {
  id: string;
  adminUid: string;
  adminEmail: string;
  adminRole?: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
  createdAt: any;
}

export interface StoreNotification {
  id: string;
  userId?: string;
  recipientEmail: string;
  type: string;
  subject: string;
  body: string;
  orderNumber?: string;
  createdAt: any;
}
