export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? (isForm ? options.body : JSON.stringify(options.body)) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error || `Request failed with status ${response.status}.`,
      payload?.details,
    );
  }
  return payload;
}

const json = (method, body) => ({ method, body });

function withQuery(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  }
  return `${path}${query.size ? `?${query}` : ''}`;
}

export const api = {
  auth: {
    me: () => request('/auth/me'),
    login: (body) => request('/auth/login', json('POST', body)),
    logout: () => request('/auth/logout', json('POST', {})),
    register: (body) => request('/auth/register', json('POST', body)),
  },
  products: {
    list: (params = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
      }
      return request(`/products${query.size ? `?${query}` : ''}`);
    },
    get: (id) => request(`/products/${encodeURIComponent(id)}`),
    categories: () => request('/categories'),
  },
  cart: {
    get: () => request('/cart'),
    clear: () => request('/cart', { method: 'DELETE' }),
    add: (body) => request('/cart/items', json('POST', body)),
    update: (productId, body) => request(`/cart/items/${encodeURIComponent(productId)}`, json('PATCH', body)),
    remove: (productId) => request(`/cart/items/${encodeURIComponent(productId)}`, { method: 'DELETE' }),
    applyCoupon: (body) => request('/cart/coupon', json('POST', body)),
    removeCoupon: () => request('/cart/coupon', { method: 'DELETE' }),
  },
  addresses: {
    list: () => request('/addresses'),
    add: (body) => request('/addresses', json('POST', body)),
  },
  checkout: {
    place: (body) => request('/checkout', json('POST', body)),
  },
  orders: {
    list: () => request('/orders'),
    get: (id) => request(`/orders/${encodeURIComponent(id)}`),
    updateStatus: (id, status) => request(`/orders/${encodeURIComponent(id)}/status`, json('PATCH', { status })),
    invoice: (id) => request(`/orders/${encodeURIComponent(id)}/invoice`),
    reject: (id, reason) => request(`/orders/${encodeURIComponent(id)}/reject`, json('POST', { reason })),
    resubmitPrescription: (id, prescriptionId) =>
      request(`/orders/${encodeURIComponent(id)}/prescription`, json('POST', { prescriptionId })),
  },
  payments: {
    completeMock: (body) => request('/payments/mock/complete', json('POST', body)),
  },
  seller: {
    stores: () => request('/seller/stores'),
    dashboard: (params) => request(withQuery('/seller/dashboard', params)),
    products: (params) => request(withQuery('/seller/products', params)),
    createProduct: (body) => request('/seller/products', json('POST', body)),
    updateProduct: (id, body) => request(`/seller/products/${encodeURIComponent(id)}`, json('PATCH', body)),
    deleteProduct: (id) => request(`/seller/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  },
  prescriptions: {
    list: () => request('/prescriptions'),
    upload: (file) => {
      const form = new FormData();
      form.append('file', file);
      return request('/prescriptions', { method: 'POST', body: form });
    },
    reviews: (params) => request(withQuery('/prescriptions/reviews', params)),
    review: (orderId, body) => request(`/prescriptions/reviews/${encodeURIComponent(orderId)}`, json('PATCH', body)),
  },
};
