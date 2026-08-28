import crypto from 'crypto';

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_BASE = 'https://api.razorpay.com/v1';

export function isRazorpayConfigured(): boolean {
  return RAZORPAY_KEY_ID.length > 0 && RAZORPAY_KEY_SECRET.length > 0;
}

export function getRazorpayKeyId(): string {
  return RAZORPAY_KEY_ID;
}

function authHeader(): string {
  return 'Basic ' + Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
}

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayPaymentLink {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  short_url: string;
  status: string;
  reference_id: string;
  description: string;
  expire_by: number;
  created_at: number;
}

export interface RazorpayPayment {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  order_id: string;
  error_code: string | null;
  error_description: string | null;
}

export interface RazorpayResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  simulated?: boolean;
}

async function razorpayFetch<T>(path: string, options: RequestInit = {}): Promise<RazorpayResult<T>> {
  if (!isRazorpayConfigured()) {
    return { success: false, error: 'Razorpay credentials not configured', simulated: true };
  }
  try {
    const res = await fetch(`${RAZORPAY_BASE}${path}`, {
      ...options,
      headers: {
        'Authorization': authHeader(),
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const text = await res.text();
    let data: T;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: `Invalid JSON response: ${text.slice(0, 200)}` };
    }
    if (!res.ok) {
      const errMsg = (data as Record<string, unknown>)?.error_description as string ||
        (data as Record<string, unknown>)?.description as string ||
        `Razorpay API error (${res.status})`;
      return { success: false, error: errMsg, data };
    }
    return { success: true, data };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown network error';
    return { success: false, error: msg };
  }
}

export async function createOrder(params: {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayResult<RazorpayOrder>> {
  const body = JSON.stringify({
    amount: Math.round(params.amount * 100),
    currency: params.currency || 'INR',
    receipt: params.receipt,
    notes: params.notes,
  });
  return razorpayFetch<RazorpayOrder>('/orders', { method: 'POST', body });
}

export async function createPaymentLink(params: {
  amount: number;
  currency?: string;
  description: string;
  reference_id: string;
  customer?: { name: string; email: string; contact: string };
  expire_by?: number;
  notes?: Record<string, string>;
}): Promise<RazorpayResult<RazorpayPaymentLink>> {
  const body = JSON.stringify({
    amount: Math.round(params.amount * 100),
    currency: params.currency || 'INR',
    description: params.description,
    reference_id: params.reference_id,
    customer: params.customer,
    expire_by: params.expire_by,
    notes: params.notes,
    notify: { sms: true, email: true },
  });
  return razorpayFetch<RazorpayPaymentLink>('/payment_links', { method: 'POST', body });
}

export async function getPaymentLink(id: string): Promise<RazorpayResult<RazorpayPaymentLink>> {
  return razorpayFetch<RazorpayPaymentLink>(`/payment_links/${id}`, { method: 'GET' });
}

export async function getPaymentStatus(paymentId: string): Promise<RazorpayResult<RazorpayPayment>> {
  return razorpayFetch<RazorpayPayment>(`/payments/${paymentId}`, { method: 'GET' });
}

export async function fetchOrderPayments(orderId: string): Promise<RazorpayResult<{ items: RazorpayPayment[] }>> {
  return razorpayFetch<{ items: RazorpayPayment[] }>(`/orders/${orderId}/payments`, { method: 'GET' });
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// Simulated fallback for when Razorpay is not configured — clearly labeled
export function createSimulatedPaymentLink(params: {
  amount: number;
  description: string;
  reference_id: string;
  customer?: { name: string; email: string; contact: string };
}): RazorpayResult<RazorpayPaymentLink> {
  const id = 'plink_sim_' + crypto.randomBytes(10).toString('hex');
  return {
    success: true,
    simulated: true,
    data: {
      id,
      entity: 'payment.link',
      amount: Math.round(params.amount * 100),
      currency: 'INR',
      short_url: `https://rzp.io/i/${id.slice(-8)}`,
      status: 'created',
      reference_id: params.reference_id,
      description: params.description,
      expire_by: Math.floor(Date.now() / 1000) + 86400,
      created_at: Math.floor(Date.now() / 1000),
    },
  };
}

export function createSimulatedOrder(params: {
  amount: number;
  receipt: string;
}): RazorpayResult<RazorpayOrder> {
  const id = 'order_sim_' + crypto.randomBytes(10).toString('hex');
  return {
    success: true,
    simulated: true,
    data: {
      id,
      entity: 'order',
      amount: Math.round(params.amount * 100),
      currency: 'INR',
      receipt: params.receipt,
      status: 'created',
    },
  };
}
