import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingBag } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { formatNaira } from '../../lib/format';
import { Product } from '../../types/store';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart, toggleWishlist, wishlist, settings } = useStore();
  const [imgError, setImgError] = useState(false);

  const isWishlisted = wishlist.includes(product.id);
  const hasDiscount =
    typeof product.discountPrice === 'number' &&
    product.discountPrice > 0 &&
    product.discountPrice < product.regularPrice;
  const activePrice = hasDiscount ? (product.discountPrice as number) : product.regularPrice;
  const defaultSize = product.sizes?.[0] || 'One Size';
  const defaultColor = product.colors?.[0] || 'Standard';

  return (
    <article className="group flex flex-col bg-white border border-neutral-200/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-[#F5F5F5] overflow-hidden">
        <Link to={`/product/${product.slug}`} className="block w-full h-full">
          {!imgError && product.mainImage ? (
            <img
              src={product.mainImage}
              alt={product.name}
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-100 text-neutral-500 p-4 text-center">
              <ShoppingBag className="w-8 h-8 mb-2 text-neutral-400" />
              <span className="text-xs font-medium">{product.name}</span>
            </div>
          )}
        </Link>

        {/* Wishlist toggle button */}
        <button
          type="button"
          onClick={() => toggleWishlist(product.id)}
          aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
          className="absolute top-3 right-3 p-2 bg-white/90 text-[#111111] hover:text-[#9E7C16] transition-colors"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-[#D4AF37] text-[#D4AF37]' : ''}`} />
        </button>

        {/* Subtle single text flag when out of stock or discounted */}
        {product.stockQuantity <= 0 ? (
          <div className="absolute bottom-3 left-3 bg-[#111111] text-white text-[11px] px-2.5 py-1 tracking-wider uppercase">
            Sold Out
          </div>
        ) : hasDiscount ? (
          <div className="absolute bottom-3 left-3 bg-[#111111] text-[#D4AF37] text-[11px] px-2.5 py-1 tracking-wider uppercase font-medium">
            -{Math.round(((product.regularPrice - activePrice) / product.regularPrice) * 100)}%
          </div>
        ) : null}
      </div>

      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] text-neutral-500 mb-1 truncate">
            {product.categoryName || product.categoryGroup.replace('-', ' ')}
          </p>
          <Link
            to={`/product/${product.slug}`}
            className="text-sm sm:text-[15px] font-semibold text-[#111111] hover:text-[#9E7C16] transition-colors line-clamp-2 leading-snug"
          >
            {product.name}
          </Link>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] font-semibold tabular-nums text-[#111111]">
              {formatNaira(activePrice, settings.currencySymbol)}
            </span>
            {hasDiscount && (
              <span className="text-xs tabular-nums text-neutral-400 line-through">
                {formatNaira(product.regularPrice, settings.currencySymbol)}
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={product.stockQuantity <= 0}
            onClick={() => addToCart(product, defaultSize, defaultColor, 1)}
            className="px-3 py-1.5 bg-[#111111] text-white text-[11px] uppercase tracking-wider hover:bg-[#9E7C16] transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            Add to Bag
          </button>
        </div>
      </div>
    </article>
  );
}
