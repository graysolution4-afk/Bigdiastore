import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles, Truck, Award } from 'lucide-react';
import { ProductCard } from '../../components/store/ProductCard';
import { useStore } from '../../context/StoreContext';
import { IMG_HERO, IMG_KAFTAN, IMG_SNEAKERS, IMG_WATCH, IMG_LOAFERS, IMG_POLO } from '../../lib/seedData';

type ShowcaseTab = 'featured' | 'new' | 'trending' | 'bestsellers' | 'discounts';

export function HomePage() {
  const { publishedProducts, banners, categories, settings } = useStore();
  const [activeTab, setActiveTab] = useState<ShowcaseTab>('featured');

  const heroBanner = useMemo(
    () => banners.find((b) => b.placement === 'hero' && b.active) || banners[0],
    [banners]
  );

  const midBanner = useMemo(
    () => banners.find((b) => b.placement === 'promo_mid' && b.active),
    [banners]
  );

  const showcaseProducts = useMemo(() => {
    if (activeTab === 'featured') return publishedProducts.filter((p) => p.isFeatured);
    if (activeTab === 'new') return publishedProducts.filter((p) => p.isNewArrival);
    if (activeTab === 'trending') return publishedProducts.filter((p) => p.isTrending);
    if (activeTab === 'bestsellers') return publishedProducts.filter((p) => p.isBestSeller);
    return publishedProducts.filter(
      (p) => typeof p.discountPrice === 'number' && p.discountPrice > 0 && p.discountPrice < p.regularPrice
    );
  }, [publishedProducts, activeTab]);

  const displayedShowcase = (showcaseProducts.length > 0 ? showcaseProducts : publishedProducts).slice(0, 8);

  const clothingCats = categories.filter((c) => c.group === 'mens-clothing' && c.active).slice(0, 6);
  const shoeCats = categories.filter((c) => c.group === 'shoes' && c.active).slice(0, 5);
  const accCats = categories.filter((c) => c.group === 'mens-accessories' && c.active).slice(0, 6);

  return (
    <main>
      {/* 1. Editorial Hero Section */}
      <section className="relative bg-[#111111] text-white overflow-hidden">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 items-stretch min-h-[540px] lg:min-h-[620px]">
          <div className="lg:col-span-6 px-6 sm:px-10 lg:px-14 py-14 lg:py-20 flex flex-col justify-center">
            <p className="text-xs uppercase tracking-[0.22em] text-[#D4AF37] mb-4">
              {heroBanner?.subtitle || `${settings.storeName} · LAGOS & NATIONWIDE`}
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-semibold leading-[1.06] text-white text-balance mb-5">
              {heroBanner?.title || settings.tagline}
            </h1>
            <p className="text-neutral-300 text-base sm:text-lg leading-relaxed max-w-xl mb-8">
              {heroBanner?.description ||
                'Discover premium clothing, stylish footwear and accessories designed to elevate your everyday look.'}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to={heroBanner?.ctaLink || '/shop'}
                className="px-7 py-3.5 bg-[#D4AF37] text-[#111111] text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#e3be47] transition-colors whitespace-nowrap shrink-0"
              >
                {heroBanner?.ctaText || 'SHOP NOW'}
              </Link>
              <Link
                to="/mens-clothing"
                className="px-7 py-3.5 border border-white/40 text-white text-xs font-semibold uppercase tracking-[0.16em] hover:border-[#D4AF37] hover:text-[#D4AF37] transition-colors whitespace-nowrap shrink-0"
              >
                EXPLORE COLLECTION
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 relative min-h-[340px] lg:min-h-full">
            <img
              src={heroBanner?.imageUrl || IMG_HERO}
              alt={heroBanner?.title || 'Diamond Store Luxury Menswear'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-top"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/20 to-transparent hidden lg:block" />
          </div>
        </div>
      </section>

      {/* 2. Shop by Category */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">Curated Departments</p>
            <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
              Shop by Category
            </h2>
          </div>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-[#111111] hover:text-[#9E7C16] font-semibold"
          >
            View All Categories <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Men's Clothing */}
          <div className="group border border-neutral-200 bg-white flex flex-col">
            <Link to="/mens-clothing" className="relative aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
              <img
                src={IMG_KAFTAN}
                alt="Men's Clothing"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#D4AF37]">Apparel</p>
                <h3 className="font-display text-2xl font-semibold mt-1">Men&apos;s Clothing</h3>
              </div>
            </Link>
            <div className="p-5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-neutral-600">
              {clothingCats.map((c, idx) => (
                <React.Fragment key={c.id}>
                  <Link to={`/category/${c.slug}`} className="hover:text-[#111111] hover:underline">
                    {c.name}
                  </Link>
                  {idx < clothingCats.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Shoes */}
          <div className="group border border-neutral-200 bg-white flex flex-col">
            <Link to="/shoes" className="relative aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
              <img
                src={IMG_SNEAKERS}
                alt="Luxury Footwear"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#D4AF37]">Footwear</p>
                <h3 className="font-display text-2xl font-semibold mt-1">Shoes</h3>
              </div>
            </Link>
            <div className="p-5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-neutral-600">
              {shoeCats.map((c, idx) => (
                <React.Fragment key={c.id}>
                  <Link to={`/category/${c.slug}`} className="hover:text-[#111111] hover:underline">
                    {c.name}
                  </Link>
                  {idx < shoeCats.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Men's Accessories */}
          <div className="group border border-neutral-200 bg-white flex flex-col">
            <Link to="/accessories" className="relative aspect-[4/3] overflow-hidden bg-[#F5F5F5]">
              <img
                src={IMG_WATCH}
                alt="Men's Accessories"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 text-white">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#D4AF37]">Details</p>
                <h3 className="font-display text-2xl font-semibold mt-1">Men&apos;s Accessories</h3>
              </div>
            </Link>
            <div className="p-5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-neutral-600">
              {accCats.map((c, idx) => (
                <React.Fragment key={c.id}>
                  <Link to={`/category/${c.slug}`} className="hover:text-[#111111] hover:underline">
                    {c.name}
                  </Link>
                  {idx < accCats.length - 1 && <span aria-hidden="true">·</span>}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Curated Collections: Featured, New Arrivals, Trending, Best Sellers, Discounts */}
      <section className="bg-[#F5F5F5] py-16 border-y border-neutral-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">The Edit</p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold text-[#111111]">
                Signature Selections
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white p-1 border border-neutral-200">
              {(
                [
                  { id: 'featured', label: 'Featured' },
                  { id: 'new', label: 'New Arrivals' },
                  { id: 'trending', label: 'Trending Now' },
                  { id: 'bestsellers', label: 'Best Sellers' },
                  { id: 'discounts', label: 'Exclusive Discounts' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-[#111111] text-white'
                      : 'text-neutral-600 hover:text-[#111111]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {displayedShowcase.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/shop"
              className="inline-block px-8 py-3.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[#222222] transition-colors"
            >
              Browse Full Catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* 4. Editorial Promotional Banner */}
      {midBanner && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 bg-[#111111] text-white items-stretch">
            <div className="lg:col-span-6 p-8 sm:p-12 lg:p-16 flex flex-col justify-center">
              <p className="text-xs uppercase tracking-[0.2em] text-[#D4AF37] mb-3">
                {midBanner.subtitle || 'SEASONAL CAMPAIGN'}
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold mb-4 text-balance">
                {midBanner.title}
              </h2>
              <p className="text-sm sm:text-base text-neutral-300 leading-relaxed mb-8 max-w-lg">
                {midBanner.description}
              </p>
              <div>
                <Link
                  to={midBanner.ctaLink || '/mens-clothing'}
                  className="inline-block px-7 py-3 bg-[#D4AF37] text-[#111111] text-xs font-semibold uppercase tracking-[0.15em] hover:bg-[#e3be47]"
                >
                  {midBanner.ctaText || 'Explore Collection'}
                </Link>
              </div>
            </div>
            <div className="lg:col-span-6 min-h-[300px]">
              <img
                src={midBanner.imageUrl}
                alt={midBanner.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </section>
      )}

      {/* 5. Why Shop With Us + Client Testimonials */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 border-y border-neutral-200 py-12">
          <div className="space-y-2">
            <Award className="w-5 h-5 text-[#9E7C16]" />
            <h3 className="text-sm font-semibold text-[#111111]">Curated Luxury Quality</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Every garment and shoe is inspected for stitch precision, fabric weight, and lasting finish.
            </p>
          </div>
          <div className="space-y-2">
            <Truck className="w-5 h-5 text-[#9E7C16]" />
            <h3 className="text-sm font-semibold text-[#111111]">Nationwide Dispatch</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              1–2 business day delivery across Lagos and tracked interstate shipping across Nigeria.
            </p>
          </div>
          <div className="space-y-2">
            <ShieldCheck className="w-5 h-5 text-[#9E7C16]" />
            <h3 className="text-sm font-semibold text-[#111111]">Verified Secure Payments</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Pay confidently via Paystack, Flutterwave, Stripe, Bank Transfer, or Cash on Delivery.
            </p>
          </div>
          <div className="space-y-2">
            <Sparkles className="w-5 h-5 text-[#9E7C16]" />
            <h3 className="text-sm font-semibold text-[#111111]">7-Day Fit Guarantee</h3>
            <p className="text-sm text-neutral-600 leading-relaxed">
              Hassle-free size exchanges and direct WhatsApp concierge assistance on every order.
            </p>
          </div>
        </div>

        {/* Testimonials */}
        <div className="pt-14">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-2">Client Voices</p>
            <h2 className="font-display text-3xl font-semibold text-[#111111]">
              Worn Across Nigeria
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <blockquote className="border border-neutral-200 p-6 bg-white">
              <p className="text-sm text-neutral-700 leading-relaxed mb-4">
                &ldquo;Ordered the Adetomiwa Senator Kaftan for a wedding in Ikoyi. The wool-blend drape and gold cuff finish exceeded bespoke tailors I have paid twice as much.&rdquo;
              </p>
              <footer className="text-xs text-neutral-500">
                <strong className="text-[#111111]">Tunde Adeyemi</strong> · Managing Partner, Victoria Island
              </footer>
            </blockquote>
            <blockquote className="border border-neutral-200 p-6 bg-white">
              <p className="text-sm text-neutral-700 leading-relaxed mb-4">
                &ldquo;The Ikoyi Calfskin Sneakers arrived in Abuja within 48 hours with live tracking updates at every stage. Supple leather and zero break-in discomfort.&rdquo;
              </p>
              <footer className="text-xs text-neutral-500">
                <strong className="text-[#111111]">Chinedu Okafor</strong> · Architect, Maitama Abuja
              </footer>
            </blockquote>
            <blockquote className="border border-neutral-200 p-6 bg-white">
              <p className="text-sm text-neutral-700 leading-relaxed mb-4">
                &ldquo;From the Sovereign Chronograph to the suede horsebit loafers, Diamond Store delivers true affordable luxury with transparent Naira pricing.&rdquo;
              </p>
              <footer className="text-xs text-neutral-500">
                <strong className="text-[#111111]">Ibrahim Musa</strong> · Investment Analyst, Lagos
              </footer>
            </blockquote>
          </div>
        </div>

        {/* Lookbook Strip */}
        <div className="pt-14">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[#9E7C16] mb-1">@diamondstoreng</p>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#111111]">
                The Editorial Gallery
              </h2>
            </div>
            <Link to="/shop" className="text-xs uppercase tracking-widest text-[#111111] hover:text-[#9E7C16]">
              Shop the Look
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[IMG_HERO, IMG_KAFTAN, IMG_SNEAKERS, IMG_WATCH, IMG_LOAFERS, IMG_POLO].slice(0, 5).map((img, i) => (
              <Link key={i} to="/shop" className="aspect-square overflow-hidden bg-[#F5F5F5] group">
                <img
                  src={img}
                  alt={`Diamond Store Lookbook ${i + 1}`}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
