import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { ProductCard } from '../../components/store/ProductCard';
import { useStore } from '../../context/StoreContext';
import { formatNaira } from '../../lib/format';

interface ShopPageProps {
  presetGroup?: 'mens-clothing' | 'shoes' | 'mens-accessories';
  presetCollection?: 'new-arrivals' | 'best-sellers';
}

export function ShopPage({ presetGroup, presetCollection }: ShopPageProps) {
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { publishedProducts, categories, settings } = useStore();

  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [selectedGroup, setSelectedGroup] = useState<string>(presetGroup || 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>(slug || 'all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [maxPrice, setMaxPrice] = useState<number>(300000);
  const [sortBy, setSortBy] = useState<'newest' | 'popular' | 'price-asc' | 'price-desc'>('newest');
  const [mobileFilters, setMobileFilters] = useState(false);

  useEffect(() => {
    setSelectedGroup(presetGroup || 'all');
    setSelectedCategory(slug || 'all');
  }, [presetGroup, slug]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQueryText(q);
  }, [searchParams]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    publishedProducts.forEach((p) => p.sizes?.forEach((s) => set.add(s)));
    return Array.from(set);
  }, [publishedProducts]);

  const allColors = useMemo(() => {
    const set = new Set<string>();
    publishedProducts.forEach((p) => p.colors?.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [publishedProducts]);

  const filtered = useMemo(() => {
    const q = queryText.trim().toLowerCase();
    return publishedProducts
      .filter((p) => {
        if (presetCollection === 'new-arrivals' && !p.isNewArrival) return false;
        if (presetCollection === 'best-sellers' && !p.isBestSeller) return false;
        if (selectedGroup !== 'all' && p.categoryGroup !== selectedGroup) return false;
        if (selectedCategory !== 'all' && p.categorySlug !== selectedCategory) return false;
        if (selectedSize !== 'all' && !(p.sizes || []).includes(selectedSize)) return false;
        if (selectedColor !== 'all' && !(p.colors || []).includes(selectedColor)) return false;
        const price = p.discountPrice && p.discountPrice < p.regularPrice ? p.discountPrice : p.regularPrice;
        if (price > maxPrice) return false;
        if (q) {
          const hay = `${p.name} ${p.sku} ${p.categoryName || ''} ${p.description || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const pa = a.discountPrice && a.discountPrice < a.regularPrice ? a.discountPrice : a.regularPrice;
        const pb = b.discountPrice && b.discountPrice < b.regularPrice ? b.discountPrice : b.regularPrice;
        if (sortBy === 'price-asc') return pa - pb;
        if (sortBy === 'price-desc') return pb - pa;
        if (sortBy === 'popular') return (b.soldCount || 0) - (a.soldCount || 0);
        return 0;
      });
  }, [
    publishedProducts,
    presetCollection,
    selectedGroup,
    selectedCategory,
    selectedSize,
    selectedColor,
    maxPrice,
    queryText,
    sortBy,
  ]);

  const pageTitle = useMemo(() => {
    if (slug) {
      const cat = categories.find((c) => c.slug === slug);
      return cat ? cat.name : 'Collection';
    }
    if (presetCollection === 'new-arrivals') return 'New Arrivals';
    if (presetCollection === 'best-sellers') return 'Best Sellers';
    if (presetGroup === 'mens-clothing') return "Men's Clothing";
    if (presetGroup === 'shoes') return 'Luxury Shoes';
    if (presetGroup === 'mens-accessories') return "Men's Accessories";
    return 'Shop All Collections';
  }, [slug, categories, presetCollection, presetGroup]);

  const clearAllFilters = () => {
    setQueryText('');
    setSearchParams({});
    setSelectedGroup(presetGroup || 'all');
    setSelectedCategory(slug || 'all');
    setSelectedSize('all');
    setSelectedColor('all');
    setMaxPrice(300000);
  };

  const visibleCategories = useMemo(() => {
    if (selectedGroup === 'all') return categories.filter((c) => c.active);
    return categories.filter((c) => c.active && c.group === selectedGroup);
  }, [categories, selectedGroup]);

  return (
    <main className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="border-b border-neutral-200 pb-6 mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">
            {settings.storeName}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
            {pageTitle}
          </h1>
          <p className="text-xs text-neutral-500 mt-1 tabular-nums">
            Showing {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="Search products or SKU..."
              className="w-full pl-9 pr-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-[#111111]"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            aria-label="Sort products"
            className="px-3 py-2 border border-neutral-300 text-sm bg-white focus:outline-none focus:border-[#111111]"
          >
            <option value="newest">Sort: Newest</option>
            <option value="popular">Sort: Popularity</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>

          <button
            type="button"
            onClick={() => setMobileFilters((v) => !v)}
            className="lg:hidden px-3 py-2 border border-neutral-300 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" /> Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <aside
          className={`${
            mobileFilters ? 'block' : 'hidden'
          } lg:block lg:col-span-3 space-y-6 border border-neutral-200 p-5 h-fit bg-white`}
        >
          <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
            <h2 className="text-xs uppercase tracking-[0.16em] font-semibold text-[#111111]">
              Refine Selection
            </h2>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-neutral-500 hover:text-[#111111] underline"
            >
              Reset
            </button>
          </div>

          {/* Department */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Department
            </label>
            <select
              value={selectedGroup}
              onChange={(e) => {
                setSelectedGroup(e.target.value);
                setSelectedCategory('all');
              }}
              className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Departments</option>
              <option value="mens-clothing">Men&apos;s Clothing</option>
              <option value="shoes">Shoes</option>
              <option value="mens-accessories">Men&apos;s Accessories</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Categories</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Max Price */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold uppercase tracking-wider text-neutral-600">Max Price</span>
              <span className="font-mono tabular-nums font-semibold text-[#111111]">
                {formatNaira(maxPrice, settings.currencySymbol)}
              </span>
            </div>
            <input
              type="range"
              min={15000}
              max={350000}
              step={5000}
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full accent-[#111111]"
            />
          </div>

          {/* Size */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Size
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSize('all')}
                className={`px-2.5 py-1 text-xs border ${
                  selectedSize === 'all'
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'border-neutral-300 text-neutral-700'
                }`}
              >
                All
              </button>
              {allSizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSize(s)}
                  className={`px-2.5 py-1 text-xs border ${
                    selectedSize === s
                      ? 'bg-[#111111] text-white border-[#111111]'
                      : 'border-neutral-300 text-neutral-700'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Colour */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-2">
              Colour
            </label>
            <select
              value={selectedColor}
              onChange={(e) => setSelectedColor(e.target.value)}
              className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="all">All Colours</option>
              {allColors.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>
          </div>
        </aside>

        {/* Product Grid */}
        <section className="lg:col-span-9">
          {filtered.length === 0 ? (
            <div className="border border-neutral-200 p-12 text-center bg-[#F5F5F5]">
              <X className="w-8 h-8 text-neutral-400 mx-auto mb-3" />
              <h2 className="font-display text-2xl font-semibold text-[#111111] mb-2">
                No matching items found
              </h2>
              <p className="text-sm text-neutral-600 mb-6">
                Try adjusting your price range, size, or search query.
              </p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="px-6 py-2.5 bg-[#111111] text-white text-xs uppercase tracking-widest"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
