import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Payment, packagePrices } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from "wouter";
import { useQueryParams } from '@/hooks/use-query-params';
import { Clock, CalendarDays, CreditCard, BookOpen, Wallet, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState, useEffect } from "react";

interface PaymentResponse {
  status: string;
  data: {
    link: string;
    tx_ref: string;
  };
  meta?: {
    tx_ref: string;
  };
}

type PaymentMethod = 'card' | 'mobilemoney' | 'banktransfer';

export default function HomePage() {
  const queryClient = useQueryClient();
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const params = useQueryParams();
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof packagePrices | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Check for payment success parameter
  useEffect(() => {
    // Check for payment success in URL parameters
    const paymentStatus = params.get('payment');
    const txRef = params.get('tx_ref');

    if (paymentStatus === 'success' && txRef) {
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated. You can now access your exams.",
        variant: "default",
        duration: 5000,
      });

      // Fetch active payment to update UI
      queryClient.invalidateQueries(['/api/payments/active']);

      // Clean URL parameters without refreshing the page
      window.history.replaceState({}, document.title, '/');
    }
  }, [params, toast, queryClient]);

  // Handle payment status messages
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const paymentStatus = searchParams.get('payment');
    const error = searchParams.get('error');

    if (paymentStatus === 'success') {
      toast({
        title: "Payment Successful",
        description: "Your payment has been processed successfully.",
        variant: "default",
      });

      // Invalidate the active payment query to refresh the data
      queryClient.invalidateQueries({ queryKey: ["/api/payments/active"] });
    } else if (paymentStatus === 'failed') {
      toast({
        title: "Payment Failed",
        description: "Your payment could not be processed. Please try again.",
        variant: "destructive",
      });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        missing_reference: "Payment reference not found.",
        payment_not_found: "Payment record not found.",
        verification_failed: "Could not verify payment status.",
      };

      toast({
        title: "Payment Error",
        description: errorMessages[error] || "An error occurred during payment.",
        variant: "destructive",
      });
    }
  }, [params, toast]);

  const { data: activePayment, isLoading: paymentLoading } = useQuery({
    queryKey: ['/api/payments/active'],
    enabled: !!user,
    retry: 2,
    // Don't show error notifications for missing subscription
    onError: () => {}
  });

  const handlePayment = async (packageType: keyof typeof packagePrices, paymentMethod: PaymentMethod) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      // Show info toast about OTP for mobile money
      if (paymentMethod === 'mobilemoney') {
        toast({
          title: "Mobile Money Payment (Test Mode)",
          description: "Since this is test mode, enter '123456' as the OTP in the next screen. This is the test OTP that works in Flutterwave's test environment.",
          variant: "default",
          duration: 10000,
        });
      }

      const response = await apiRequest('POST', '/api/payments', {
        packageType,
        paymentMethod
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle missing email error
        if (errorData.code === "EMAIL_REQUIRED") {
          toast({
            title: "Email Required",
            description: "Please update your profile with a valid email address before making a payment.",
            variant: "destructive",
            duration: 5000,
          });
          // Redirect to profile page
          setLocation("/profile");
          return;
        }

        throw new Error(errorData.message || 'Failed to process payment');
      }

      const paymentResponse: PaymentResponse = await response.json();

      // Store the tx_ref in localStorage for later verification
      if (paymentResponse.meta?.tx_ref) {
        localStorage.setItem('pending_payment_tx_ref', paymentResponse.meta.tx_ref);
        localStorage.setItem('pending_payment_time', new Date().toISOString());
      }

      // Show success toast before redirect
      toast({
        title: "Payment Initiated",
        description: "You'll be redirected to complete your payment",
        variant: "default",
        duration: 3000,
      });

      // Redirect to Flutterwave checkout page
      if (paymentResponse.data?.link) {
        window.location.href = paymentResponse.data.link;
      } else {
        // If no redirect link (which shouldn't happen), go to payment status page
        setLocation(`/payment/status?tx_ref=${paymentResponse.meta?.tx_ref}`);
      }

      setIsProcessing(false);
    } catch (error) {
      setIsProcessing(false);
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
    }
  };

  // Poll for payment status updates when there's a pending payment
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tx_ref = searchParams.get('tx_ref');

    if (!tx_ref) return;

    let pollingInterval: NodeJS.Timeout;
    let attempts = 0;
    const maxAttempts = 10;

    const checkPaymentStatus = async () => {
      try {
        const response = await apiRequest('GET', `/api/payments/status?tx_ref=${tx_ref}`);

        if (response.ok) {
          const data = await response.json();

          if (data.payment && data.payment.status === 'completed') {
            clearInterval(pollingInterval);
            // Payment is active, show success message
            toast({
              title: "Payment Successful",
              description: "Your payment has been processed successfully!",
              variant: "default",
            });

            // Remove tx_ref from URL
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
            return;
          }

          if (data.transaction && data.transaction.status === 'successful') {
            clearInterval(pollingInterval);
            // Transaction is verified but payment record needs updating
            toast({
              title: "Payment Verified",
              description: "Your payment has been verified!",
              variant: "default",
            });

            // Refresh the page to get updated state
            window.location.href = '/';
            return;
          }
        }

        // Continue polling until max attempts reached
        attempts++;
        if (attempts >= maxAttempts) {
          clearInterval(pollingInterval);
          toast({
            title: "Payment Verification Timeout",
            description: "We couldn't verify your payment. Please check your payment status in your account.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        attempts++;
      }
    };

    // Start polling for payment status
    pollingInterval = setInterval(checkPaymentStatus, 3000);

    // Clean up interval on component unmount
    return () => clearInterval(pollingInterval);
  }, [params, toast]);


  const paymentMethods = [
    {
      id: 'mobilemoney' as const,
      name: 'Mobile Money',
      icon: Wallet,
      description: 'Pay using MTN or Airtel Money (Test Mode - Use OTP: 123456)',
      color: 'green-500'
    },
    {
      id: 'card' as const,
      name: 'Card Payment',
      icon: CreditCard,
      description: 'Pay with Visa or Mastercard',
      color: 'blue-500'
    },
    {
      id: 'banktransfer' as const,
      name: 'Bank Transfer',
      icon: Building,
      description: 'Pay via bank transfer',
      color: 'purple-500'
    }
  ];

  const packages = [
    {
      type: "single" as const,
      title: "Single Exam",
      price: packagePrices.single,
      description: "Access to one full exam",
      icon: CreditCard,
    },
    {
      type: "daily" as const,
      title: "Daily Access",
      price: packagePrices.daily,
      description: "24 hours of unlimited exams",
      icon: Clock,
    },
    {
      type: "weekly" as const,
      title: "Weekly Access",
      price: packagePrices.weekly,
      description: "7 days of unlimited exams",
      icon: CalendarDays,
    },
    {
      type: "monthly" as const,
      title: "Monthly Access",
      price: packagePrices.monthly,
      description: "30 days of unlimited exams",
      icon: CalendarDays,
    },
  ];

  // Query for getting questions data
  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ['/api/questions'],
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">MWALIMU Clement</h1>
          <div className="flex items-center gap-4">
            <span>Welcome, {user?.username}</span>
            <Button variant="outline" onClick={() => logoutMutation.mutate()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Active Subscription Banner */}
        {activePayment && (
          <Card className="mb-6 bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-semibold">Active Subscription</h3>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium capitalize">{activePayment.packageType} Package</span> - 
                    Valid until {new Date(activePayment.validUntil).toLocaleDateString()}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  className="bg-white" 
                  onClick={() => setLocation('/exam')}
                >
                  Start Exam
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activePayment ? (
          <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Subscription</CardTitle>
                <CardDescription>
                  Valid until {new Date(activePayment.validUntil).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button onClick={() => setLocation("/exam")}>Start New Exam</Button>
              </CardFooter>
            </Card>
          </div>
        ) : (
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Choose Your Package</h2>
            <p className="text-muted-foreground">
              Select a package to start practicing for your theory exam
            </p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {packages.map((pkg) => (
            <Card key={pkg.type}>
              <CardHeader>
                <pkg.icon className="h-8 w-8 mb-4" />
                <CardTitle>{pkg.title}</CardTitle>
                <CardDescription>{pkg.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{pkg.price} RWF</p>
              </CardContent>
              <CardFooter>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full"
                      onClick={() => setSelectedPackage(pkg.type)}
                      disabled={isProcessing}
                    >
                      {isProcessing ? "Processing..." : "Purchase"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle className="text-center text-xl font-bold">Choose Payment Method</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      {paymentMethods.map((method) => (
                        <Button
                          key={method.id}
                          variant="outline"
                          className={`w-full flex items-center gap-3 justify-start p-4 transition-all duration-200 ease-in-out hover:scale-[1.02] hover:shadow-lg hover:border-2 hover:border-${method.color} group`}
                          onClick={() => handlePayment(pkg.type, method.id)}
                          disabled={isProcessing}
                        >
                          <div className={`p-2 rounded-full bg-background group-hover:bg-${method.color}/10 transition-colors duration-200`}>
                            <method.icon className={`h-6 w-6 ${method.color} group-hover:scale-110 transition-transform duration-200`} />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold group-hover:text-primary transition-colors duration-200">
                              {method.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {method.description}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}