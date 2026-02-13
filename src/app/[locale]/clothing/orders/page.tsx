'use client';

import { useState, useEffect } from 'react';
import { Plus, Shirt, Edit } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/utils';
import NewOrderModal from '@/components/clothing/NewOrderModal';
import UpdateStatusModal from '@/components/clothing/UpdateStatusModal';

interface Order {
  id: string;
  orderDate: string;
  totalAmount: number;
  status: 'ORDERED' | 'DELIVERED' | 'RETURNED';
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string;
    remainingBudget?: number;
  };
  items: Array<{
    id: string;
    size: string;
    quantity: number;
    unitPrice: number;
    clothingItem: {
      name: string;
      category: string;
    };
  }>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/clothing/orders');
      const data = await response.json();
      setOrders(data.orders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'bg-green-100 text-green-800';
      case 'ORDERED':
        return 'bg-blue-100 text-blue-800';
      case 'RETURNED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'Geliefert';
      case 'ORDERED':
        return 'Bestellt';
      case 'RETURNED':
        return 'Retourniert';
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bestellungen</h1>
          <p className="mt-2 text-sm text-gray-600">Bestellverwaltung und Budget-Tracking</p>
        </div>
        <button
          onClick={() => setIsNewOrderModalOpen(true)}
          className="flex items-center space-x-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          <span>Neue Bestellung</span>
        </button>
      </div>

      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onSuccess={fetchOrders}
      />

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-gray-500">Laden...</div>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center">
            <Shirt className="h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Keine Bestellungen gefunden</h3>
            <p className="mt-2 text-sm text-gray-500">Erstellen Sie die erste Bestellung</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Bestelldatum
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Mitarbeiter
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Artikel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Gesamtbetrag
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
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {order.employee.firstName} {order.employee.lastName}
                      </div>
                      <div className="text-xs text-gray-500">{order.employee.employeeNumber}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {order.items.length} Artikel
                        <div className="mt-1 text-xs text-gray-500">
                          {order.items.slice(0, 2).map((item) => (
                            <div key={item.id}>
                              {item.quantity}x {item.clothingItem.name} ({item.size})
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-gray-400">
                              +{order.items.length - 2} weitere
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(order.status)}`}
                      >
                        {getStatusText(order.status)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm">
                      <button
                        onClick={async () => {
                          // Fetch full order details including budget
                          try {
                            const response = await fetch(`/api/clothing/orders/${order.id}`);
                            const fullOrder = await response.json();

                            // Ensure we have the required budget information
                            if (fullOrder && fullOrder.employee && typeof fullOrder.employee.remainingBudget !== 'undefined') {
                              setSelectedOrder(fullOrder);
                              setIsUpdateModalOpen(true);
                            } else {
                              alert('Fehler: Budget-Informationen fehlen');
                            }
                          } catch (error) {
                            console.error('Error fetching order details:', error);
                            alert('Fehler beim Laden der Bestellung');
                          }
                        }}
                        className="inline-flex items-center text-primary-600 hover:text-primary-700"
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Status ändern
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Status Update Modal */}
      {selectedOrder && selectedOrder.employee.remainingBudget !== undefined && (
        <UpdateStatusModal
          isOpen={isUpdateModalOpen}
          onClose={() => {
            setIsUpdateModalOpen(false);
            setSelectedOrder(null);
          }}
          onSuccess={() => {
            setIsUpdateModalOpen(false);
            setSelectedOrder(null);
            fetchOrders(); // Refresh orders list
          }}
          order={{
            ...selectedOrder,
            employee: {
              ...selectedOrder.employee,
              remainingBudget: selectedOrder.employee.remainingBudget!,
            },
          }}
        />
      )}
    </div>
  );
}
