
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "@/components/ui/use-toast";

export function usePaymentStatus(txRef: string | null) {
  const [hasShownError, setHasShownError] = useState(false);
  
  return useQuery({
    queryKey: ["payment-status", txRef],
    queryFn: async () => {
      if (!txRef) return null;
      
      try {
        const response = await fetch(`/api/payments/status?tx_ref=${txRef}`);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      } catch (error) {
        // Only show the error toast once
        if (!hasShownError) {
          toast({
            title: "Payment Status Error",
            description: "Unable to verify payment status. Please try again later.",
            variant: "destructive",
          });
          setHasShownError(true);
        }
        
        // Return a structured error response instead of throwing
        return { 
          error: true,
          message: error instanceof Error ? error.message : "Unknown error" 
        };
      }
    },
    enabled: !!txRef,
    refetchInterval: 5000, // Poll every 5 seconds
    refetchOnWindowFocus: true,
    retry: 3,
  });
}
