import { User } from '@shared/schema';
import fetch from 'node-fetch';

if (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.FLUTTERWAVE_PUBLIC_KEY) {
  throw new Error('Flutterwave credentials not found');
}

const FLUTTERWAVE_API_URL = 'https://api.flutterwave.com/v3';

export async function initiatePayment(
  amount: number,
  user: User,
  packageType: string,
  redirectUrl: string
) {
  const tx_ref = `DRV_${Date.now()}_${user.id}`;

  const payload = {
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
    console.log('Initiating Rwanda Mobile Money payment with payload:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${FLUTTERWAVE_API_URL}/charges?type=mobile_money_rwanda`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Flutterwave response:', JSON.stringify(data, null, 2));

    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to process payment');
    }

    return {
      status: 'success',
      data: {
        link: data.meta.authorization.redirect,
        tx_ref: tx_ref
      }
    };
  } catch (error) {
    console.error('Flutterwave payment initiation error:', error);
    throw new Error('Failed to initiate payment');
  }
}

export async function verifyPayment(txRef: string) {
  try {
    console.log('Verifying payment for txRef:', txRef);

    const response = await fetch(`${FLUTTERWAVE_API_URL}/transactions/${txRef}/verify`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    console.log('Verification response:', JSON.stringify(data, null, 2));

    if (data.status === 'error') {
      throw new Error(data.message || 'Payment verification failed');
    }

    return data.data;
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
}