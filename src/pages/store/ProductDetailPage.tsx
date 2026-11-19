import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Check, Heart, Maximize2, Minus, Plus, Shield, Star, Truck, X } from 'lucide-react';
import { ProductCard } from '../../components/store/ProductCard';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { formatNaira, formatTimestamp, makeDocId } from '../../lib/format';

export function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { products, reviews, addToCart, toggleWishlist, wishlist, settings, notify } = useStore();
  const { firebaseUser, isSignedIn, activeName } = useAuth();

  const product = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug),
    [products, slug]
  );

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoomOpen, setZoomOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [qty, setQty] = useState(1);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  if (!product) {
    return (
      <main className="max-w-3xl mx-auto px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-[#111111] mb-3">Product Not Found</h1>
        <p className="text-sm text-neutral-600 mb-6">
          This piece may have been archived or moved to a seasonal collection.
        </p>
        <Link
          to="/shop"
          className="inline-block px-6 py-3 bg-[#111111] text-white text-xs uppercase tracking-widest"
        >
          Return to Catalogue
        </Link>
      </main>
    );
  }

  const gallery = Array.from(new Set([product.mainImage, ...(product.images || [])].filter(Boolean)));
  const activeImg = selectedImage || gallery[0];
  const sizes = product.sizes?.length ? product.sizes : ['One Size'];
  const colors = product.colors?.length ? product.colors : ['Standard'];
  const currentSize = selectedSize || sizes[0];
  const currentColor = selectedColor || colors[0];

  const variantKey = `${currentSize}|${currentColor}`;
  const availableStock =
    product.variantStock && typeof product.variantStock[variantKey] === 'number'
      ? product.variantStock[variantKey]
      : product.stockQuantity;

  const hasDiscount =
    typeof product.discountPrice === 'number' &&
    product.discountPrice > 0 &&
    product.discountPrice < product.regularPrice;
  const activePrice = hasDiscount ? (product.discountPrice as number) : product.regularPrice;
  const isWishlisted = wishlist.includes(product.id);

  const productReviews = reviews.filter((r) => r.productId === product.id && r.approved);
  const related = products
    .filter((p) => p.id !== product.id && p.status === 'published' && p.categoryGroup === product.categoryGroup)
    .slice(0, 4);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) {
      notify('Please sign in with Google or an account to submit a verified review.', 'error');
      return;
    }
    if (reviewComment.trim().length < 3) {
      notify('Please share a brief review.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      await setDoc(doc(db, 'reviews', makeDocId('rev')), {
        productId: product.id,
        userId: firebaseUser.uid,
        authorName: activeName || 'Verified Client',
        rating: reviewRating,
        comment: reviewComment.trim(),
        approved: true,
        createdAt: serverTimestamp(),
      });
      setReviewComment('');
      notify('Thank you! Your review has been published.', 'success');
    } catch {
      notify('Unable to submit review right now.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-500 mb-8 flex items-center gap-2">
        <Link to="/" className="hover:text-[#111111]">Home</Link>
        <span>/</span>
        <Link to="/shop" className="hover:text-[#111111]">Shop</Link>
        <span>/</span>
        <span className="text-[#111111] truncate">{product.name}</span>
      </nav>

      {/* Contiguous Purchase Module */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Left: Zoomable Gallery */}
        <div className="lg:col-span-7 space-y-4">
          <div className="relative aspect-[4/3] bg-[#F5F5F5] border border-neutral-200 overflow-hidden group">
            <img
              src={activeImg}
              alt={product.name}
              referrerPolicy="no-referrer"
              onClick={() => setZoomOpen(true)}
              className="w-full h-full object-cover cursor-zoom-in transition-transform duration-500 group-hover:scale-105"
            />
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label="Enlarge product image"
              className="absolute bottom-4 right-4 p-2.5 bg-white/90 text-[#111111] border border-neutral-200 hover:bg-[#111111] hover:text-white transition-colors"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>

          {gallery.length > 1 && (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {gallery.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  className={`aspect-[4/3] bg-[#F5F5F5] border overflow-hidden ${
                    activeImg === img ? 'border-[#111111] ring-1 ring-[#111111]' : 'border-neutral-200'
                  }`}
                >
                  <img
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details & Purchase Controls */}
        <div className="lg:col-span-5 lg:sticky lg:top-24 border border-neutral-200 p-6 sm:p-8 bg-white space-y-6">
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-neutral-500 mb-2">
              <span className="uppercase tracking-[0.14em]">{product.categoryName || product.categoryGroup}</span>
              <span className="font-mono">SKU: {product.sku}</span>
            </div>
            <h1 className="font-display text-3xl font-semibold text-[#111111] leading-tight">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-1 text-[#D4AF37]">
                <Star className="w-4 h-4 fill-[#D4AF37]" />
                <span className="text-xs font-semibold text-[#111111] tabular-nums">
                  {(product.ratingAvg || 4.9).toFixed(1)}
                </span>
              </div>
              <span className="text-xs text-neutral-500">
                ({productReviews.length || product.reviewCount || 0} reviews)
              </span>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3 pb-5 border-b border-neutral-200">
            <span className="text-2xl font-semibold tabular-nums text-[#111111]">
              {formatNaira(activePrice, settings.currencySymbol)}
            </span>
            {hasDiscount && (
              <span className="text-base tabular-nums text-neutral-400 line-through">
                {formatNaira(product.regularPrice, settings.currencySymbol)}
              </span>
            )}
          </div>

          {/* Size Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-neutral-700">Size</span>
              <span className="text-neutral-500">{currentSize}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`px-4 py-2 text-xs font-medium border transition-colors ${
                    currentSize === s
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'border-neutral-300 text-neutral-800 hover:border-[#111111]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-neutral-700">Colour</span>
              <span className="text-neutral-500">{currentColor}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedColor(c)}
                  className={`px-4 py-2 text-xs font-medium border transition-colors ${
                    currentColor === c
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'border-neutral-300 text-neutral-800 hover:border-[#111111]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Availability */}
          <div className="text-xs flex items-center gap-2">
            {availableStock > 0 ? (
              <>
                <Check className="w-4 h-4 text-emerald-700" />
                <span className="text-emerald-800 font-medium tabular-nums">
                  In stock ({availableStock} available for this variation)
                </span>
              </>
            ) : (
              <span className="text-red-700 font-medium">Out of stock for this selection</span>
            )}
          </div>

          {/* Quantity + Add to Bag */}
          <div className="flex items-stretch gap-3">
            <div className="flex items-center border border-neutral-300">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="px-3 py-3 text-neutral-700 hover:text-[#111111]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-sm font-mono tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(Math.max(1, availableStock), q + 1))}
                className="px-3 py-3 text-neutral-700 hover:text-[#111111]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={availableStock <= 0}
              onClick={() => addToCart(product, currentSize, currentColor, qty)}
              className="flex-1 bg-[#111111] text-white text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#9E7C16] transition-colors disabled:opacity-40"
            >
              {availableStock > 0 ? 'Add to Bag' : 'Out of Stock'}
            </button>

            <button
              type="button"
              onClick={() => toggleWishlist(product.id)}
              aria-label="Save to wishlist"
              className="px-4 border border-neutral-300 hover:border-[#111111] transition-colors"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#D4AF37] text-[#D4AF37]' : 'text-[#111111]'}`} />
            </button>
          </div>

          {/* Description & Guarantees */}
          <div className="pt-4 border-t border-neutral-200 space-y-4">
            <p className="text-sm text-neutral-700 leading-relaxed">{product.description}</p>
            <div className="grid grid-cols-1 gap-2 text-xs text-neutral-600 pt-2">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#9E7C16]" />
                <span>Complimentary delivery on orders above {formatNaira(settings.freeDeliveryThreshold || 150000)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#9E7C16]" />
                <span>Authentic Diamond Store quality with 7-day exchange support</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section className="mt-16 pt-12 border-t border-neutral-200 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">Client Feedback</p>
          <h2 className="font-display text-2xl font-semibold text-[#111111] mb-4">Customer Reviews</h2>
          <form onSubmit={handleReviewSubmit} className="border border-neutral-200 p-5 space-y-4 bg-[#F5F5F5]">
            <h3 className="text-sm font-semibold text-[#111111]">Leave a Review</h3>
            <div>
              <label className="block text-xs text-neutral-600 mb-1">Rating</label>
              <select
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm"
              >
                <option value={5}>5 Stars — Exceptional</option>
                <option value={4}>4 Stars — Very Good</option>
                <option value={3}>3 Stars — Good</option>
                <option value={2}>2 Stars — Fair</option>
                <option value={1}>1 Star — Needs Improvement</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-600 mb-1">Your Review</label>
              <textarea
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Share your fit, fabric, and delivery experience..."
                className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={submittingReview}
              className="px-5 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest hover:bg-[#222222] disabled:opacity-50"
            >
              {isSignedIn ? 'Submit Review' : 'Sign In to Review'}
            </button>
          </form>
        </div>

        <div className="lg:col-span-7 space-y-4">
          {productReviews.length === 0 ? (
            <div className="border border-neutral-200 p-8 text-center text-sm text-neutral-500">
              No reviews submitted for this piece yet. Be the first verified client to review it.
            </div>
          ) : (
            productReviews.map((rev) => (
              <div key={rev.id} className="border border-neutral-200 p-5 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-[#111111]">{rev.authorName}</span>
                  <span className="text-xs text-neutral-400">{formatTimestamp(rev.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1 text-[#D4AF37] mb-2">
                  {Array.from({ length: rev.rating }).map((_, idx) => (
                    <Star key={idx} className="w-3.5 h-3.5 fill-[#D4AF37]" />
                  ))}
                </div>
                <p className="text-sm text-neutral-700 leading-relaxed">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Related Products */}
      {related.length > 0 && (
        <section className="mt-16 pt-12 border-t border-neutral-200">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111] mb-8">
            Complementary Pieces
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Lightbox Image Enlargement Modal */}
      {zoomOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setZoomOpen(false)}>
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            className="absolute top-6 right-6 p-2 bg-white text-[#111111]"
          >
            <X className="w-5 h-5" />
          </button>
          <img
            src={activeImg}
            alt={product.name}
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[88vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}
