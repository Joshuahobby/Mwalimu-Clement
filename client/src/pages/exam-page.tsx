import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Question, Exam } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { QuestionCard } from "@/components/exam/question-card";
import Timer from "@/components/exam/timer";
import { QuestionNavigation } from "@/components/exam/question-navigation";
import AccessibilitySettings from "@/components/exam/accessibility-settings";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExamData extends Exam {
  questions: number[];
  answers: number[] | null;
}

export default function ExamPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch current exam
  const { data: exam, isLoading: examLoading } = useQuery<ExamData>({
    queryKey: ["/api/exams/current"],
    retry: false,
    staleTime: 0
  });

  // Fetch questions based on exam data
  const { data: questions, isLoading: questionsLoading } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!exam && !exam.endTime
  });

  const startExamMutation = useMutation({
    mutationFn: async () => {
      const startTime = new Date();
      const response = await apiRequest("POST", "/api/exams", {
        questionCount: 20,
        startTime: startTime.toISOString(),
      });

      if (!response.ok) {
        throw new Error('Failed to start exam');
      }

      const data = await response.json();
      setExamStartTime(startTime);
      setAnswers(new Array(20).fill(-1));
      setShowConfirmation(false);
      setCurrentQuestionIndex(0);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/current"] });
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

      const submissionAnswers = [...answers];
      while (submissionAnswers.length < exam.questions.length) {
        submissionAnswers.push(-1);
      }

      const response = await apiRequest("PATCH", `/api/exams/${exam.id}`, {
        answers: submissionAnswers,
        endTime: new Date().toISOString(),
      });

      if (!response.ok) {
        throw new Error('Failed to submit exam');
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/current"] });
      setLocation(`/exam-results/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    toast({
      title: "Time's Up!",
      description: "Your exam time has expired. Your answers will be submitted automatically.",
      variant: "destructive",
    });

    setTimeout(() => {
      submitMutation.mutate();
    }, 2000);
  }, [submitMutation, toast]);

  const handleSubmit = () => {
    if (!exam) {
      toast({
        title: "Error",
        description: "No active exam found",
        variant: "destructive",
      });
      return;
    }

    const unansweredCount = answers.filter(a => a === -1).length;
    if (!isTimeUp && unansweredCount > 0) {
      setShowSubmitDialog(true);
      return;
    }

    submitMutation.mutate();
  };

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
            <DialogTitle>Ready to Start the Exam?</DialogTitle>
            <DialogDescription>
              You will have 20 minutes to complete 20 questions. The timer will start immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocation("/")}>
              I'm not ready
            </Button>
            <Button onClick={() => startExamMutation.mutate()}>
              Start Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const progress = answers.filter(a => a !== -1).length / answers.length * 100;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Question {currentQuestionIndex + 1}</CardTitle>
                {examStartTime && (
                  <Timer
                    startTime={examStartTime.toISOString()}
                    duration={20 * 60 * 1000}
                    onTimeUp={handleTimeUp}
                  />
                )}
              </div>
              <Progress value={progress} className="h-2" />
            </CardHeader>
            <CardContent>
              {questions && questions[currentQuestionIndex] && (
                <QuestionCard
                  question={questions[currentQuestionIndex]}
                  currentIndex={currentQuestionIndex}
                  totalQuestions={exam?.questions.length || 0}
                  selectedAnswer={answers[currentQuestionIndex]}
                  onAnswer={(answer) => {
                    const newAnswers = [...answers];
                    newAnswers[currentQuestionIndex] = answer;
                    setAnswers(newAnswers);
                  }}
                />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestionIndex(i => Math.max(0, i - 1))}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            <Button
              onClick={() => currentQuestionIndex === exam.questions.length - 1
                ? handleSubmit()
                : setCurrentQuestionIndex(i => i + 1)
              }
            >
              {currentQuestionIndex === exam.questions.length - 1 ? "Submit" : "Next"}
            </Button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <QuestionNavigation
                totalQuestions={exam.questions.length}
                currentQuestion={currentQuestionIndex}
                answers={answers}
                onQuestionSelect={setCurrentQuestionIndex}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Important</h3>
                    <p className="text-sm text-muted-foreground">
                      Make sure to review all questions before submitting.
                      Unanswered questions will be marked as incorrect.
                    </p>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "Submitting..." : "Submit Exam"}
                </Button>
              </div>
            </CardContent>
          </Card>
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
                : `You have ${answers.filter(a => a === -1).length} unanswered questions. Are you sure you want to submit?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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