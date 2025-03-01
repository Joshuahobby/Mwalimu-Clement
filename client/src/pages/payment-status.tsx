
import React, { useEffect, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { useQueryParams } from '@/hooks/use-query-params';
import { useLocation } from 'wouter';

interface Transaction {
  status: string;
  transactionId?: string;
  amountPaid?: number;
  currency?: string;
  paymentMethod?: string;
  createdAt?: string;
}

export default function PaymentStatusPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useQueryParams();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get transaction reference from URL
  const tx_ref = params.get('tx_ref');
  const status = params.get('status');

  // Query for active payment
  const { data: activePayment, isLoading: paymentLoading } = useQuery({
    queryKey: ['/api/payments/active'],
    enabled: !!user,
    retry: 3,
  });

  // Effect to verify payment on mount
  useEffect(() => {
    if (!tx_ref) {
      setIsVerifying(false);
      setError("No transaction reference found. If you made a payment, please check the payment history.");
      return;
    }

    const verifyPayment = async () => {
      try {
        const response = await fetch(`/api/payments/status?tx_ref=${tx_ref}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to verify payment');
        }

        const data = await response.json();
        setTransaction(data.transaction);

        // Show toast based on status
        if (data.transaction.status === 'successful') {
          toast({
            title: "Payment Successful",
            description: "Your payment has been processed successfully",
            variant: "default",
          });
        } else if (data.transaction.status === 'failed') {
          toast({
            title: "Payment Failed",
            description: "Your payment could not be completed",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        setError(error instanceof Error ? error.message : 'Unknown error occurred');
        
        toast({
          title: "Verification Error",
          description: error instanceof Error ? error.message : 'Could not verify payment status',
          variant: "destructive",
        });
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [tx_ref, toast]);

  // Payment status helpers
  const getStatusIcon = () => {
    if (isVerifying) return <Loader2 className="w-12 h-12 animate-spin text-primary" />;
    
    if (!transaction) return <HelpCircle className="w-12 h-12 text-gray-400" />;
    
    switch (transaction.status) {
      case 'successful':
        return <CheckCircle className="w-12 h-12 text-green-500" />;
      case 'failed':
        return <XCircle className="w-12 h-12 text-red-500" />;
      case 'pending':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      default:
        return <HelpCircle className="w-12 h-12 text-gray-400" />;
    }
  };

  const getStatusTitle = () => {
    if (isVerifying) return "Verifying Payment";
    if (error) return "Verification Error";
    if (!transaction) return "Unknown Status";
    
    switch (transaction.status) {
      case 'successful':
        return "Payment Successful";
      case 'failed':
        return "Payment Failed";
      case 'pending':
        return "Payment Pending";
      default:
        return `Payment ${transaction.status}`;
    }
  };

  const getStatusDescription = () => {
    if (isVerifying) return "Please wait while we verify your payment status...";
    if (error) return error;
    if (!transaction) return "We couldn't find information about this payment.";
    
    switch (transaction.status) {
      case 'successful':
        return "Your payment has been successfully processed. You can now access your purchased package.";
      case 'failed':
        return "Your payment could not be completed. Please try again or use a different payment method.";
      case 'pending':
        return "Your payment is being processed. This may take a few minutes.";
      default:
        return `Payment status: ${transaction.status}. Please contact support if you need assistance.`;
    }
  };

  return (
    <div className="container max-w-2xl py-10">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl">{getStatusTitle()}</CardTitle>
        </CardHeader>
        
        <CardContent>
          <p className="text-center text-gray-500 mb-6">
            {getStatusDescription()}
          </p>
          
          {transaction && (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50 mt-6">
              {transaction.transactionId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction ID:</span>
                  <span className="font-medium">{transaction.transactionId}</span>
                </div>
              )}
              
              {transaction.amountPaid && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-medium">{transaction.amountPaid} {transaction.currency}</span>
                </div>
              )}
              
              {transaction.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-medium capitalize">{transaction.paymentMethod}</span>
                </div>
              )}
              
              {transaction.createdAt && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-medium">{new Date(transaction.createdAt).toLocaleString()}</span>
                </div>
              )}
              
              <div className="flex justify-between">
                <span className="text-gray-500">Status:</span>
                <Badge 
                  className={
                    transaction.status === 'successful' ? 'bg-green-500' : 
                    transaction.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                  }
                >
                  {transaction.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          )}
          
          {!isVerifying && activePayment && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="text-green-700 font-medium mb-2">Active Package Information</h3>
              <p className="text-sm mb-2">
                You have an active <span className="font-semibold capitalize">{activePayment.packageType}</span> package.
              </p>
              <p className="text-sm">
                Valid until: <span className="font-semibold">{new Date(activePayment.validUntil).toLocaleString()}</span>
              </p>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-center space-x-4">
          <Button variant="outline" onClick={() => setLocation('/payments/history')}>
            Payment History
          </Button>
          
          {transaction?.status === 'successful' ? (
            <Button onClick={() => setLocation('/exam')}>
              Start Exam
            </Button>
          ) : transaction?.status === 'failed' ? (
            <Button onClick={() => setLocation('/')}>
              Try Again
            </Button>
          ) : (
            <Button onClick={() => setLocation('/')}>
              Home
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
