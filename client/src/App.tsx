import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import ExamPage from "@/pages/exam-page";
import AdminPage from "@/pages/admin-page";
import ProfilePage from "@/pages/profile-page";
import PaymentSuccessPage from "@/pages/payment-success";
import ExamSimulationPage from "@/pages/exam-simulation-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/exam" component={ExamPage} />
      <ProtectedRoute path="/exam-simulation" component={ExamSimulationPage} />
      <ProtectedRoute path="/admin" component={AdminPage} adminOnly />
      <ProtectedRoute path="/profile" component={ProfilePage} />
      <ProtectedRoute path="/payment/success" component={PaymentSuccessPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;