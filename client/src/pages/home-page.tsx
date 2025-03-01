import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Payment, packagePrices } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Clock, CalendarDays, CreditCard, BookOpen, Wallet, Building } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

interface PaymentResponse {
  status: string;
  data: {
    link: string;
    tx_ref: string;
  };
}

type PaymentMethod = 'card' | 'mobilemoney' | 'banktransfer';

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [selectedPackage, setSelectedPackage] = useState<keyof typeof packagePrices | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: activePayment, isLoading: paymentLoading } = useQuery<Payment>({
    queryKey: ["/api/payments/active"],
    retry: false,
  });

  const handlePayment = async (packageType: keyof typeof packagePrices, paymentMethod: PaymentMethod) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);

      // Show info toast about OTP for mobile money
      if (paymentMethod === 'mobilemoney') {
        toast({
          title: "Mobile Money Payment",
          description: "You'll receive an OTP via SMS and WhatsApp to verify your payment.",
          duration: 5000,
        });
      }

      const response = await apiRequest("POST", "/api/payments", {
        packageType,
        paymentMethod
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate payment");
      }

      const data: PaymentResponse = await response.json();

      if (data.status === 'success' && data.data.link) {
        // Redirect to Flutterwave payment page
        window.location.href = data.data.link;
      } else {
        throw new Error("Invalid payment response");
      }
    } catch (error) {
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const paymentMethods = [
    {
      id: 'mobilemoney' as const,
      name: 'Mobile Money',
      icon: Wallet,
      description: 'Pay using MTN or Airtel Money (Requires OTP verification)',
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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