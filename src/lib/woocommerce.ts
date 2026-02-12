import axios, { AxiosInstance } from 'axios';

interface WooCommerceConfig {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

class WooCommerceClient {
  private client: AxiosInstance;

  constructor(config: WooCommerceConfig) {
    this.client = axios.create({
      baseURL: `${config.url}/wp-json/wc/v3`,
      auth: {
        username: config.consumerKey,
        password: config.consumerSecret,
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Bestellungen abrufen
  async getOrders(params?: {
    status?: string;
    after?: string;
    before?: string;
    page?: number;
    per_page?: number;
  }) {
    const response = await this.client.get('/orders', { params });
    return {
      orders: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1'),
      total: parseInt(response.headers['x-wp-total'] || '0'),
    };
  }

  // Einzelne Bestellung abrufen
  async getOrder(orderId: number) {
    const response = await this.client.get(`/orders/${orderId}`);
    return response.data;
  }

  // Produkt per SKU suchen
  async getProductBySku(sku: string) {
    const response = await this.client.get('/products', {
      params: { sku },
    });
    return response.data[0] || null;
  }

  // Produkte abrufen
  async getProducts(params?: {
    category?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }) {
    const response = await this.client.get('/products', { params });
    return {
      products: response.data,
      totalPages: parseInt(response.headers['x-wp-totalpages'] || '1'),
      total: parseInt(response.headers['x-wp-total'] || '0'),
    };
  }

  // Einzelnes Produkt abrufen
  async getProduct(productId: number) {
    const response = await this.client.get(`/products/${productId}`);
    return response.data;
  }

  // Produkt erstellen
  async createProduct(productData: any) {
    const response = await this.client.post('/products', productData);
    return response.data;
  }

  // Produkt aktualisieren
  async updateProduct(productId: number, productData: any) {
    const response = await this.client.put(`/products/${productId}`, productData);
    return response.data;
  }

  // Produkt-Variation abrufen (für variable Produkte)
  async getProductVariation(productId: number, variationId: number) {
    const response = await this.client.get(`/products/${productId}/variations/${variationId}`);
    return response.data;
  }
}

// Singleton-Instanz
let wooCommerceClient: WooCommerceClient | null = null;

export function getWooCommerceClient(): WooCommerceClient {
  if (!wooCommerceClient) {
    const url = process.env.WOOCOMMERCE_URL;
    const consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
    const consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;

    if (!url || !consumerKey || !consumerSecret) {
      throw new Error('WooCommerce credentials not configured in environment variables');
    }

    wooCommerceClient = new WooCommerceClient({
      url,
      consumerKey,
      consumerSecret,
    });
  }

  return wooCommerceClient;
}

// TypeScript Types für WooCommerce-Daten
export interface WCOrder {
  id: number;
  parent_id: number;
  number: string;
  order_key: string;
  status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed';
  currency: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  customer_note: string;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: any;
  payment_method: string;
  payment_method_title: string;
  line_items: WCLineItem[];
  meta_data: Array<{ id: number; key: string; value: any }>;
}

export interface WCLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  tax_class: string;
  subtotal: string;
  subtotal_tax: string;
  total: string;
  total_tax: string;
  sku: string;
  price: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: string;
    display_key: string;
    display_value: string;
  }>;
}

export interface WCProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_modified: string;
  type: 'simple' | 'grouped' | 'external' | 'variable';
  status: 'draft' | 'pending' | 'private' | 'publish';
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_to: string | null;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  backorders: string;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  tags: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  images: Array<{
    id: number;
    date_created: string;
    date_modified: string;
    src: string;
    name: string;
    alt: string;
  }>;
  attributes: Array<{
    id: number;
    name: string;
    position: number;
    visible: boolean;
    variation: boolean;
    options: string[];
  }>;
  default_attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}

export interface WCVariation {
  id: number;
  date_created: string;
  date_modified: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  status: 'draft' | 'pending' | 'private' | 'publish';
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  weight: string;
  dimensions: {
    length: string;
    width: string;
    height: string;
  };
  image: {
    id: number;
    src: string;
    name: string;
    alt: string;
  };
  attributes: Array<{
    id: number;
    name: string;
    option: string;
  }>;
  meta_data: Array<{
    id: number;
    key: string;
    value: any;
  }>;
}
