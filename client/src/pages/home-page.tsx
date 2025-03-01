import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Payment, packagePrices } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Clock, CalendarDays, CreditCard, BookOpen } from "lucide-react";
import { FlutterWaveButton } from 'flutterwave-react-v3';

interface FlutterwaveResponse {
  status: string;
  message: string;
  data?: {
    id: string;
    tx_ref: string;
    amount: number;
    currency: string;
    status: string;
  };
}

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: activePayment, isLoading: paymentLoading } = useQuery<Payment>({
    queryKey: ["/api/payments/active"],
    retry: false,
  });

  const getFlutterwaveConfig = (packageType: keyof typeof packagePrices) => ({
    public_key: import.meta.env.VITE_FLUTTERWAVE_PUBLIC_KEY,
    tx_ref: `DRV_${Date.now()}_${user?.id}`,
    amount: packagePrices[packageType],
    currency: 'RWF',
    payment_options: 'mobilemoney',
    customer: {
      email: 'customer@example.com', // Valid test email
      phone_number: '250784123456', // Valid test Rwanda number
      name: user?.displayName || user?.username || 'Customer',
    },
    customizations: {
      title: 'MWALIMU Clement',
      description: `Payment for ${packageType} package`,
      logo: '', // Add your logo URL here
    },
    meta: {
      user_id: user?.id,
      package_type: packageType,
    },
  });

  const handlePaymentCallback = (response: FlutterwaveResponse, packageType: keyof typeof packagePrices) => {
    if (response.status === 'successful') {
      toast({
        title: "Payment successful",
        description: "Your payment has been processed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/active"] });
      setLocation("/exam");
    } else {
      toast({
        title: "Payment failed",
        description: response.message || "Failed to process payment",
        variant: "destructive",
      });
    }
  };

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
            <Card>
              <CardHeader>
                <CardTitle>Practice Mode</CardTitle>
                <CardDescription>
                  Try our interactive exam simulation mode
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button
                  variant="secondary"
                  onClick={() => setLocation("/exam-simulation")}
                  className="flex items-center gap-2"
                >
                  <BookOpen className="h-4 w-4" />
                  Start Practice Mode
                </Button>
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
                <FlutterWaveButton
                  {...getFlutterwaveConfig(pkg.type)}
                  text="Purchase"
                  className="w-full"
                  callback={(response) => handlePaymentCallback(response, pkg.type)}
                  onClose={() => console.log("Payment modal closed")}
                />
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}