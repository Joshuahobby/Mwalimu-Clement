import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Payment, packagePrices } from "@shared/schema";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { Clock, CalendarDays, CreditCard, BookOpen } from "lucide-react";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: activePayment } = useQuery<Payment>({
    queryKey: ["/api/payments/active"],
    retry: false,
  });

  const paymentMutation = useMutation({
    mutationFn: async (packageType: keyof typeof packagePrices) => {
      const res = await apiRequest("POST", "/api/payments", { packageType });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments/active"] });
      setLocation("/exam");
    },
    onError: (error: Error) => {
      toast({
        title: "Payment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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
                <Button
                  className="w-full"
                  onClick={() => paymentMutation.mutate(pkg.type)}
                  disabled={paymentMutation.isPending}
                >
                  Purchase
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}