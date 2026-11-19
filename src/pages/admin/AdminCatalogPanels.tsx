import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { Edit2, Eye, EyeOff, Plus, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useStore } from '../../context/StoreContext';
import { db } from '../../lib/firebase';
import { formatNaira, slugify } from '../../lib/format';
import { uploadImageAsset } from '../../lib/upload';
import { Banner, Category, CategoryGroup, Product } from '../../types/store';

export function AdminProductsPanel() {
  const { products, categories, saveProduct, deleteProduct, notify, seedDatabaseFromDefaults } = useStore();
  const { getBearerToken } = useAuth();

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  const openNew = () => {
    const firstCat = categories[0];
    setEditing({
      name: '',
      sku: `DMD-${Math.floor(1000 + Math.random() * 9000)}`,
      description: '',
      categoryId: firstCat?.id || '',
      categoryName: firstCat?.name || '',
      categorySlug: firstCat?.slug || '',
      categoryGroup: (firstCat?.group as any) || 'mens-clothing',
      regularPrice: 50000,
      discountPrice: null,
      mainImage: '',
      images: [],
      sizes: ['M', 'L', 'XL'],
      colors: ['Obsidian Black'],
      stockQuantity: 10,
      isFeatured: false,
      isBestSeller: false,
      isTrending: false,
      isNewArrival: true,
      status: 'published',
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !editing) return;
    setUploading(true);
    try {
      const token = await getBearerToken();
      const uploaded: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadImageAsset(files[i], 'catalog', token);
        uploaded.push(url);
      }
      const nextImages = Array.from(new Set([...(editing.images || []), ...uploaded]));
      setEditing({
        ...editing,
        images: nextImages,
        mainImage: editing.mainImage || nextImages[0] || '',
      });
      notify(`Uploaded ${uploaded.length} image(s).`, 'success');
    } catch (err: any) {
      notify(err?.message || 'Upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name || !editing.mainImage) {
      notify('Product name and at least one main image are required.', 'error');
      return;
    }
    const cat = categories.find((c) => c.id === editing.categoryId);
    try {
      await saveProduct({
        ...editing,
        slug: editing.slug || slugify(editing.name),
        categoryName: cat?.name || editing.categoryName || '',
        categorySlug: cat?.slug || editing.categorySlug || '',
        categoryGroup: (cat?.group && cat.group !== 'collections' ? cat.group : editing.categoryGroup) || 'mens-clothing',
      });
      setEditing(null);
      notify('Product saved to catalogue.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Unable to save product.', 'error');
    }
  };

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.sku} ${p.categoryName || ''}`.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">Product Catalogue</h2>
          <p className="text-xs text-neutral-500">Add, edit, price, hide, or upload multiple images per piece.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void seedDatabaseFromDefaults()}
            className="px-4 py-2 border border-neutral-300 text-xs font-medium hover:border-[#111111]"
          >
            Sync Starter Catalogue
          </button>
          <button
            type="button"
            onClick={openNew}
            className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Filter products by name, SKU, or category..."
        className="w-full sm:w-80 border border-neutral-300 px-3 py-2 text-sm bg-white"
      />

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-right">Price</th>
              <th className="py-3 px-4 text-right">Stock</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="py-3 px-4 flex items-center gap-3">
                  <img
                    src={p.mainImage}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 object-cover bg-[#F5F5F5] shrink-0"
                  />
                  <span className="font-medium text-[#111111] line-clamp-1">{p.name}</span>
                </td>
                <td className="py-3 px-4 font-mono text-xs text-neutral-600">{p.sku}</td>
                <td className="py-3 px-4 text-xs text-neutral-600">{p.categoryName || p.categoryGroup}</td>
                <td className="py-3 px-4 text-right tabular-nums">
                  {p.discountPrice ? (
                    <span>
                      <strong>{formatNaira(p.discountPrice)}</strong>{' '}
                      <span className="text-xs text-neutral-400 line-through">{formatNaira(p.regularPrice)}</span>
                    </span>
                  ) : (
                    formatNaira(p.regularPrice)
                  )}
                </td>
                <td className="py-3 px-4 text-right tabular-nums">{p.stockQuantity}</td>
                <td className="py-3 px-4 text-xs capitalize">{p.status}</td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void saveProduct({
                          ...p,
                          status: p.status === 'published' ? 'hidden' : 'published',
                        })
                      }
                      title={p.status === 'published' ? 'Hide temporarily' : 'Publish'}
                      className="p-1.5 text-neutral-600 hover:text-[#111111]"
                    >
                      {p.status === 'published' ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(p)}
                      className="p-1.5 text-neutral-600 hover:text-[#9E7C16]"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void deleteProduct(p.id);
                        notify('Product removed.', 'info');
                      }}
                      className="p-1.5 text-neutral-600 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={handleSave}
            className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-5"
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-4">
              <h3 className="font-display text-2xl font-semibold text-[#111111]">
                {editing.id ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button type="button" onClick={() => setEditing(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editing.name || ''}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">SKU *</label>
                <input
                  type="text"
                  required
                  value={editing.sku || ''}
                  onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Category *</label>
                <select
                  value={editing.categoryId || ''}
                  onChange={(e) => setEditing({ ...editing, categoryId: e.target.value })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.group})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Status</label>
                <select
                  value={editing.status || 'published'}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value as any })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft</option>
                  <option value="hidden">Hidden Temporarily</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Regular Price (₦) *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editing.regularPrice ?? 0}
                  onChange={(e) => setEditing({ ...editing, regularPrice: Number(e.target.value) })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Discount Price (₦)</label>
                <input
                  type="number"
                  min={0}
                  value={editing.discountPrice ?? ''}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      discountPrice: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Optional"
                  className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Stock Quantity *</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={editing.stockQuantity ?? 0}
                  onChange={(e) => setEditing({ ...editing, stockQuantity: Number(e.target.value) })}
                  className="w-full border border-neutral-300 px-3 py-2 text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                  Sizes (comma-separated)
                </label>
                <input
                  type="text"
                  value={(editing.sizes || []).join(', ')}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      sizes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="M, L, XL, XXL"
                  className="w-full border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">
                Colours (comma-separated)
              </label>
              <input
                type="text"
                value={(editing.colors || []).join(', ')}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    colors: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Obsidian Black, Gold"
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-neutral-600 mb-1">Description</label>
              <textarea
                rows={3}
                value={editing.description || ''}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>

            {/* Multiple Image Upload + Main Image Selector */}
            <div className="border border-neutral-200 p-4 space-y-3 bg-[#F5F5F5]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-neutral-700">
                  Product Pictures (Click one to set Main Image)
                </span>
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] text-white text-xs cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Uploading...' : 'Upload Images'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-3">
                {(editing.images || []).map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 border bg-white">
                    <img
                      src={url}
                      alt="Product asset"
                      onClick={() => setEditing({ ...editing, mainImage: url })}
                      className={`w-full h-full object-cover cursor-pointer ${
                        editing.mainImage === url ? 'ring-2 ring-[#D4AF37]' : ''
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const rest = (editing.images || []).filter((u) => u !== url);
                        setEditing({
                          ...editing,
                          images: rest,
                          mainImage: editing.mainImage === url ? rest[0] || '' : editing.mainImage,
                        });
                      }}
                      className="absolute -top-2 -right-2 bg-red-600 text-white w-5 h-5 text-xs flex items-center justify-center"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-5 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isFeatured)}
                  onChange={(e) => setEditing({ ...editing, isFeatured: e.target.checked })}
                />
                Featured Product
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isBestSeller)}
                  onChange={(e) => setEditing({ ...editing, isBestSeller: e.target.checked })}
                />
                Best Seller
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isTrending)}
                  onChange={(e) => setEditing({ ...editing, isTrending: e.target.checked })}
                />
                Trending Now
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(editing.isNewArrival)}
                  onChange={(e) => setEditing({ ...editing, isNewArrival: e.target.checked })}
                />
                New Arrival
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-neutral-200">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="px-5 py-2.5 border border-neutral-300 text-xs uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
              >
                Save Product
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminCategoriesPanel() {
  const { categories, saveCategory, deleteCategory, notify } = useStore();
  const [name, setName] = useState('');
  const [group, setGroup] = useState<CategoryGroup>('mens-clothing');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await saveCategory({
      id: editingId || undefined,
      name: name.trim(),
      slug: slugify(name),
      group,
      description,
      active: true,
    });
    setName('');
    setDescription('');
    setEditingId(null);
    notify('Category saved.', 'success');
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-[#111111]">Product Categories</h2>
      <form onSubmit={handleSubmit} className="border border-neutral-200 p-5 bg-white grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Agbada Sets"
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Department</label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as CategoryGroup)}
            className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
          >
            <option value="mens-clothing">Men&apos;s Clothing</option>
            <option value="shoes">Shoes</option>
            <option value="mens-accessories">Men&apos;s Accessories</option>
            <option value="collections">Collections</option>
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase text-neutral-600 mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" className="py-2.5 px-4 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider">
          {editingId ? 'Update Category' : 'Add Category'}
        </button>
      </form>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Department</th>
              <th className="py-3 px-4">Slug</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="py-2.5 px-4 font-medium">{c.name}</td>
                <td className="py-2.5 px-4 text-xs text-neutral-600">{c.group}</td>
                <td className="py-2.5 px-4 font-mono text-xs text-neutral-500">{c.slug}</td>
                <td className="py-2.5 px-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setName(c.name);
                      setGroup(c.group);
                      setDescription(c.description || '');
                    }}
                    className="text-xs text-[#9E7C16] underline"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteCategory(c.id)}
                    className="text-xs text-red-600 underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminInventoryPanel() {
  const { products, saveProduct, notify } = useStore();
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const list = products.filter((p) => {
    if (filter === 'low') return p.stockQuantity > 0 && p.stockQuantity <= 10;
    if (filter === 'out') return p.stockQuantity <= 0;
    return true;
  });

  const handleRestock = async (p: Product, delta: number) => {
    await saveProduct({
      ...p,
      stockQuantity: Math.max(0, p.stockQuantity + delta),
    });
    notify(`Updated stock for ${p.name}.`, 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-semibold text-[#111111]">Inventory Control</h2>
          <p className="text-xs text-neutral-500">Monitor stock levels, sold units, low-stock alerts, and restocking.</p>
        </div>
        <div className="flex gap-1 bg-white border border-neutral-200 p-1">
          {(['all', 'low', 'out'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs capitalize ${
                filter === f ? 'bg-[#111111] text-white' : 'text-neutral-600'
              }`}
            >
              {f === 'all' ? 'All Stock' : f === 'low' ? 'Low Stock (≤10)' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      <div className="border border-neutral-200 bg-white overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-[#F5F5F5] border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr>
              <th className="py-3 px-4">Product</th>
              <th className="py-3 px-4">SKU</th>
              <th className="py-3 px-4 text-right">Sold</th>
              <th className="py-3 px-4 text-right">Available</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Quick Restock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {list.map((p) => (
              <tr key={p.id}>
                <td className="py-3 px-4 font-medium">{p.name}</td>
                <td className="py-3 px-4 font-mono text-xs text-neutral-500">{p.sku}</td>
                <td className="py-3 px-4 text-right tabular-nums">{p.soldCount || 0}</td>
                <td className="py-3 px-4 text-right tabular-nums font-semibold">{p.stockQuantity}</td>
                <td className="py-3 px-4 text-xs">
                  {p.stockQuantity <= 0 ? (
                    <span className="text-red-700 font-semibold">Out of Stock</span>
                  ) : p.stockQuantity <= 10 ? (
                    <span className="text-amber-700 font-semibold">Low Stock</span>
                  ) : (
                    <span className="text-emerald-700">Healthy</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => void handleRestock(p, 5)}
                    className="px-2.5 py-1 border border-neutral-300 text-xs hover:border-[#111111]"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleRestock(p, 20)}
                    className="px-2.5 py-1 bg-[#111111] text-white text-xs"
                  >
                    +20
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminBannersPanel() {
  const { banners, saveBanner, deleteBanner, notify } = useStore();
  const { getBearerToken } = useAuth();
  const [editing, setEditing] = useState<Partial<Banner> | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    try {
      const token = await getBearerToken();
      const url = await uploadImageAsset(file, 'banner', token);
      setEditing({ ...editing, imageUrl: url });
      notify('Banner image uploaded.', 'success');
    } catch (err: any) {
      notify(err?.message || 'Upload failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold text-[#111111]">Website Banners</h2>
        <button
          type="button"
          onClick={() =>
            setEditing({
              title: '',
              subtitle: 'DIAMOND STORE',
              description: '',
              imageUrl: '',
              ctaText: 'SHOP NOW',
              ctaLink: '/shop',
              placement: 'hero',
              active: true,
              sortOrder: banners.length + 1,
            })
          }
          className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold uppercase tracking-wider"
        >
          Add Banner
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((b) => (
          <div key={b.id} className="border border-neutral-200 bg-white overflow-hidden">
            <img src={b.imageUrl} alt={b.title} className="w-full h-44 object-cover" />
            <div className="p-4 space-y-2">
              <div className="flex justify-between items-center text-xs text-neutral-500 uppercase">
                <span>{b.placement}</span>
                <span>{b.active ? 'Published' : 'Hidden'}</span>
              </div>
              <h3 className="font-display text-xl font-semibold">{b.title}</h3>
              <p className="text-xs text-neutral-600 line-clamp-2">{b.description}</p>
              <div className="pt-2 flex gap-3 text-xs">
                <button type="button" onClick={() => setEditing(b)} className="text-[#9E7C16] underline">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void saveBanner({ ...b, active: !b.active })}
                  className="text-neutral-700 underline"
                >
                  {b.active ? 'Hide' : 'Publish'}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteBanner(b.id)}
                  className="text-red-600 underline"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await saveBanner(editing);
              setEditing(null);
              notify('Banner updated.', 'success');
            }}
            className="bg-white max-w-lg w-full p-6 space-y-4"
          >
            <h3 className="font-display text-2xl font-semibold">Banner Configuration</h3>
            <input
              type="text"
              required
              value={editing.title || ''}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              placeholder="Heading"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={editing.subtitle || ''}
              onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
              placeholder="Subtitle"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editing.description || ''}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description"
              className="w-full border border-neutral-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={editing.ctaText || ''}
                onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })}
                placeholder="Button Label"
                className="border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                type="text"
                value={editing.ctaLink || ''}
                onChange={(e) => setEditing({ ...editing, ctaLink: e.target.value })}
                placeholder="/shop"
                className="border border-neutral-300 px-3 py-2 text-sm"
              />
            </div>
            <select
              value={editing.placement || 'hero'}
              onChange={(e) => setEditing({ ...editing, placement: e.target.value as any })}
              className="w-full border border-neutral-300 px-3 py-2 text-sm bg-white"
            >
              <option value="hero">Hero Placement</option>
              <option value="promo_mid">Mid-Page Campaign</option>
            </select>
            <div>
              <label className="block text-xs uppercase text-neutral-600 mb-1">Banner Image</label>
              <input type="file" accept="image/*" onChange={handleUpload} className="text-xs" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 border border-neutral-300 text-xs">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 bg-[#111111] text-white text-xs uppercase">
                Save Banner
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export function AdminReviewsPanel() {
  const { reviews, products, notify } = useStore();

  const toggleApproval = async (id: string, approved: boolean) => {
    await updateDoc(doc(db, 'reviews', id), { approved: !approved, updatedAt: serverTimestamp() }).catch(() => {});
    notify('Review updated.', 'info');
  };

  const removeReview = async (id: string) => {
    await deleteDoc(doc(db, 'reviews', id)).catch(() => {});
    notify('Review deleted.', 'info');
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-semibold text-[#111111]">Customer Reviews</h2>
      <div className="border border-neutral-200 bg-white divide-y divide-neutral-100">
        {reviews.length === 0 ? (
          <p className="p-8 text-sm text-neutral-500 text-center">No customer reviews submitted yet.</p>
        ) : (
          reviews.map((r) => {
            const p = products.find((prod) => prod.id === r.productId);
            return (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">{r.authorName} · {r.rating}/5 Stars</p>
                  <p className="text-xs text-neutral-500">{p?.name || r.productId}</p>
                  <p className="text-sm text-neutral-700 mt-1">{r.comment}</p>
                </div>
                <div className="flex gap-3 text-xs shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleApproval(r.id, r.approved)}
                    className="underline text-[#9E7C16]"
                  >
                    {r.approved ? 'Hide' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeReview(r.id)}
                    className="underline text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
