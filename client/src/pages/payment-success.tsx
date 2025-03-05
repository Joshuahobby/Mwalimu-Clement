import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { useLocation } from 'wouter';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAuth } from '@/hooks/use-auth';
import { CheckCircle, BookOpen, Trophy, Timer, ArrowRight } from "lucide-react";

interface PaymentJourney {
  status: 'initial' | 'exam_started' | 'practice_completed' | 'exam_completed';
  exam_started_at?: string;
  practice_completed_at?: string;
  exam_completed_at?: string;
  last_activity_at?: string;
  total_questions_attempted?: number;
  correct_answers?: number;
  time_spent_minutes?: number;
}

interface Payment {
  id: number;
  packageType: string;
  amount: number;
  validUntil: string;
  metadata?: {
    journey?: PaymentJourney;
  };
}

export default function PaymentSuccessPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: payment, isLoading } = useQuery<Payment>({
    queryKey: ['/api/payments/active'],
    enabled: !!user,
  });

  const getJourneyProgress = (journey?: PaymentJourney) => {
    if (!journey) return 0;
    switch (journey.status) {
      case 'exam_completed': return 100;
      case 'practice_completed': return 75;
      case 'exam_started': return 50;
      case 'initial': return 25;
      default: return 0;
    }
  };

  const getNextStep = (journey?: PaymentJourney) => {
    if (!journey) {
      return {
        title: "Start Your Journey",
        description: "Begin with practice questions to prepare for your exam",
        action: "Start Practice",
        route: "/practice"
      };
    }

    switch (journey.status) {
      case 'initial':
        return {
          title: "Begin Practice Session",
          description: "Start with practice questions to build confidence",
          action: "Start Practice",
          route: "/practice"
        };
      case 'exam_started':
        return {
          title: "Complete Practice Tests",
          description: "Finish your practice tests to ensure you're ready",
          action: "Continue Practice",
          route: "/practice"
        };
      case 'practice_completed':
        return {
          title: "Take the Final Exam",
          description: "You're ready! Take the final exam now",
          action: "Start Exam",
          route: "/exam"
        };
      case 'exam_completed':
        return {
          title: "View Your Results",
          description: "Check your exam results and get your certificate",
          action: "View Results",
          route: "/results"
        };
      default:
        return {
          title: "Start Your Journey",
          description: "Begin with practice questions",
          action: "Start Practice",
          route: "/practice"
        };
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!payment) {
    return <div>No active payment found</div>;
  }

  const journey = payment.metadata?.journey;
  const nextStep = getNextStep(journey);
  const progress = getJourneyProgress(journey);

  return (
    <div className="container max-w-4xl py-10">
      <Card className="w-full">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <CardTitle className="text-2xl">Payment Successful!</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            {/* Package Information */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Package Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <p className="font-medium capitalize">{payment.packageType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Valid Until</p>
                  <p className="font-medium">
                    {new Date(payment.validUntil).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress Section */}
            <div className="space-y-4">
              <h3 className="font-semibold">Your Progress</h3>
              <Progress value={progress} className="h-2" />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                {journey?.total_questions_attempted && (
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {journey.total_questions_attempted} Questions
                      </p>
                      <p className="text-xs text-gray-500">Attempted</p>
                    </div>
                  </div>
                )}
                
                {journey?.correct_answers && (
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {journey.correct_answers} Correct
                      </p>
                      <p className="text-xs text-gray-500">Answers</p>
                    </div>
                  </div>
                )}
                
                {journey?.time_spent_minutes && (
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {journey.time_spent_minutes} Minutes
                      </p>
                      <p className="text-xs text-gray-500">Time Spent</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Next Steps Section */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
              <h3 className="font-semibold mb-2 text-blue-800">{nextStep.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{nextStep.description}</p>
              <Button 
                onClick={() => setLocation(nextStep.route)}
                className="w-full md:w-auto primary-button"
              >
                {nextStep.action} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => setLocation('/payments/history')}>
            Payment History
          </Button>
          <Button variant="outline" onClick={() => setLocation('/')}>
            Back to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
