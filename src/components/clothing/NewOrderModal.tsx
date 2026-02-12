'use client';

import { useState, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import { Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  remainingBudget: number;
  clothingBudget: number;
}

interface ClothingItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  availableSizes: string[];
}

interface OrderItem {
  clothingItemId: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function NewOrderModal({
  isOpen,
  onClose,
  onSuccess,
}: NewOrderModalProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [orderItems, setOrderItems] = useState<OrderItem[]>([
    { clothingItemId: '', size: '', quantity: 1, unitPrice: 0 },
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
      fetchClothingItems();
    }
  }, [isOpen]);

  const fetchEmployees = async () => {
    try {
      const response = await fetch('/api/employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const fetchClothingItems = async () => {
    try {
      const response = await fetch('/api/clothing/items');
      const data = await response.json();
      setClothingItems(data.items || []);
    } catch (error) {
      console.error('Error fetching clothing items:', error);
    }
  };

  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  const calculateTotal = () => {
    return orderItems.reduce((sum, item) => {
      return sum + item.unitPrice * item.quantity;
    }, 0);
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...orderItems];
    newItems[index] = { ...newItems[index], [field]: value };

    // Update unit price when clothing item changes
    if (field === 'clothingItemId') {
      const clothingItem = clothingItems.find((item) => item.id === value);
      if (clothingItem) {
        newItems[index].unitPrice = clothingItem.basePrice;
        newItems[index].size = ''; // Reset size
      }
    }

    setOrderItems(newItems);
  };

  const addItem = () => {
    setOrderItems([
      ...orderItems,
      { clothingItemId: '', size: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    if (orderItems.length > 1) {
      setOrderItems(orderItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const total = calculateTotal();
    if (selectedEmployee && total > selectedEmployee.remainingBudget) {
      if (
        !confirm(
          `Der Gesamtbetrag (${formatCurrency(total)}) übersteigt das verfügbare Budget (${formatCurrency(selectedEmployee.remainingBudget)}). Trotzdem fortfahren?`
        )
      ) {
        return;
      }
    }

    setLoading(true);
    try {
      const response = await fetch('/api/clothing/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          items: orderItems.filter((item) => item.clothingItemId && item.size),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      onSuccess();
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Fehler beim Erstellen der Bestellung');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedEmployeeId('');
    setOrderItems([{ clothingItemId: '', size: '', quantity: 1, unitPrice: 0 }]);
  };

  const getAvailableSizes = (itemId: string) => {
    const item = clothingItems.find((i) => i.id === itemId);
    return item?.availableSizes || [];
  };

  const total = calculateTotal();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Neue Bestellung" size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Employee Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mitarbeiter *
          </label>
          <select
            required
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
          >
            <option value="">Bitte wählen...</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.employeeNumber} - {employee.firstName} {employee.lastName} (
                Budget: {formatCurrency(employee.remainingBudget)})
              </option>
            ))}
          </select>
        </div>

        {/* Budget Info */}
        {selectedEmployee && (
          <div className="rounded-lg bg-blue-50 p-4">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-blue-900">Gesamtbudget:</span>
              <span className="text-blue-900">
                {formatCurrency(selectedEmployee.clothingBudget)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="font-medium text-blue-900">Verfügbar:</span>
              <span className="text-blue-900">
                {formatCurrency(selectedEmployee.remainingBudget)}
              </span>
            </div>
          </div>
        )}

        {/* Order Items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">
              Artikel *
            </label>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center space-x-1 text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              <Plus className="h-4 w-4" />
              <span>Artikel hinzufügen</span>
            </button>
          </div>

          <div className="space-y-3">
            {orderItems.map((item, index) => {
              const selectedItem = clothingItems.find(
                (ci) => ci.id === item.clothingItemId
              );
              const availableSizes = getAvailableSizes(item.clothingItemId);

              return (
                <div
                  key={index}
                  className="grid grid-cols-12 gap-2 rounded-lg border border-gray-200 p-3"
                >
                  {/* Clothing Item */}
                  <div className="col-span-5">
                    <select
                      required
                      value={item.clothingItemId}
                      onChange={(e) =>
                        handleItemChange(index, 'clothingItemId', e.target.value)
                      }
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                    >
                      <option value="">Artikel wählen...</option>
                      {clothingItems.map((ci) => (
                        <option key={ci.id} value={ci.id}>
                          {ci.name} ({formatCurrency(ci.basePrice)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Size */}
                  <div className="col-span-2">
                    <select
                      required
                      value={item.size}
                      onChange={(e) =>
                        handleItemChange(index, 'size', e.target.value)
                      }
                      disabled={!item.clothingItemId}
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500 disabled:bg-gray-100"
                    >
                      <option value="">Größe</option>
                      {availableSizes.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quantity */}
                  <div className="col-span-2">
                    <input
                      type="number"
                      required
                      min="1"
                      value={item.quantity}
                      onChange={(e) =>
                        handleItemChange(
                          index,
                          'quantity',
                          parseInt(e.target.value) || 1
                        )
                      }
                      className="block w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-primary-500"
                      placeholder="Anz."
                    />
                  </div>

                  {/* Subtotal */}
                  <div className="col-span-2 flex items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </div>

                  {/* Remove Button */}
                  <div className="col-span-1 flex items-center">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      disabled={orderItems.length === 1}
                      className="rounded-lg p-1 text-red-600 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Total */}
        <div className="rounded-lg bg-gray-50 p-4">
          <div className="flex justify-between">
            <span className="text-lg font-semibold text-gray-900">
              Gesamtbetrag:
            </span>
            <span
              className={`text-lg font-bold ${
                selectedEmployee && total > selectedEmployee.remainingBudget
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {formatCurrency(total)}
            </span>
          </div>
          {selectedEmployee && total > selectedEmployee.remainingBudget && (
            <p className="mt-2 text-sm text-red-600">
              Warnung: Budget wird überschritten!
            </p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            type="submit"
            disabled={loading || !selectedEmployeeId}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Wird erstellt...' : 'Bestellung erstellen'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
