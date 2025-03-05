
import React from "react";
import { toast } from "@/components/ui/use-toast";
import { useLocation } from "wouter";

export function usePaymentToasts() {
  const [location] = useLocation();
  
  React.useEffect(() => {
    // Parse URL parameters
    const searchParams = new URLSearchParams(window.location.search);
    const payment = searchParams.get("payment");
    const error = searchParams.get("error");
    const txRef = searchParams.get("tx_ref");
    
    if (payment === "success") {
      toast({
        title: "Payment Successful",
        description: "Your payment has been completed successfully.",
        variant: "default",
        className: "bg-green-50 border-green-200",
      });
      
      // Clean URL after showing toast
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, location.split("?")[0]);
      }
    }
    
    if (payment === "failed") {
      toast({
        title: "Payment Failed",
        description: "Your payment could not be processed. Please try again.",
        variant: "destructive",
      });
      
      // Clean URL after showing toast
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, location.split("?")[0]);
      }
    }
    
    if (error) {
      const errorMessage = {
        "missing_reference": "Transaction reference is missing.",
        "payment_not_found": "Payment record not found.",
        "update_failed": "Failed to update payment record.",
        "verification_failed": "Payment verification failed."
      }[error] || "An error occurred with your payment.";
      
      toast({
        title: "Payment Error",
        description: errorMessage,
        variant: "destructive",
      });
      
      // Clean URL after showing toast
      if (window.history.replaceState) {
        window.history.replaceState({}, document.title, location.split("?")[0]);
      }
    }
  }, [location]);
  
  return null;
}

export default function PaymentToastProvider({ children }: { children: React.ReactNode }) {
  usePaymentToasts();
  return <>{children}</>;
}
