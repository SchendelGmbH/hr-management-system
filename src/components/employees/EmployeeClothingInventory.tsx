'use client';

import { useState, useEffect } from 'react';
import { Package, Shirt } from 'lucide-react';

interface InventoryItem {
  clothingItemId: string;
  name: string;
  sku: string | null;
  category: string;
  size: string;
  totalQuantity: number;
  imageUrl: string | null;
}

interface EmployeeClothingInventoryProps {
  employeeId: string;
}

export default function EmployeeClothingInventory({
  employeeId,
}: EmployeeClothingInventoryProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory();
  }, [employeeId]);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/employees/${employeeId}/clothing-inventory`);
      const data = await response.json();
      setItems(data.items || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-gray-500">Lädt Inventar...</div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-gray-500">
        <Package className="h-12 w-12 text-gray-400" />
        <p className="mt-4">Keine Artikel vorhanden</p>
        <p className="mt-2 text-sm text-gray-400">
          Sobald Bestellungen geliefert wurden, werden die Artikel hier angezeigt.
        </p>
      </div>
    );
  }

  // Gruppieren nach Kategorie
  const groupedByCategory = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  return (
    <div className="space-y-6">
      {/* Statistik */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Gesamt Artikel</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{items.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Gesamt Stückzahl</p>
          <p className="mt-1 text-2xl font-semibold text-primary-600">
            {items.reduce((sum, item) => sum + item.totalQuantity, 0)}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
          <p className="text-sm text-gray-600">Kategorien</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">
            {Object.keys(groupedByCategory).length}
          </p>
        </div>
      </div>

      {/* Gruppierte Artikel-Listen */}
      {Object.entries(groupedByCategory).map(([category, categoryItems]) => (
        <div key={category} className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-6 py-3">
            <h3 className="text-lg font-semibold text-gray-900">{category}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Artikel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Größe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Anzahl
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {categoryItems.map((item) => (
                  <tr key={`${item.clothingItemId}-${item.size}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="h-10 w-10 rounded object-cover mr-3"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center mr-3">
                            <Shirt className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                      {item.sku || '-'}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {item.size}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <span className="inline-flex rounded-full bg-primary-100 px-3 py-1 text-sm font-semibold text-primary-800">
                        {item.totalQuantity} Stück
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
