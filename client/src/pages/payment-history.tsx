
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, AlertTriangle, CheckCircle, Clock, X } from "lucide-react";
import { apiRequest } from '@/lib/api';

// Define payment status types
type PaymentStatus = 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';

interface Payment {
  id: number;
  userId: number;
  amount: number;
  packageType: string; 
  status: PaymentStatus;
  validUntil: string;
  createdAt: string;
  username: string;
  metadata?: {
    tx_ref: string;
    payment_method: string;
    retry_count?: number;
    last_retry?: string;
    verified_at?: string;
    verification_method?: string;
  };
}

export default function PaymentHistoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState<string>('mobilemoney');
  
  // Query to get payment history
  const { data: payments, isLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments/history"],
    enabled: !!user,
  });

  // Mutation for retrying a payment
  const retryPaymentMutation = useMutation({
    mutationFn: async ({paymentId, method}: {paymentId: number, method: string}) => {
      const response = await apiRequest('POST', '/api/payments/retry', {
        paymentId,
        paymentMethod: method
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to retry payment');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Redirect to Flutterwave checkout page
      if (data.data?.link) {
        window.location.href = data.data.link;
      } else {
        toast({
          title: "Payment Initiated",
          description: "You'll be redirected to complete your payment",
          variant: "default",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Payment Retry Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRetry = (paymentId: number) => {
    retryPaymentMutation.mutate({paymentId, method: paymentMethod});
  };

  // Helper function to format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Helper function to get status badge color
  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case 'failed':
        return <Badge className="bg-red-500"><X className="w-3 h-3 mr-1" /> Failed</Badge>;
      case 'refunded':
        return <Badge className="bg-blue-500"><RefreshCw className="w-3 h-3 mr-1" /> Refunded</Badge>;
      case 'expired':
        return <Badge className="bg-gray-500"><AlertTriangle className="w-3 h-3 mr-1" /> Expired</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container py-10 flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Payment History</h1>
        <p className="text-gray-500">View and manage your payment transactions</p>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        {['all', 'completed', 'pending', 'failed'].map(tab => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {!payments || payments.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-10">
                    <p className="text-gray-500">No payment records found</p>
                    <Button
                      onClick={() => setLocation('/')}
                      className="mt-4"
                    >
                      Make a Payment
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              payments
                .filter(payment => tab === 'all' || payment.status === tab)
                .map(payment => (
                  <Card key={payment.id} className="overflow-hidden">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="capitalize">
                            {payment.packageType} Package
                          </CardTitle>
                          <CardDescription>
                            {formatDate(payment.createdAt)}
                          </CardDescription>
                        </div>
                        {getStatusBadge(payment.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Amount:</p>
                          <p>{payment.amount} RWF</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Valid Until:</p>
                          <p>{formatDate(payment.validUntil)}</p>
                        </div>
                        {payment.metadata?.tx_ref && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Reference:</p>
                            <p className="text-xs">{payment.metadata.tx_ref}</p>
                          </div>
                        )}
                        {payment.metadata?.payment_method && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Payment Method:</p>
                            <p className="capitalize">{payment.metadata.payment_method}</p>
                          </div>
                        )}
                        {payment.metadata?.verified_at && (
                          <div>
                            <p className="text-sm font-medium text-gray-500">Verified At:</p>
                            <p>{formatDate(payment.metadata.verified_at)}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    {(payment.status === 'failed' || payment.status === 'pending') && (
                      <CardFooter className="bg-gray-50 border-t">
                        <div className="w-full flex flex-col sm:flex-row sm:items-center gap-3">
                          <p className="text-sm text-gray-500 flex-1">
                            Having problems? Try a different payment method.
                          </p>
                          <div className="flex gap-2 flex-col sm:flex-row">
                            <Select defaultValue={paymentMethod} onValueChange={setPaymentMethod}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Payment Method" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mobilemoney">Mobile Money</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="banktransfer">Bank Transfer</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button 
                              onClick={() => handleRetry(payment.id)}
                              disabled={retryPaymentMutation.isPending}
                            >
                              {retryPaymentMutation.isPending && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Retry Payment
                            </Button>
                          </div>
                        </div>
                      </CardFooter>
                    )}
                  </Card>
                ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
