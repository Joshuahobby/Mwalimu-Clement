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
    payment_options: 'mobilemoneyrwanda',
    customer: {
      email: user.email || `${user.username}@example.com`,
      phonenumber: user.phoneNumber || '',
      name: user.displayName || user.username,
    },
    customizations: {
      title: 'Driving Theory Exam',
      description: `Payment for ${packageType} package`,
      logo: 'https://your-logo-url.com/logo.png'
    },
    meta: {
      user_id: user.id,
      package_type: packageType
    }
  };

  try {
    const response = await flw.Charge.card(payload);
    return {
      status: 'success',
      data: {
        link: response.data.link,
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
    const response = await flw.Transaction.verify({ id: txRef });
    return response.data;
  } catch (error) {
    console.error('Flutterwave payment verification error:', error);
    throw new Error('Failed to verify payment');
  }
}
