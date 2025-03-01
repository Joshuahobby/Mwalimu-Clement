import Flutterwave from 'flutterwave-node-v3';
import { User } from '@shared/schema';

if (!process.env.FLUTTERWAVE_SECRET_KEY || !process.env.FLUTTERWAVE_PUBLIC_KEY) {
  throw new Error('Flutterwave credentials not found');
}

const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY,
  process.env.FLUTTERWAVE_SECRET_KEY
);

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
    payment_type: 'mobilemoneyrw',
    order_id: tx_ref,
    email: user.email || `${user.username}@example.com`,
    phone_number: user.phoneNumber || '25078123456', // Default test phone number for Rwanda
    fullname: user.displayName || user.username,
    client_ip: '154.123.220.1', // Test IP
    device_fingerprint: `device_${Date.now()}`,
    meta: {
      user_id: user.id,
      package_type: packageType
    }
  };

  try {
    console.log('Initiating Rwanda Mobile Money payment with payload:', JSON.stringify(payload, null, 2));
    const response = await flw.MobileMoney.rwanda(payload);
    console.log('Flutterwave response:', JSON.stringify(response, null, 2));

    if (response.status === 'error') {
      throw new Error(response.message || 'Failed to initiate payment');
    }

    return {
      status: 'success',
      data: {
        link: response.data.redirect,
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
    const response = await flw.Transaction.verify({ id: txRef });
    console.log('Verification response:', JSON.stringify(response, null, 2));

    if (response.status === 'error') {
      throw new Error(response.message || 'Payment verification failed');
    }

    return response.data;
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
}