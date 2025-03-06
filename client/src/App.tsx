import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthContext, AuthProvider } from "@/hooks/use-auth.tsx";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ExamPage from "@/pages/exam-page";
import AdminPage from "@/pages/admin-page";
import ProfilePage from "@/pages/profile-page";
import PaymentSuccessPage from "@/pages/payment-success";
import ExamSimulationPage from "@/pages/exam-simulation-page";
import { ProtectedRoute } from "./lib/protected-route";
import ProgressDashboard from "./pages/progress-dashboard";
import { useEffect } from "react";
import PaymentToastProvider from "@/components/notifications/payment-toast";
import ExamResultsPage from "./pages/exam-results-page";
import LandingPage from "@/pages/landing-page";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <ProtectedRoute path="/dashboard" component={HomePage} />
      <ProtectedRoute path="/exam" component={ExamPage} />
      <ProtectedRoute path="/exam-simulation" component={ExamSimulationPage} />
      <ProtectedRoute path="/progress" component={ProgressDashboard} />
      <ProtectedRoute path="/admin" component={AdminPage} adminOnly />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/payment/success" component={PaymentSuccessPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/exam-results/:id" component={ExamResultsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PaymentToastProvider>
          <Router />
          <Toaster />
        </PaymentToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}