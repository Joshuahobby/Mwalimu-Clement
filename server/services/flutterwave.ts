import axios from "axios";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY || "FLWSECK_TEST-2f49267e1f25852a5a1f2d94f87fa83f-X";
const BASE_URL = "https://api.flutterwave.com/v3";

interface User {
  id: number;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

interface FlutterwaveResponse {
  status: string;
  message: string;
  data?: any;
}

interface VerificationResponse {
  status: string;
  message: string;
  transactionId?: string;
  amountPaid?: number;
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  paymentMethod?: string;
  createdAt?: string;
  meta?: any;
}

// Helper function to validate response from Flutterwave
const validateFlutterwaveResponse = (response: any): FlutterwaveResponse => {
  if (!response || typeof response !== 'object') {
    throw new Error("Invalid response from payment gateway");
  }

  if (!response.status) {
    throw new Error("Missing status in payment gateway response");
  }

  return response;
};

// Function to initiate a payment
export async function initiatePayment(
  amount: number,
  user: User,
  packageType: string,
  redirectUrl: string,
  paymentMethod: string = 'mobilemoney'
): Promise<any> {
  try {
    //Ensure customer email exists before proceeding
    if (!user.email) {
      throw new Error("Customer email is required to initiate payment.");
    }

    console.log(`Initiating ${paymentMethod} payment for ${user.email} (${packageType}) - ${amount} RWF`);

    // Flutterwave API expects a full name, so default to username if not provided
    const customerName = user.firstName && user.lastName 
      ? `${user.firstName} ${user.lastName}` 
      : user.username;

    // Generate transaction reference
    const tx_ref = `DRV_${Date.now()}_${user.id}`;

    // Create payment payload
    const payload: Record<string, any> = {
      tx_ref,
      amount,
      currency: "RWF",
      redirect_url: redirectUrl,
      customer: {
        email: user.email,
        name: customerName,
        phonenumber: user.phoneNumber || "250780000000", // Default if not provided
      },
      customizations: {
        title: "Driving License Test Preparation",
        description: `${packageType.charAt(0).toUpperCase() + packageType.slice(1)} Package`,
        logo: "https://assets.piedcode.com/images/driving-license-logo.png"
      },
      meta: {
        package_type: packageType,
        user_id: user.id
      }
    };

    // Add payment method specific configuration
    if (paymentMethod === 'mobilemoney') {
      payload.payment_options = "mobilemoneyrwanda";
      // Mobile money specific configuration
      payload.meta.consumer_id = user.id.toString();
    } else if (paymentMethod === 'card') {
      payload.payment_options = "card";
    } else if (paymentMethod === 'banktransfer') {
      payload.payment_options = "banktransfer";
    }

    console.log('Payment payload:', JSON.stringify(payload, null, 2));

    // Make API request to Flutterwave
    const response = await axios.post(`${BASE_URL}/payments`, payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = validateFlutterwaveResponse(response.data);
    console.log('Flutterwave response:', JSON.stringify(result, null, 2));

    if (result.status !== "success") {
      console.error('Flutterwave payment initiation failed:', result.message);
      throw new Error(`Payment initiation failed: ${result.message}`);
    }

    return {
      status: result.status,
      message: result.message,
      data: result.data,
      meta: {
        tx_ref,
        payment_method: paymentMethod,
        initiated_at: new Date().toISOString(),
      }
    };
  } catch (error) {
    console.error('Payment initiation error:', error);
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);
      throw new Error(`Payment gateway error: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

// Function to verify a payment
export async function verifyPayment(tx_ref: string): Promise<VerificationResponse> {
  try {
    console.log(`Verifying payment with reference: ${tx_ref}`);

    if (!tx_ref || tx_ref.trim() === '') {
      throw new Error("Transaction reference is empty or invalid");
    }

    // Make API request to Flutterwave
    console.log(`Making API request to ${BASE_URL}/transactions/verify_by_reference?tx_ref=${tx_ref}`);
    const response = await axios.get(`${BASE_URL}/transactions/verify_by_reference?tx_ref=${tx_ref}`, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const result = validateFlutterwaveResponse(response.data);
    console.log('Verification response:', JSON.stringify(result, null, 2));

    if (result.status !== "success") {
      console.error('Flutterwave verification failed:', result.message);
      return {
        status: "failed",
        message: result.message || "Verification failed"
      };
    }

    // Extract transaction data
    const transaction = result.data;
    if (!transaction) {
      console.error('Transaction data missing in verification response');
      return {
        status: "failed",
        message: "Transaction data missing"
      };
    }

    // Check if transaction was successful
    if (transaction.status !== "successful") {
      console.error(`Transaction found but status is ${transaction.status}`);
      return {
        status: transaction.status,
        message: `Payment ${transaction.status}`,
        transactionId: transaction.id,
        customerEmail: transaction.customer?.email,
        paymentMethod: transaction.payment_type,
        createdAt: transaction.created_at
      };
    }

    // Successful transaction
    return {
      status: "successful",
      message: "Payment verified successfully",
      transactionId: transaction.id,
      amountPaid: transaction.amount,
      currency: transaction.currency,
      customerEmail: transaction.customer?.email,
      customerName: transaction.customer?.name,
      paymentMethod: transaction.payment_type,
      createdAt: transaction.created_at,
      meta: transaction.meta
    };
  } catch (error) {
    console.error('Payment verification error:', error);
    if (axios.isAxiosError(error)) {
      console.error('API Error:', error.response?.data || error.message);

      if (error.response?.status === 404) {
        return {
          status: "not_found",
          message: "Transaction reference not found"
        };
      }
      
      return {
        status: "failed",
        message: `Verification error: ${error.response?.data?.message || error.message}`
      };
    }
    
    return {
      status: "failed",
      message: error instanceof Error ? error.message : "Unknown verification error"
    };
  }
}

// Function to verify webhook signatures
export function verifyWebhookSignature(signature: string, payload: any): boolean {
  // Implement based on Flutterwave's documentation
  // This is a placeholder - in production you would compare the
  // provided signature with a hash of the payload using your secret key
  if (!signature) return false;

  // For testing environments, we can bypass this check
  if (process.env.NODE_ENV !== 'production') {
    console.log('Bypassing webhook signature verification in non-production environment');
    return true;
  }

  // In production, you should implement proper signature verification
  // Example for Flutterwave:
  // 1. Get the secret hash from your environment variables
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_SECRET;

  // 2. Compare with the signature from the request
  const isValid = signature === secretHash;

  if (!isValid) {
    console.error('Invalid webhook signature received:', signature);
  }

  return isValid;
}

// Helper function to compute hash for webhook verification
// Note: Actual implementation depends on Flutterwave's documentation
function computeSignatureHash(payload: any, secret: string): string {
  try {
    // This is a placeholder. In production, you would:
    // 1. Convert payload to string if it's an object
    const payloadString = typeof payload === 'object' ? JSON.stringify(payload) : String(payload);

    // 2. In Node.js, you would use the crypto module to create a hash
    // const crypto = require('crypto');
    // return crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

    // Simplified placeholder for the example
    return secret;
  } catch (error) {
    console.error('Error computing signature hash:', error);
    return '';
  }
}

// Get transaction details from Flutterwave
export async function getTransactionDetails(id: string): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/transactions/${id}`, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return validateFlutterwaveResponse(response.data);
  } catch (error) {
    console.error(`Error getting transaction details for ID ${id}:`, error);
    throw error;
  }
}

// Refund a transaction
export async function refundTransaction(id: string, amount?: number): Promise<any> {
  try {
    const payload: Record<string, any> = { id };

    if (amount) {
      payload.amount = amount;
    }

    const response = await axios.post(`${BASE_URL}/transactions/${id}/refund`, payload, {
      headers: {
        Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    return validateFlutterwaveResponse(response.data);
  } catch (error) {
    console.error(`Error refunding transaction ${id}:`, error);
    throw error;
  }
}