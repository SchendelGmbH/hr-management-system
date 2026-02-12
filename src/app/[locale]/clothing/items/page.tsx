'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Package, Download } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import ImportProductsModal from '@/components/clothing/ImportProductsModal';

interface ClothingItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  basePrice: number;
  availableSizes: string[];
  imageUrl: string | null;
  isActive: boolean;
  sku: string | null;
  woocommerceId: number | null;
  syncedToWooCommerce: boolean;
}

export default function ClothingItemsPage() {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  useEffect(() => {
    fetchItems();
  }, [categoryFilter]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) {
        params.append('category', categoryFilter);
      }
      const response = await fetch(`/api/clothing/items?${params.toString()}`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/clothing/items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (response.ok) {
        fetchItems();
      } else {
        const error = await response.json();
        alert(`Fehler: ${error.error}`);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('Fehler beim Ändern des Status');
    }
  };

  const deleteItem = async (id: string, itemName: string) => {
    if (!confirm(`Artikel "${itemName}" wirklich löschen?`)) return;

    try {
      const response = await fetch(`/api/clothing/items/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Fehler beim Löschen');
        return;
      }

      fetchItems();
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Fehler beim Löschen');
    }
  };

  // Get unique categories
  const categories = Array.from(new Set(items.map(item => item.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Artikelkatalog</h1>
          <p className="mt-2 text-sm text-gray-600">
            Arbeitskleidung verwalten und pflegen
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center space-x-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            <Download className="h-5 w-5" />
            <span>Aus WooCommerce importieren</span>
          </button>
          <button
            onClick={() => alert('Artikel erstellen - Modal kommt in Kürze')}
            className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            <span>Neuer Artikel</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-2 block">Kategorie:</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="block w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="">Alle Kategorien</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <Package className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Artikel gefunden</h3>
            <p className="mt-2 text-sm text-gray-500">
              {categoryFilter
                ? 'Keine Artikel in dieser Kategorie'
                : 'Legen Sie den ersten Artikel an'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Artikel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Kategorie
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Preis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Größen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                          {item.description}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {item.category}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(item.basePrice)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {Array.isArray(item.availableSizes)
                        ? item.availableSizes.join(', ')
                        : '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {item.sku || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <button
                        onClick={() => toggleActive(item.id, item.isActive)}
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          item.isActive
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        {item.isActive ? 'Aktiv' : 'Inaktiv'}
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => alert('Bearbeiten - Modal kommt in Kürze')}
                          className="text-primary-600 hover:text-primary-700"
                          title="Bearbeiten"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item.id, item.name)}
                          className="text-red-600 hover:text-red-700"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Gesamt Artikel</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{items.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Aktive Artikel</p>
          <p className="mt-1 text-2xl font-semibold text-green-600">
            {items.filter((i) => i.isActive).length}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Kategorien</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{categories.length}</p>
        </div>
      </div>

      {/* Import Modal */}
      <ImportProductsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          fetchItems();
          setIsImportModalOpen(false);
        }}
      />
    </div>
  );
}
