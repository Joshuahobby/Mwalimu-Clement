import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth.tsx";
import { useLocation } from "wouter";
import { MainNavigation } from "@/components/MainNavigation";
import {
  Shield,
  Book,
  Clock,
  Award,
  CheckCircle,
  ChevronRight,
  Users,
  Brain,
  Star,
  Zap,
  BarChart
} from "lucide-react";

export default function LandingPage() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const features = [
    {
      icon: <Shield className="h-8 w-8 text-primary" />,
      title: "Official RNP Approved",
      description: "Authorized and recognized by Rwanda National Police for theory exam preparation"
    },
    {
      icon: <Book className="h-8 w-8 text-primary" />,
      title: "Comprehensive Content",
      description: "Complete coverage of all traffic rules, signs, and regulations"
    },
    {
      icon: <Clock className="h-8 w-8 text-primary" />,
      title: "Real Exam Simulation",
      description: "Practice with timed tests that mirror the actual exam format"
    },
    {
      icon: <Brain className="h-8 w-8 text-primary" />,
      title: "AI-Powered Learning",
      description: "Smart analytics to identify and improve your weak areas"
    }
  ];

  const testimonials = [
    {
      name: "Jean Paul",
      role: "Successful Candidate",
      content: "Passed my theory test on the first try thanks to this platform!",
      rating: 5
    },
    {
      name: "Marie Claire",
      role: "Driving School Instructor",
      content: "The best preparation tool for my students. The results speak for themselves.",
      rating: 5
    },
    {
      name: "Emmanuel",
      role: "New Driver",
      content: "The practice tests really helped me understand the rules better.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <MainNavigation />

      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-primary/5 via-background to-background pt-20 pb-32">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Master Your Driving Theory Test
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Rwanda's most advanced platform for Traffic Police Theory Exam preparation. 
              Practice, learn, and succeed with AI-powered guidance.
            </p>
            <div className="flex gap-4 justify-center">
              {!user ? (
                <>
                  <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary hover:bg-primary/90">
                    Start Free Trial <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate("/auth?mode=login")}>
                    Sign In
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={() => navigate("/dashboard")} className="bg-primary hover:bg-primary/90">
                  Continue Learning <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="container mx-auto px-4 mt-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="backdrop-blur-sm bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Users className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">10,000+</p>
                    <p className="text-muted-foreground">Active Learners</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-sm bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <CheckCircle className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">95%</p>
                    <p className="text-muted-foreground">Pass Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="backdrop-blur-sm bg-white/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <Award className="h-8 w-8 text-primary" />
                  <div>
                    <p className="text-3xl font-bold">#1</p>
                    <p className="text-muted-foreground">Rated Platform</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-24">
        <h2 className="text-3xl font-bold text-center mb-4">Why Choose Our Platform?</h2>
        <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
          Experience the most comprehensive and effective way to prepare for your driving theory test
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-none shadow-none hover:bg-accent transition-colors">
              <CardHeader>
                <div className="mb-4 rounded-full bg-primary/10 w-16 h-16 flex items-center justify-center">
                  {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

      {/* Testimonials Section */}
      <div className="bg-slate-50 dark:bg-slate-900 py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-4">What Our Users Say</h2>
          <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
            Join thousands of successful drivers who have mastered their theory test with our platform
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="backdrop-blur-sm bg-white/5">
                <CardContent className="pt-6">
                  <div className="flex mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                    ))}
                  </div>
                  <p className="text-lg mb-4">{testimonial.content}</p>
                  <div>
                    <p className="font-semibold">{testimonial.name}</p>
                    <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary/5 py-24">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Start Your Journey?</h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join thousands of successful drivers who have mastered their theory test with our platform.
          </p>
          {!user ? (
            <Button size="lg" onClick={() => navigate("/auth")} className="bg-primary hover:bg-primary/90">
              Start Free Trial <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={() => navigate("/dashboard")} className="bg-primary hover:bg-primary/90">
              Take Practice Test <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}