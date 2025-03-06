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
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, Info } from "lucide-react";
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
  const [examStartTime, setExamStartTime] = useState<Date | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Fetch current exam
  const { data: exam, isLoading: examLoading, error: examError } = useQuery<Exam>({
    queryKey: ["/api/exams/current"],
    retry: false,
    staleTime: 0,
    onSuccess: (data) => {
      if (data && !data.endTime) {
        // Ensure answers array is initialized correctly
        const answersArray = data.answers || new Array(data.questions.length).fill(-1);
        setAnswers(answersArray);
        setExamStartTime(new Date(data.startTime));
      }
    }
  });

  // Fetch questions based on exam data
  const { data: questions, isLoading: questionsLoading, error: questionsError } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
    enabled: !!exam && !exam.endTime,
    staleTime: 0
  });

  const startExamMutation = useMutation({
    mutationFn: async () => {
      const startTime = new Date();
      const res = await apiRequest("POST", "/api/exams", {
        questionCount: 20,
        startTime: startTime.toISOString(),
      });
      if (!res.ok) {
        throw new Error('Failed to start exam');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/exams/current"] });
      setAnswers(new Array(20).fill(-1));
      setShowConfirmation(false);
      setCurrentQuestionIndex(0);
      setExamStartTime(new Date(data.startTime));
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

      // Ensure answers array matches the questions length
      const submissionAnswers = [...answers];
      while (submissionAnswers.length < exam.questions.length) {
        submissionAnswers.push(-1); // Fill unanswered questions with -1
      }

      const res = await apiRequest("PATCH", `/api/exams/${exam.id}`, {
        answers: submissionAnswers,
        endTime: new Date().toISOString(),
      });
      if (!res.ok) {
        throw new Error('Failed to submit exam');
      }
      return res.json();
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

  const handleTimeUp = () => {
    setIsTimeUp(true);
    setShowSubmitDialog(true);
  };

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

  // Handle timer completion
  const handleTimeUp = useCallback(() => {
    setIsTimeUp(true);
    toast({
      title: "Time's Up!",
      description: "Your exam time has expired. Your answers will be submitted automatically.",
      variant: "destructive",
    });
    
    // Give the user a moment to see the message before submitting
    setTimeout(() => {
      submitMutation.mutate();
    }, 2000);
  }, [submitMutation]);

  // Calculate progress - Fix NaN% issue
  const progress = answers && answers.length > 0
    ? Math.round((answers.filter(a => a !== -1).length / answers.length) * 100)
    : 0;

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

  // Show error states
  if (examError || questionsError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          {examError ? "Failed to load exam" : "Failed to load questions"}
        </h1>
        <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
      </div>
    );
  }

  // Import components
  import { Timer } from '../components/exam/timer';
  import { QuestionNavigation } from '../components/exam/question-navigation';
  import { QuestionCard } from '../components/exam/question-card';
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Main exam content */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold">Driving Theory Exam</h1>
            <Timer 
              initialTimeInMinutes={30} 
              onTimeUp={handleTimeUp}
              className="ml-auto"
            />
          </div>
          
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Completion Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
          
          {/* Current question */}
          {exam && questionDetails && (
            <QuestionCard
              question={questionDetails}
              currentIndex={currentQuestionIndex}
              totalQuestions={exam.questions.length}
              selectedAnswer={answers[currentQuestionIndex]}
              onAnswerSelect={(value) => handleAnswerSelect(value)}
            />
          )}
          
          {/* Navigation buttons */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={handlePreviousQuestion}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </Button>
            
            {currentQuestionIndex < (exam?.questions.length || 0) - 1 ? (
              <Button onClick={handleNextQuestion}>
                Next
              </Button>
            ) : (
              <Button 
                variant="default" 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleSubmit}
              >
                Submit Exam
              </Button>
            )}
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-4">
          <QuestionNavigation
            totalQuestions={exam?.questions.length || 0}
            currentQuestion={currentQuestionIndex}
            answers={answers}
            onQuestionSelect={(index) => setCurrentQuestionIndex(index)}
          />
          
          <Card>
            <CardContent className="p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Answered:</span>
                  <span className="font-medium">{answers.filter(a => a !== -1).length} / {answers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Remaining:</span>
                  <span className="font-medium">{answers.filter(a => a === -1).length}</span>
                </div>
              </div>
              
              <Button 
                variant="destructive" 
                className="w-full mt-4"
                onClick={handleSubmit}
              >
                Finish Exam
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Confirmation dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Exam</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>You have {answers.filter(a => a === -1).length} unanswered questions. Are you sure you want to submit?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Continue Exam</Button>
            <Button 
              variant="default" 
              onClick={() => {
                setShowSubmitDialog(false);
                submitMutation.mutate();
              }}
            >
              Submit Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Show confirmation dialog when there's no active exam
  if (!exam || exam.endTime) {
    return (
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you ready to start this exam?</DialogTitle>
            <DialogDescription>
              You will have 20 minutes to complete this exam. Once you start, the timer cannot be paused.
              If you are not ready, please click on 'I am not ready'. Otherwise click on 'I want to start'.
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
            <div className="flex items-center gap-4 w-full md:w-auto">
              {examStartTime && (
                <Card className="flex-1 md:flex-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold">Time Remaining</h3>
                    </div>
                    <Timer
                      startTime={examStartTime.toISOString()}
                      duration={20 * 60 * 1000}
                      onTimeUp={handleTimeUp}
                    />
                  </CardContent>
                </Card>
              )}
              <AccessibilitySettings />
            </div>

            <Card className="w-full md:w-auto">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Progress</h3>
                </div>
                <div className="flex items-center gap-4">
                  <Progress value={progress} className="w-[200px]" />
                  <span className="text-sm font-medium">
                    {progress}% Complete
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {answers?.filter(a => a !== -1).length || 0} of {answers?.length || 0} questions answered
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Question counter */}
          <div className="text-sm text-muted-foreground mb-4">
            Question {currentQuestionIndex + 1} of {exam?.questions.length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="md:col-span-2">
            <Card className="mb-6">
              <CardContent className="p-6">
                {currentQuestion && (
                  <QuestionCard
                    question={currentQuestion}
                    selectedAnswer={answers[currentQuestionIndex]}
                    onAnswer={(answerIndex) => {
                      setAnswers(prev => {
                        const newAnswers = [...prev];
                        newAnswers[currentQuestionIndex] = answerIndex;
                        return newAnswers;
                      });
                    }}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex justify-between gap-4">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(i => i - 1)}
                disabled={currentQuestionIndex === 0}
                className="w-[120px]"
              >
                Previous
              </Button>
              <Button
                onClick={() => setCurrentQuestionIndex(i => i + 1)}
                disabled={currentQuestionIndex === exam.questions.length - 1}
                className="w-[120px]"
              >
                Next
              </Button>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Question Navigator</h3>
                <QuestionNavigation
                  totalQuestions={exam.questions.length}
                  currentQuestion={currentQuestionIndex}
                  answers={answers}
                  onQuestionSelect={setCurrentQuestionIndex}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-3 mb-4">
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
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
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