import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateOrderNumber, makeDocId, normalizePhone, sha256Hex } from '../lib/format';
import {
  INITIAL_BANNERS,
  INITIAL_CATEGORIES,
  INITIAL_COUPONS,
  INITIAL_PAYMENT_GATEWAYS,
  INITIAL_PRODUCTS,
  INITIAL_SHIPPING_ZONES,
  INITIAL_STORE_SETTINGS,
} from '../lib/seedData';
import {
  AdminActivityLog,
  Banner,
  CartItem,
  Category,
  Coupon,
  Order,
  OrderStatus,
  PaymentGatewayConfig,
  PaymentProviderId,
  PaymentStatus,
  PaymentTransaction,
  Product,
  Review,
  ShippingZone,
  StoreSettings,
  TrackingEvent,
} from '../types/store';
import { useAuth } from './AuthContext';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}

interface StoreContextValue {
  settings: StoreSettings;
  categories: Category[];
  products: Product[];
  publishedProducts: Product[];
  banners: Banner[];
  shippingZones: ShippingZone[];
  paymentGateways: PaymentGatewayConfig[];
  activePaymentGateways: PaymentGatewayConfig[];
  coupons: Coupon[];
  reviews: Review[];
  cart: CartItem[];
  wishlist: string[];
  appliedCoupon: Coupon | null;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  loadingCatalog: boolean;
  usingFallbackCatalog: boolean;
  toasts: ToastMessage[];
  notify: (text: string, tone?: 'success' | 'error' | 'info') => void;
  addToCart: (product: Product, size: string, color: string, quantity?: number) => void;
  removeFromCart: (index: number) => void;
  updateCartItem: (index: number, patch: Partial<CartItem>) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  applyCouponCode: (code: string, subtotal: number) => Promise<{ ok: boolean; message: string }>;
  removeCoupon: () => void;
  placeOrder: (input: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    state: string;
    city: string;
    deliveryAddress: string;
    deliveryInstructions?: string;
    paymentProvider: PaymentProviderId;
    paymentMethod: string;
    paymentProofUrl?: string;
    paymentReference?: string;
    deliveryFee: number;
    codExtraFee?: number;
  }) => Promise<Order>;
  markOrderPaymentVerified: (orderId: string, orderNumber: string, reference: string, provider: PaymentProviderId, amount: number) => Promise<void>;
  seedDatabaseFromDefaults: () => Promise<void>;
  logAdminAction: (action: string, targetCollection: string, targetId: string, summary: string) => Promise<void>;
  saveProduct: (product: Partial<Product> & { id?: string }) => Promise<string>;
  deleteProduct: (productId: string) => Promise<void>;
  saveCategory: (cat: Partial<Category> & { id?: string }) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveBanner: (banner: Partial<Banner> & { id?: string }) => Promise<void>;
  deleteBanner: (bannerId: string) => Promise<void>;
  saveShippingZone: (zone: Partial<ShippingZone> & { id?: string }) => Promise<void>;
  deleteShippingZone: (zoneId: string) => Promise<void>;
  savePaymentGateway: (gw: Partial<PaymentGatewayConfig> & { id?: string }) => Promise<void>;
  deletePaymentGateway: (gatewayId: string) => Promise<void>;
  saveCoupon: (coupon: Partial<Coupon> & { id?: string }) => Promise<void>;
  deleteCoupon: (couponId: string) => Promise<void>;
  saveStoreSettings: (patch: Partial<StoreSettings>) => Promise<void>;
  updateOrderFulfillment: (
    order: Order,
    updates: {
      orderStatus?: OrderStatus;
      paymentStatus?: PaymentStatus;
      trackingNumber?: string;
      deliveryCompany?: string;
      riderName?: string;
      riderPhone?: string;
      estimatedDeliveryDate?: string;
      note?: string;
    }
  ) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authReady, activeEmail, isAdmin, adminRole } = useAuth();

  const [settings, setSettings] = useState<StoreSettings>(INITIAL_STORE_SETTINGS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [banners, setBanners] = useState<Banner[]>(INITIAL_BANNERS);
  const [shippingZones, setShippingZones] = useState<ShippingZone[]>(INITIAL_SHIPPING_ZONES);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGatewayConfig[]>(INITIAL_PAYMENT_GATEWAYS);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [reviews, setReviews] = useState<Review[]>([]);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [usingFallbackCatalog, setUsingFallbackCatalog] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const notify = useCallback((text: string, tone: 'success' | 'error' | 'info' = 'info') => {
    const id = makeDocId('toast');
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  // Load & subscribe to public/admin storefront collections once auth state is settled
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    const unsubs: Array<() => void> = [];

    // 1. Settings
    unsubs.push(
      onSnapshot(
        doc(db, 'store_settings', 'main'),
        (snap) => {
          if (!active) return;
          if (snap.exists()) {
            setSettings({ id: snap.id, ...snap.data() } as StoreSettings);
          }
        },
        (err) => console.warn('Settings snapshot:', err.message)
      )
    );

    // 2. Categories
    unsubs.push(
      onSnapshot(
        query(collection(db, 'categories'), orderBy('sortOrder', 'asc')),
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setCategories(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category)));
          }
        },
        (err) => console.warn('Categories snapshot:', err.message)
      )
    );

    // 3. Products (admin queries all; public queries published)
    const prodQuery = isAdmin && firebaseUser
      ? query(collection(db, 'products'))
      : query(collection(db, 'products'), where('status', '==', 'published'));

    unsubs.push(
      onSnapshot(
        prodQuery,
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)));
            setUsingFallbackCatalog(false);
          } else {
            setProducts(INITIAL_PRODUCTS);
            setUsingFallbackCatalog(true);
          }
          setLoadingCatalog(false);
        },
        (err) => {
          console.warn('Products snapshot:', err.message);
          setLoadingCatalog(false);
        }
      )
    );

    // 4. Banners
    const bannerQuery = isAdmin && firebaseUser
      ? query(collection(db, 'banners'))
      : query(collection(db, 'banners'), where('active', '==', true));
    unsubs.push(
      onSnapshot(
        bannerQuery,
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setBanners(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Banner)));
          }
        },
        (err) => console.warn('Banners snapshot:', err.message)
      )
    );

    // 5. Shipping Zones
    unsubs.push(
      onSnapshot(
        collection(db, 'shipping_zones'),
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setShippingZones(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ShippingZone)));
          }
        },
        (err) => console.warn('Shipping snapshot:', err.message)
      )
    );

    // 6. Payment Gateways (public metadata only)
    unsubs.push(
      onSnapshot(
        collection(db, 'payment_gateways'),
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setPaymentGateways(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentGatewayConfig)));
          }
        },
        (err) => console.warn('Gateways snapshot:', err.message)
      )
    );

    // 7. Coupons
    const couponQuery = isAdmin && firebaseUser
      ? query(collection(db, 'coupons'))
      : query(collection(db, 'coupons'), where('active', '==', true));
    unsubs.push(
      onSnapshot(
        couponQuery,
        (snap) => {
          if (!active) return;
          if (!snap.empty) {
            setCoupons(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Coupon)));
          }
        },
        (err) => console.warn('Coupons snapshot:', err.message)
      )
    );

    // 8. Reviews
    const reviewQuery = isAdmin && firebaseUser
      ? query(collection(db, 'reviews'))
      : query(collection(db, 'reviews'), where('approved', '==', true));
    unsubs.push(
      onSnapshot(
        reviewQuery,
        (snap) => {
          if (!active) return;
          setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
        },
        (err) => console.warn('Reviews snapshot:', err.message)
      )
    );

    return () => {
      active = false;
      unsubs.forEach((u) => u());
    };
  }, [authReady, isAdmin, firebaseUser]);

  // Sync Cart & Wishlist with Firestore when signed in to Firebase
  useEffect(() => {
    if (!firebaseUser) return;
    const cartRef = doc(db, 'carts', firebaseUser.uid);
    const wishRef = doc(db, 'wishlists', firebaseUser.uid);

    const u1 = onSnapshot(
      cartRef,
      (snap) => {
        if (snap.exists()) {
          setCart((snap.data()?.items as CartItem[]) || []);
        }
      },
      (err) => console.warn('Cart sync:', err.message)
    );
    const u2 = onSnapshot(
      wishRef,
      (snap) => {
        if (snap.exists()) {
          setWishlist((snap.data()?.productIds as string[]) || []);
        }
      },
      (err) => console.warn('Wishlist sync:', err.message)
    );

    return () => {
      u1();
      u2();
    };
  }, [firebaseUser]);

  const syncCartToBackend = useCallback(
    async (nextCart: CartItem[]) => {
      if (!firebaseUser) return;
      try {
        await setDoc(doc(db, 'carts', firebaseUser.uid), {
          userId: firebaseUser.uid,
          items: nextCart.slice(0, 50),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Cart persistence warning:', err);
      }
    },
    [firebaseUser]
  );

  const syncWishlistToBackend = useCallback(
    async (nextWish: string[]) => {
      if (!firebaseUser) return;
      try {
        await setDoc(doc(db, 'wishlists', firebaseUser.uid), {
          userId: firebaseUser.uid,
          productIds: nextWish.slice(0, 100),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Wishlist persistence warning:', err);
      }
    },
    [firebaseUser]
  );

  const addToCart = useCallback(
    (product: Product, size: string, color: string, quantity = 1) => {
      const price =
        product.discountPrice && product.discountPrice < product.regularPrice
          ? product.discountPrice
          : product.regularPrice;
      const variantKey = `${size}|${color}`;
      const maxStock =
        product.variantStock && typeof product.variantStock[variantKey] === 'number'
          ? product.variantStock[variantKey]
          : product.stockQuantity;

      if (maxStock <= 0) {
        notify('This selection is currently out of stock.', 'error');
        return;
      }

      setCart((prev) => {
        const idx = prev.findIndex(
          (i) => i.productId === product.id && i.size === size && i.color === color
        );
        let next: CartItem[];
        if (idx >= 0) {
          next = prev.map((item, i) =>
            i === idx
              ? { ...item, quantity: Math.min(maxStock, item.quantity + quantity), maxStock }
              : item
          );
        } else {
          next = [
            ...prev,
            {
              productId: product.id,
              name: product.name,
              slug: product.slug,
              sku: product.sku,
              image: product.mainImage,
              price,
              regularPrice: product.regularPrice,
              size,
              color,
              quantity: Math.min(maxStock, quantity),
              maxStock,
              availableSizes: product.sizes,
              availableColors: product.colors,
              categorySlug: product.categorySlug,
            },
          ];
        }
        void syncCartToBackend(next);
        return next;
      });
      setCartOpen(true);
      notify(`Added ${product.name} to your bag.`, 'success');
    },
    [notify, syncCartToBackend]
  );

  const removeFromCart = useCallback(
    (index: number) => {
      setCart((prev) => {
        const next = prev.filter((_, i) => i !== index);
        void syncCartToBackend(next);
        return next;
      });
    },
    [syncCartToBackend]
  );

  const updateCartItem = useCallback(
    (index: number, patch: Partial<CartItem>) => {
      setCart((prev) => {
        const next = prev.map((item, i) => (i === index ? { ...item, ...patch } : item));
        void syncCartToBackend(next);
        return next;
      });
    },
    [syncCartToBackend]
  );

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
    void syncCartToBackend([]);
  }, [syncCartToBackend]);

  const toggleWishlist = useCallback(
    (productId: string) => {
      setWishlist((prev) => {
        const exists = prev.includes(productId);
        const next = exists ? prev.filter((id) => id !== productId) : [...prev, productId];
        void syncWishlistToBackend(next);
        notify(exists ? 'Removed from wishlist.' : 'Saved to wishlist.', 'info');
        return next;
      });
    },
    [notify, syncWishlistToBackend]
  );

  const applyCouponCode = useCallback(
    async (code: string, subtotal: number): Promise<{ ok: boolean; message: string }> => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) return { ok: false, message: 'Enter a coupon code.' };
      const match = coupons.find((c) => c.code.toUpperCase() === normalized && c.active);
      if (!match) return { ok: false, message: 'Coupon code is invalid or inactive.' };
      if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) {
        return { ok: false, message: 'This coupon has expired.' };
      }
      if (match.maxUses && (match.usedCount || 0) >= match.maxUses) {
        return { ok: false, message: 'This coupon has reached its usage limit.' };
      }
      if (match.minOrderValue && subtotal < match.minOrderValue) {
        return {
          ok: false,
          message: `Minimum order of ₦${match.minOrderValue.toLocaleString()} required for ${match.code}.`,
        };
      }
      setAppliedCoupon(match);
      return { ok: true, message: `Coupon ${match.code} applied.` };
    },
    [coupons]
  );

  const removeCoupon = useCallback(() => setAppliedCoupon(null), []);

  const logAdminAction = useCallback(
    async (action: string, targetCollection: string, targetId: string, summary: string) => {
      if (!firebaseUser) return;
      try {
        const logId = makeDocId('log');
        await setDoc(doc(db, 'admin_activity_logs', logId), {
          adminUid: firebaseUser.uid,
          adminEmail: activeEmail || 'admin@diamondstore.ng',
          adminRole: adminRole || 'super_admin',
          action,
          targetCollection,
          targetId,
          summary,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('Audit log write skipped:', err);
      }
    },
    [firebaseUser, activeEmail, adminRole]
  );

  const seedDatabaseFromDefaults = useCallback(async () => {
    if (!firebaseUser || !isAdmin) return;
    try {
      const existingProducts = await getDocs(collection(db, 'products'));
      if (!existingProducts.empty) return;

      await setDoc(doc(db, 'store_settings', 'main'), {
        ...INITIAL_STORE_SETTINGS,
        updatedAt: serverTimestamp(),
      });

      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), {
          ...cat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const prod of INITIAL_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const banner of INITIAL_BANNERS) {
        await setDoc(doc(db, 'banners', banner.id), {
          ...banner,
          updatedAt: serverTimestamp(),
        });
      }
      for (const zone of INITIAL_SHIPPING_ZONES) {
        await setDoc(doc(db, 'shipping_zones', zone.id), {
          ...zone,
          updatedAt: serverTimestamp(),
        });
      }
      for (const gw of INITIAL_PAYMENT_GATEWAYS) {
        await setDoc(doc(db, 'payment_gateways', gw.id), {
          ...gw,
          updatedAt: serverTimestamp(),
        });
      }
      for (const coup of INITIAL_COUPONS) {
        await setDoc(doc(db, 'coupons', coup.id), {
          ...coup,
          createdAt: serverTimestamp(),
        });
      }
      await logAdminAction('SEED_CATALOG', 'products', 'initial', 'Initialized default Diamond Store catalog in Firestore.');
      notify('Storefront catalog synchronized to database.', 'success');
    } catch (err) {
      console.error('Catalog seed failed:', err);
    }
  }, [firebaseUser, isAdmin, logAdminAction, notify]);

  // Auto-seed on admin sign-in if Firestore catalog is still empty
  useEffect(() => {
    if (firebaseUser && isAdmin && usingFallbackCatalog) {
      void seedDatabaseFromDefaults();
    }
  }, [firebaseUser, isAdmin, usingFallbackCatalog, seedDatabaseFromDefaults]);

  const placeOrder = useCallback(
    async (input: {
      customerName: string;
      customerEmail: string;
      customerPhone: string;
      state: string;
      city: string;
      deliveryAddress: string;
      deliveryInstructions?: string;
      paymentProvider: PaymentProviderId;
      paymentMethod: string;
      paymentProofUrl?: string;
      paymentReference?: string;
      deliveryFee: number;
      codExtraFee?: number;
    }): Promise<Order> => {
      if (cart.length === 0) throw new Error('Your shopping bag is empty.');

      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      let discountAmount = 0;
      if (appliedCoupon) {
        discountAmount =
          appliedCoupon.discountType === 'percentage'
            ? Math.round((subtotal * appliedCoupon.discountValue) / 100)
            : Math.min(subtotal, appliedCoupon.discountValue);
      }
      const taxRate = settings.taxRatePercent || 0;
      const taxable = Math.max(0, subtotal - discountAmount);
      const taxAmount = Math.round((taxable * taxRate) / 100);
      const totalAmount = Math.max(
        0,
        taxable + taxAmount + input.deliveryFee + (input.codExtraFee || 0)
      );

      const orderId = makeDocId('ord');
      const orderNumber = generateOrderNumber();
      const nowStr = new Date().toISOString();
      const paymentStatus: PaymentStatus =
        input.paymentProvider === 'bank_transfer' ? 'awaiting_verification' : 'pending';

      const initialTracking: TrackingEvent[] = [
        {
          status: 'Pending Payment',
          note:
            input.paymentProvider === 'cod'
              ? 'Order placed with Cash on Delivery.'
              : input.paymentProvider === 'bank_transfer'
              ? 'Order placed. Awaiting bank transfer verification.'
              : `Order placed via ${input.paymentMethod}.`,
          timestamp: nowStr,
        },
      ];

      const orderPayload = {
        orderNumber,
        userId: firebaseUser?.uid || 'guest',
        customerName: input.customerName.trim(),
        customerEmail: input.customerEmail.trim().toLowerCase(),
        customerPhone: input.customerPhone.trim(),
        state: input.state,
        city: input.city,
        deliveryAddress: input.deliveryAddress.trim(),
        deliveryInstructions: input.deliveryInstructions?.trim() || '',
        items: cart.map((i) => ({
          productId: i.productId,
          name: i.name,
          sku: i.sku,
          image: i.image,
          price: i.price,
          size: i.size,
          color: i.color,
          quantity: i.quantity,
        })),
        subtotal,
        discountAmount,
        couponCode: appliedCoupon?.code || '',
        deliveryFee: input.deliveryFee + (input.codExtraFee || 0),
        taxAmount,
        totalAmount,
        paymentMethod: input.paymentMethod,
        paymentProvider: input.paymentProvider,
        paymentReference: input.paymentReference || '',
        paymentProofUrl: input.paymentProofUrl || '',
        paymentStatus,
        orderStatus: 'Pending Payment' as OrderStatus,
        trackingNumber: '',
        deliveryCompany: '',
        riderName: '',
        riderPhone: '',
        estimatedDeliveryDate: '',
        trackingHistory: initialTracking,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      try {
        await setDoc(doc(db, 'orders', orderId), orderPayload);

        // Create non-PII verifiable tracking record for /track-order
        const emailHash = await sha256Hex(input.customerEmail);
        const phoneHash = await sha256Hex(normalizePhone(input.customerPhone));
        await setDoc(doc(db, 'order_tracking_public', orderNumber), {
          orderNumber,
          emailHash,
          phoneHash,
          maskedLocation: `${input.city}, ${input.state}`,
          paymentStatus,
          orderStatus: 'Pending Payment',
          trackingNumber: '',
          deliveryCompany: '',
          riderName: '',
          estimatedDeliveryDate: '',
          itemsSummary: orderPayload.items.map((i) => ({
            name: i.name,
            size: i.size,
            color: i.color,
            quantity: i.quantity,
            price: i.price,
          })),
          totalAmount,
          trackingHistory: initialTracking,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // Update stock if signed in (and coupon usage)
        if (firebaseUser) {
          for (const item of cart) {
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await getDoc(pRef).catch(() => null);
            if (pSnap && pSnap.exists()) {
              const pData = pSnap.data() as Product;
              const nextStock = Math.max(0, (pData.stockQuantity || 0) - item.quantity);
              const variantKey = `${item.size}|${item.color}`;
              const nextVariantStock = { ...(pData.variantStock || {}) };
              if (typeof nextVariantStock[variantKey] === 'number') {
                nextVariantStock[variantKey] = Math.max(0, nextVariantStock[variantKey] - item.quantity);
              }
              await updateDoc(pRef, {
                stockQuantity: nextStock,
                soldCount: (pData.soldCount || 0) + item.quantity,
                variantStock: nextVariantStock,
                updatedAt: serverTimestamp(),
              }).catch(() => {});
            }
          }
          if (appliedCoupon) {
            await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
              usedCount: (appliedCoupon.usedCount || 0) + 1,
            }).catch(() => {});
          }
        }

        // Record notification & dispatch email
        const notifId = makeDocId('notif');
        await setDoc(doc(db, 'notifications', notifId), {
          userId: firebaseUser?.uid || 'guest',
          recipientEmail: orderPayload.customerEmail,
          type: 'order_placed',
          subject: `Diamond Store – Order ${orderNumber} Received`,
          body: `Thank you for your order of ₦${totalAmount.toLocaleString()}.`,
          orderNumber,
          createdAt: serverTimestamp(),
        }).catch(() => {});

        void fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: orderPayload.customerEmail,
            subject: `Diamond Store – Order ${orderNumber} Confirmation`,
            title: `Order ${orderNumber} Placed`,
            greeting: `Dear ${orderPayload.customerName},`,
            bodyLines: [
              `Thank you for shopping with Diamond Store. Your order <strong>${orderNumber}</strong> totaling <strong>₦${totalAmount.toLocaleString()}</strong> has been recorded.`,
              `Delivery destination: ${orderPayload.city}, ${orderPayload.state}.`,
            ],
            ctaLabel: 'Track Your Order',
            ctaUrl: `${window.location.origin}/track-order?order=${encodeURIComponent(orderNumber)}`,
          }),
        }).catch(() => {});

        return { id: orderId, ...orderPayload, createdAt: nowStr, updatedAt: nowStr } as Order;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `orders/${orderId}`);
      }
    },
    [cart, appliedCoupon, settings.taxRatePercent, firebaseUser]
  );

  const markOrderPaymentVerified = useCallback(
    async (
      orderId: string,
      orderNumber: string,
      reference: string,
      provider: PaymentProviderId,
      amount: number
    ) => {
      const orderRef = doc(db, 'orders', orderId);
      const snap = await getDoc(orderRef);
      if (!snap.exists()) return;
      const existing = snap.data() as Order;
      const nextHistory: TrackingEvent[] = [
        ...(existing.trackingHistory || []),
        {
          status: 'Payment Confirmed',
          note: `Payment verified via ${provider.toUpperCase()} (Ref: ${reference}).`,
          timestamp: new Date().toISOString(),
        },
      ];
      await updateDoc(orderRef, {
        paymentReference: reference,
        paymentStatus: 'paid',
        orderStatus: 'Payment Confirmed',
        trackingHistory: nextHistory,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, 'payment_transactions', makeDocId('tx')), {
        orderId,
        orderNumber,
        reference,
        provider,
        amount,
        currency: 'NGN',
        status: 'success',
        verifiedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
      }).catch(() => {});
    },
    []
  );

  // Admin Mutations
  const saveProduct = useCallback(
    async (product: Partial<Product> & { id?: string }): Promise<string> => {
      const id = product.id || makeDocId('prod');
      const ref = doc(db, 'products', id);
      const isEdit = Boolean(product.id);
      const payload: any = {
        name: product.name || '',
        slug: product.slug || '',
        sku: product.sku || '',
        description: product.description || '',
        categoryId: product.categoryId || '',
        categoryName: product.categoryName || '',
        categorySlug: product.categorySlug || '',
        categoryGroup: product.categoryGroup || 'mens-clothing',
        regularPrice: Number(product.regularPrice || 0),
        discountPrice: product.discountPrice ? Number(product.discountPrice) : null,
        mainImage: product.mainImage || '',
        images: product.images || [],
        sizes: product.sizes || [],
        colors: product.colors || [],
        variantStock: product.variantStock || {},
        stockQuantity: Number(product.stockQuantity || 0),
        soldCount: Number(product.soldCount || 0),
        ratingAvg: Number(product.ratingAvg || 5),
        reviewCount: Number(product.reviewCount || 0),
        isFeatured: Boolean(product.isFeatured),
        isBestSeller: Boolean(product.isBestSeller),
        isTrending: Boolean(product.isTrending),
        isNewArrival: Boolean(product.isNewArrival),
        status: product.status || 'published',
        updatedAt: serverTimestamp(),
      };
      if (!isEdit) payload.createdAt = serverTimestamp();

      try {
        if (isEdit) {
          await updateDoc(ref, payload);
        } else {
          await setDoc(ref, payload);
        }
        await logAdminAction(
          isEdit ? 'UPDATE_PRODUCT' : 'CREATE_PRODUCT',
          'products',
          id,
          `${isEdit ? 'Updated' : 'Created'} product "${payload.name}" (₦${payload.regularPrice.toLocaleString()})`
        );
        return id;
      } catch (err) {
        handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `products/${id}`);
      }
    },
    [logAdminAction]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      try {
        await deleteDoc(doc(db, 'products', productId));
        await logAdminAction('DELETE_PRODUCT', 'products', productId, `Deleted product ${productId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
      }
    },
    [logAdminAction]
  );

  const saveCategory = useCallback(
    async (cat: Partial<Category> & { id?: string }) => {
      const id = cat.id || makeDocId('cat');
      const ref = doc(db, 'categories', id);
      const isEdit = Boolean(cat.id);
      const payload: any = {
        name: cat.name || '',
        slug: cat.slug || '',
        group: cat.group || 'mens-clothing',
        description: cat.description || '',
        imageUrl: cat.imageUrl || '',
        sortOrder: Number(cat.sortOrder || 99),
        active: cat.active ?? true,
        updatedAt: serverTimestamp(),
      };
      if (!isEdit) payload.createdAt = serverTimestamp();
      try {
        if (isEdit) await updateDoc(ref, payload);
        else await setDoc(ref, payload);
        await logAdminAction(isEdit ? 'UPDATE_CATEGORY' : 'CREATE_CATEGORY', 'categories', id, `Saved category ${payload.name}`);
      } catch (err) {
        handleFirestoreError(err, isEdit ? OperationType.UPDATE : OperationType.CREATE, `categories/${id}`);
      }
    },
    [logAdminAction]
  );

  const deleteCategory = useCallback(
    async (categoryId: string) => {
      try {
        await deleteDoc(doc(db, 'categories', categoryId));
        await logAdminAction('DELETE_CATEGORY', 'categories', categoryId, `Deleted category ${categoryId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${categoryId}`);
      }
    },
    [logAdminAction]
  );

  const saveBanner = useCallback(
    async (banner: Partial<Banner> & { id?: string }) => {
      const id = banner.id || makeDocId('banner');
      const payload = {
        title: banner.title || '',
        subtitle: banner.subtitle || '',
        description: banner.description || '',
        imageUrl: banner.imageUrl || '',
        ctaText: banner.ctaText || 'SHOP NOW',
        ctaLink: banner.ctaLink || '/shop',
        placement: banner.placement || 'hero',
        active: banner.active ?? true,
        sortOrder: Number(banner.sortOrder || 1),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'banners', id), payload, { merge: true });
        await logAdminAction('SAVE_BANNER', 'banners', id, `Updated banner "${payload.title}"`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `banners/${id}`);
      }
    },
    [logAdminAction]
  );

  const deleteBanner = useCallback(
    async (bannerId: string) => {
      try {
        await deleteDoc(doc(db, 'banners', bannerId));
        await logAdminAction('DELETE_BANNER', 'banners', bannerId, `Deleted banner ${bannerId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `banners/${bannerId}`);
      }
    },
    [logAdminAction]
  );

  const saveShippingZone = useCallback(
    async (zone: Partial<ShippingZone> & { id?: string }) => {
      const id = zone.id || makeDocId('zone');
      const payload = {
        state: zone.state || '',
        cities: zone.cities || [],
        fee: Number(zone.fee || 0),
        freeDeliveryThreshold: Number(zone.freeDeliveryThreshold || 0),
        estimatedDays: zone.estimatedDays || '2–4 Business Days',
        deliveryCompany: zone.deliveryCompany || '',
        active: zone.active ?? true,
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(doc(db, 'shipping_zones', id), payload, { merge: true });
        await logAdminAction('SAVE_SHIPPING_ZONE', 'shipping_zones', id, `Updated delivery zone ${payload.state} (₦${payload.fee})`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `shipping_zones/${id}`);
      }
    },
    [logAdminAction]
  );

  const deleteShippingZone = useCallback(
    async (zoneId: string) => {
      try {
        await deleteDoc(doc(db, 'shipping_zones', zoneId));
        await logAdminAction('DELETE_SHIPPING_ZONE', 'shipping_zones', zoneId, `Deleted delivery zone ${zoneId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `shipping_zones/${zoneId}`);
      }
    },
    [logAdminAction]
  );

  const savePaymentGateway = useCallback(
    async (gw: Partial<PaymentGatewayConfig> & { id?: string }) => {
      const id = gw.id || `gw_${gw.provider}`;
      const payload = {
        provider: gw.provider || 'paystack',
        displayName: gw.displayName || '',
        publicKey: gw.publicKey || '',
        mode: gw.mode || 'test',
        active: Boolean(gw.active),
        isDefault: Boolean(gw.isDefault),
        hasSecretConfigured: Boolean(gw.hasSecretConfigured),
        bankName: gw.bankName || '',
        accountName: gw.accountName || '',
        accountNumber: gw.accountNumber || '',
        paymentInstructions: gw.paymentInstructions || '',
        codEligibleStates: gw.codEligibleStates || [],
        codExtraFee: Number(gw.codExtraFee || 0),
        updatedAt: serverTimestamp(),
      };
      try {
        if (payload.isDefault) {
          for (const other of paymentGateways) {
            if (other.id !== id && other.isDefault) {
              await setDoc(
                doc(db, 'payment_gateways', other.id),
                { ...other, isDefault: false, updatedAt: serverTimestamp() },
                { merge: true }
              );
            }
          }
        }
        await setDoc(doc(db, 'payment_gateways', id), payload, { merge: true });
        await logAdminAction(
          'UPDATE_PAYMENT_GATEWAY',
          'payment_gateways',
          id,
          `${payload.active ? 'Activated' : 'Updated'} ${payload.displayName} (${payload.mode})`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `payment_gateways/${id}`);
      }
    },
    [paymentGateways, logAdminAction]
  );

  const deletePaymentGateway = useCallback(
    async (gatewayId: string) => {
      try {
        await deleteDoc(doc(db, 'payment_gateways', gatewayId));
        await logAdminAction('DELETE_PAYMENT_GATEWAY', 'payment_gateways', gatewayId, `Removed gateway config ${gatewayId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `payment_gateways/${gatewayId}`);
      }
    },
    [logAdminAction]
  );

  const saveCoupon = useCallback(
    async (coupon: Partial<Coupon> & { id?: string }) => {
      const id = coupon.id || makeDocId('coup');
      const isEdit = Boolean(coupon.id);
      const payload: any = {
        code: (coupon.code || '').toUpperCase().trim(),
        discountType: coupon.discountType || 'percentage',
        discountValue: Number(coupon.discountValue || 0),
        minOrderValue: Number(coupon.minOrderValue || 0),
        maxUses: Number(coupon.maxUses || 100),
        usedCount: Number(coupon.usedCount || 0),
        expiresAt: coupon.expiresAt || '',
        applicableCategorySlugs: coupon.applicableCategorySlugs || [],
        active: coupon.active ?? true,
      };
      if (!isEdit) payload.createdAt = serverTimestamp();
      try {
        if (isEdit) await updateDoc(doc(db, 'coupons', id), payload);
        else await setDoc(doc(db, 'coupons', id), payload);
        await logAdminAction('SAVE_COUPON', 'coupons', id, `Saved coupon ${payload.code}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `coupons/${id}`);
      }
    },
    [logAdminAction]
  );

  const deleteCoupon = useCallback(
    async (couponId: string) => {
      try {
        await deleteDoc(doc(db, 'coupons', couponId));
        await logAdminAction('DELETE_COUPON', 'coupons', couponId, `Deleted coupon ${couponId}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `coupons/${couponId}`);
      }
    },
    [logAdminAction]
  );

  const saveStoreSettings = useCallback(
    async (patch: Partial<StoreSettings>) => {
      try {
        const merged = {
          ...settings,
          ...patch,
          updatedAt: serverTimestamp(),
        };
        delete (merged as any).id;
        await setDoc(doc(db, 'store_settings', 'main'), merged, { merge: true });
        await logAdminAction('UPDATE_STORE_SETTINGS', 'store_settings', 'main', 'Updated Store Settings');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'store_settings/main');
      }
    },
    [settings, logAdminAction]
  );

  const updateOrderFulfillment = useCallback(
    async (
      order: Order,
      updates: {
        orderStatus?: OrderStatus;
        paymentStatus?: PaymentStatus;
        trackingNumber?: string;
        deliveryCompany?: string;
        riderName?: string;
        riderPhone?: string;
        estimatedDeliveryDate?: string;
        note?: string;
      }
    ) => {
      const nextStatus = updates.orderStatus || order.orderStatus;
      const nextPaymentStatus = updates.paymentStatus || order.paymentStatus;
      const event: TrackingEvent = {
        status: nextStatus,
        note: updates.note || `Status updated to ${nextStatus}.`,
        timestamp: new Date().toISOString(),
        updatedBy: activeEmail || 'Admin',
      };
      const nextHistory = [...(order.trackingHistory || []), event].slice(-30);

      try {
        await updateDoc(doc(db, 'orders', order.id), {
          orderStatus: nextStatus,
          paymentStatus: nextPaymentStatus,
          trackingNumber: updates.trackingNumber ?? order.trackingNumber ?? '',
          deliveryCompany: updates.deliveryCompany ?? order.deliveryCompany ?? '',
          riderName: updates.riderName ?? order.riderName ?? '',
          riderPhone: updates.riderPhone ?? order.riderPhone ?? '',
          estimatedDeliveryDate: updates.estimatedDeliveryDate ?? order.estimatedDeliveryDate ?? '',
          trackingHistory: nextHistory,
          updatedAt: serverTimestamp(),
        });

        await updateDoc(doc(db, 'order_tracking_public', order.orderNumber), {
          orderStatus: nextStatus,
          paymentStatus: nextPaymentStatus,
          trackingNumber: updates.trackingNumber ?? order.trackingNumber ?? '',
          deliveryCompany: updates.deliveryCompany ?? order.deliveryCompany ?? '',
          riderName: updates.riderName ?? order.riderName ?? '',
          estimatedDeliveryDate: updates.estimatedDeliveryDate ?? order.estimatedDeliveryDate ?? '',
          trackingHistory: nextHistory,
          updatedAt: serverTimestamp(),
        }).catch(() => {});

        // If payment confirmed manually (e.g. bank transfer), record verified transaction
        if (nextPaymentStatus === 'paid' && order.paymentStatus !== 'paid') {
          await setDoc(doc(db, 'payment_transactions', makeDocId('tx')), {
            orderId: order.id,
            orderNumber: order.orderNumber,
            reference: order.paymentReference || `BANK-${order.orderNumber}`,
            provider: order.paymentProvider,
            amount: order.totalAmount,
            currency: 'NGN',
            status: 'success',
            verifiedAt: serverTimestamp(),
            createdAt: serverTimestamp(),
          }).catch(() => {});
        }

        // Restore stock if cancelled/refunded and setting enabled
        if (
          settings.autoRestoreStockOnCancel &&
          (nextStatus === 'Cancelled' || nextStatus === 'Refunded') &&
          order.orderStatus !== 'Cancelled' &&
          order.orderStatus !== 'Refunded'
        ) {
          for (const item of order.items) {
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await getDoc(pRef).catch(() => null);
            if (pSnap && pSnap.exists()) {
              const pData = pSnap.data() as Product;
              await updateDoc(pRef, {
                stockQuantity: (pData.stockQuantity || 0) + item.quantity,
                soldCount: Math.max(0, (pData.soldCount || 0) - item.quantity),
                updatedAt: serverTimestamp(),
              }).catch(() => {});
            }
          }
        }

        await logAdminAction(
          'UPDATE_ORDER',
          'orders',
          order.id,
          `Order ${order.orderNumber} -> ${nextStatus} (Payment: ${nextPaymentStatus})`
        );

        void fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: order.customerEmail,
            subject: `Diamond Store – Order ${order.orderNumber} Update: ${nextStatus}`,
            title: `Order Update: ${nextStatus}`,
            greeting: `Dear ${order.customerName},`,
            bodyLines: [
              `Your order <strong>${order.orderNumber}</strong> status is now <strong>${nextStatus}</strong>.`,
              updates.note ? `Note: ${updates.note}` : '',
              updates.trackingNumber ? `Tracking Number: ${updates.trackingNumber} (${updates.deliveryCompany || ''})` : '',
            ].filter(Boolean),
            ctaLabel: 'View Live Tracking',
            ctaUrl: `${window.location.origin}/track-order?order=${encodeURIComponent(order.orderNumber)}`,
          }),
        }).catch(() => {});
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
      }
    },
    [activeEmail, settings.autoRestoreStockOnCancel, logAdminAction]
  );

  const publishedProducts = useMemo(
    () => products.filter((p) => p.status === 'published'),
    [products]
  );

  const activePaymentGateways = useMemo(
    () => paymentGateways.filter((g) => g.active),
    [paymentGateways]
  );

  return (
    <StoreContext.Provider
      value={{
        settings,
        categories,
        products,
        publishedProducts,
        banners,
        shippingZones,
        paymentGateways,
        activePaymentGateways,
        coupons,
        reviews,
        cart,
        wishlist,
        appliedCoupon,
        cartOpen,
        setCartOpen,
        loadingCatalog,
        usingFallbackCatalog,
        toasts,
        notify,
        addToCart,
        removeFromCart,
        updateCartItem,
        clearCart,
        toggleWishlist,
        applyCouponCode,
        removeCoupon,
        placeOrder,
        markOrderPaymentVerified,
        seedDatabaseFromDefaults,
        logAdminAction,
        saveProduct,
        deleteProduct,
        saveCategory,
        deleteCategory,
        saveBanner,
        deleteBanner,
        saveShippingZone,
        deleteShippingZone,
        savePaymentGateway,
        deletePaymentGateway,
        saveCoupon,
        deleteCoupon,
        saveStoreSettings,
        updateOrderFulfillment,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
