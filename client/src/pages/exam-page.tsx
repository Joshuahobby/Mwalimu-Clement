import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Question, Exam } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QuestionCard from "@/components/exam/question-card";
import Timer from "@/components/exam/timer";
import QuestionNavigation from "@/components/exam/question-navigation";
import AccessibilitySettings from "@/components/exam/accessibility-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ExamPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch current exam
  const { data: exam, isLoading: examLoading } = useQuery<Exam>({
    queryKey: ["/api/exams/current"],
    retry: false,
  });

  // Fetch questions based on exam data
  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!exam && !exam.endTime,
  });

  const startExamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/exams", {
        questionCount: 20, // Always 20 questions
      });
      if (!res.ok) {
        throw new Error('Failed to start exam');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/current"] });
      setAnswers(new Array(20).fill(-1)); // Initialize answers array with -1 (unanswered)
      setShowConfirmation(false);
      setCurrentQuestionIndex(0);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!exam) throw new Error('No active exam');
      const res = await apiRequest("PATCH", `/api/exams/${exam.id}`, {
        answers,
        endTime: new Date().toISOString(),
      });
      if (!res.ok) {
        throw new Error('Failed to submit exam');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/current"] });
      const score = (data.correctAnswers / 20) * 100;
      const passed = data.correctAnswers >= 12;
      setLocation("/");
      toast({
        title: passed ? "Congratulations!" : "Exam Completed",
        description: `You scored ${score}% (${data.correctAnswers}/20). ${passed ? "You have passed!" : "You need 12 marks to pass."}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (exam && !exam.endTime) {
      setAnswers(new Array(exam.questions.length).fill(-1));
    }
  }, [exam]);

  // Show loading state
  if (examLoading || questionsLoading || startExamMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading your exam...</p>
        </div>
      </div>
    );
  }

  // Show confirmation dialog when there's no active exam
  if (!exam || exam.endTime) {
    return (
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you ready to start this exam?</DialogTitle>
            <DialogDescription>
              If you are not ready, please click on 'I am not ready'. Otherwise click on 'I want to start'.
              Then you will be clicking on (Next) to go to the next question and (Previous) to go back to previous questions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            <Button variant="outline" onClick={() => setLocation("/")}>
              I am not ready
            </Button>
            <Button onClick={() => startExamMutation.mutate()}>
              I want to start
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Make sure we have questions loaded
  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading questions...</p>
        </div>
      </div>
    );
  }

  const currentQuestion = questions.find(q => q.id === exam.questions[currentQuestionIndex]);

  if (!currentQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold mb-4">Question Not Found</h1>
        <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
      </div>
    );
  }

  const handleAnswer = (answerIndex: number) => {
    setAnswers(prev => {
      const newAnswers = [...prev];
      newAnswers[currentQuestionIndex] = answerIndex;
      return newAnswers;
    });
  };

  const handleTimeUp = () => {
    setIsTimeUp(true);
    setShowSubmitDialog(true);
  };

  const handleSubmit = () => {
    // Check if all questions are answered
    const unansweredCount = answers.filter(a => a === -1).length;
    if (!isTimeUp && unansweredCount > 0) {
      toast({
        title: "Warning",
        description: `You have ${unansweredCount} unanswered questions. Are you sure you want to submit?`,
        variant: "destructive",
      });
      setShowSubmitDialog(true);
      return;
    }
    submitMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <Timer 
            startTime={new Date(exam.startTime)}
            duration={20 * 60 * 1000} // 20 minutes
            onTimeUp={handleTimeUp}
          />
          <AccessibilitySettings />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <QuestionCard
              question={currentQuestion}
              selectedAnswer={answers[currentQuestionIndex]}
              onAnswer={handleAnswer}
            />

            <div className="flex justify-between mt-4">
              <Button
                onClick={() => setCurrentQuestionIndex(i => i - 1)}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentQuestionIndex(i => i + 1)}
                disabled={currentQuestionIndex === exam.questions.length - 1}
              >
                Next
              </Button>
            </div>
          </div>

          <div>
            <QuestionNavigation
              totalQuestions={exam.questions.length}
              currentQuestion={currentQuestionIndex}
              answers={answers}
              onQuestionSelect={setCurrentQuestionIndex}
            />

            <Button
              className="w-full mt-4"
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Exam"}
            </Button>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isTimeUp ? "Time's Up!" : "Confirm Submission"}
            </DialogTitle>
            <DialogDescription>
              {isTimeUp 
                ? "Your time is up. Your exam will be submitted now."
                : "Are you sure you want to submit your exam? This action cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between">
            {!isTimeUp && (
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>
                Continue Exam
              </Button>
            )}
            <Button 
              onClick={() => {
                setShowSubmitDialog(false);
                submitMutation.mutate();
              }}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "Submitting..." : "Submit Exam"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}