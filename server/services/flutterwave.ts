import { User } from '@shared/schema';
import fetch from 'node-fetch';

if (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.FLUTTERWAVE_PUBLIC_KEY) {
  throw new Error('Flutterwave credentials not found');
}

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

interface PaymentPayload {
  tx_ref: string;
  amount: number;
  currency: string;
  redirect_url: string;
  email: string;
  phone_number: string;
  fullname: string;
  client_ip: string;
  device_fingerprint: string;
  meta: {
    user_id: number;
    package_type: string;
  };
}

interface FlutterwaveResponse {
  status: string;
  message: string;
  data?: {
    id: number;
    tx_ref: string;
    redirect?: string;
    link?: string;
  };
  meta?: {
    authorization?: {
      redirect?: string;
      mode?: string;
      validate_instructions?: string;
    };
  };
}

export async function initiatePayment(
  amount: number,
  user: User,
  packageType: string,
  redirectUrl: string,
  paymentMethod: 'card' | 'mobilemoney' | 'banktransfer' = 'mobilemoney'
) {
  const tx_ref = `DRV_${Date.now()}_${user.id}`;

  const payload: PaymentPayload = {
    tx_ref,
    amount,
    currency: 'RWF',
    redirect_url: redirectUrl,
    email: 'getrwanda@gmail.com', // Test email for Rwanda
    phone_number: '0788331033', // Test phone number for Rwanda
    fullname: user.displayName || user.username,
    client_ip: '154.123.220.1',
    device_fingerprint: `device_${Date.now()}`,
    meta: {
      user_id: user.id,
      package_type: packageType
    }
  };

  try {
    console.log('Initiating payment with payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${FLUTTERWAVE_API_URL}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json() as FlutterwaveResponse;
    console.log('Flutterwave response:', JSON.stringify(data, null, 2));

    // For mobile money, handle the "Charge initiated" status as success
    if (data.status === 'success' && data.message === 'Charge initiated') {
      // Extract the redirect URL from the response
      const redirectLink = data.meta?.authorization?.redirect;

      if (!redirectLink) {
        throw new Error('No redirect URL found in response');
      }

      return {
        status: 'success',
        data: {
          link: redirectLink,
          tx_ref: tx_ref
        }
      };
    }

    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to process payment');
    }

    // For other payment methods or responses
    const redirectLink = data.data?.link || data.data?.redirect || data.meta?.authorization?.redirect;

    if (!redirectLink) {
      throw new Error('No redirect URL found in response');
    }

    return {
      status: 'success',
      data: {
        link: redirectLink,
        tx_ref: tx_ref
      }
    };
  } catch (error) {
    console.error('Flutterwave payment initiation error:', error);
    throw error;
  }
}

interface VerifyResponse {
  status: string;
  message: string;
  data: {
    id: number;
    tx_ref: string;
    status: string;
    amount: number;
    currency: string;
  };
}

export async function verifyPayment(txRef: string) {
  try {
    console.log('Verifying payment for txRef:', txRef);

    const response = await fetch(`${FLUTTERWAVE_API_URL}/transactions/verify_by_reference?tx_ref=${txRef}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    const data = await response.json() as VerifyResponse;
    console.log('Verification response:', JSON.stringify(data, null, 2));

    if (data.status === 'error' || !data.data) {
      throw new Error(data.message || 'Payment verification failed');
    }

    return data.data;
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    throw error;
  }
}