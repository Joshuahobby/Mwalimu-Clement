import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Question, ExamSimulation, insertExamSimulationSchema } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/use-auth";
import { Timer, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

export default function ExamSimulationPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeSimulation, setActiveSimulation] = useState<ExamSimulation | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  // Get all available questions
  const { data: questions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  // Get active simulation if exists
  const { data: simulation, refetch: refetchSimulation } = useQuery<ExamSimulation>({
    queryKey: ["/api/simulations/active"],
    enabled: !!user,
  });

  const form = useForm({
    resolver: zodResolver(insertExamSimulationSchema),
    defaultValues: {
      timePerQuestion: 60,
      showFeedback: true,
      showTimer: true,
      allowSkip: true,
      allowReview: true,
    },
  });

  // Start new simulation
  const startSimulationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/simulations", {
        ...data,
        questions: questions?.map(q => q.id) || [],
        userId: user?.id,
        startTime: new Date().toISOString(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveSimulation(data);
      refetchSimulation();
      toast({
        title: "Simulation started",
        description: "Good luck with your exam!",
      });
    },
  });

  // Submit answer
  const submitAnswerMutation = useMutation({
    mutationFn: async ({ questionId, answer }: { questionId: number; answer: number }) => {
      const res = await apiRequest("POST", `/api/simulations/${activeSimulation?.id}/answer`, {
        questionId,
        answer,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/simulations/active"] });
      if (showFeedback) {
        setShowFeedback(true);
      } else {
        handleNextQuestion();
      }
    },
  });

  // Timer effect
  useEffect(() => {
    if (!activeSimulation?.timePerQuestion || !activeSimulation.showTimer) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSimulation, currentQuestion]);

  // Load current question
  useEffect(() => {
    if (!activeSimulation || !questions) return;

    const question = questions.find(
      (q) => q.id === activeSimulation.questions[activeSimulation.currentQuestionIndex]
    );
    setCurrentQuestion(question || null);
    setTimeLeft(activeSimulation.timePerQuestion);
    setSelectedAnswer(null);
    setShowFeedback(false);
  }, [activeSimulation, questions]);

  const handleNextQuestion = () => {
    if (!activeSimulation) return;

    const nextIndex = activeSimulation.currentQuestionIndex + 1;
    if (nextIndex >= activeSimulation.questions.length) {
      // End simulation
      apiRequest("POST", `/api/simulations/${activeSimulation.id}/complete`);
      setActiveSimulation(null);
      toast({
        title: "Simulation completed",
        description: "You've completed all questions!",
      });
    } else {
      // Move to next question
      apiRequest("PATCH", `/api/simulations/${activeSimulation.id}`, {
        currentQuestionIndex: nextIndex,
      }).then(() => refetchSimulation());
    }
  };

  if (!user) return null;

  if (!activeSimulation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Start Exam Simulation</CardTitle>
            <CardDescription>
              Configure your practice exam settings and begin the simulation
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) => startSimulationMutation.mutate(data))}
                className="space-y-6"
              >
                <FormField
                  control={form.control}
                  name="timePerQuestion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time per Question (seconds)</FormLabel>
                      <FormControl>
                        <input
                          type="number"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          min={30}
                          max={300}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="showTimer"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Show Timer</FormLabel>
                        <FormDescription>Display countdown timer for each question</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="showFeedback"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Show Feedback</FormLabel>
                        <FormDescription>Show correct/incorrect feedback after each answer</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowSkip"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Allow Skip</FormLabel>
                        <FormDescription>Allow skipping questions</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowReview"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel>Allow Review</FormLabel>
                        <FormDescription>Allow reviewing answers before submission</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={startSimulationMutation.isPending}
                >
                  Start Simulation
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Question {activeSimulation.currentQuestionIndex + 1}</CardTitle>
            {activeSimulation.showTimer && (
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4" />
                <span>{timeLeft}s</span>
              </div>
            )}
          </div>
          <Progress
            value={
              ((activeSimulation.currentQuestionIndex + 1) / activeSimulation.questions.length) * 100
            }
            className="h-2"
          />
        </CardHeader>
        <CardContent>
          {currentQuestion && (
            <div className="space-y-6">
              <p className="text-lg font-medium">{currentQuestion.question}</p>
              <RadioGroup
                value={selectedAnswer?.toString()}
                onValueChange={(value) => setSelectedAnswer(parseInt(value))}
              >
                {currentQuestion.options.map((option, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                    <label
                      htmlFor={`option-${index}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {option}
                    </label>
                  </div>
                ))}
              </RadioGroup>

              {showFeedback && selectedAnswer !== null && (
                <Alert
                  variant={selectedAnswer === currentQuestion.correctAnswer ? "default" : "destructive"}
                >
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>
                    {selectedAnswer === currentQuestion.correctAnswer
                      ? "Correct!"
                      : "Incorrect"}
                  </AlertTitle>
                  <AlertDescription>
                    {selectedAnswer === currentQuestion.correctAnswer
                      ? "Great job! You got it right."
                      : `The correct answer was: ${
                          currentQuestion.options[currentQuestion.correctAnswer]
                        }`}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          {activeSimulation.allowSkip && (
            <Button variant="outline" onClick={handleNextQuestion}>
              Skip
            </Button>
          )}
          <Button
            onClick={() => {
              if (selectedAnswer === null) {
                toast({
                  title: "Select an answer",
                  description: "Please select an answer before proceeding",
                  variant: "destructive",
                });
                return;
              }
              submitAnswerMutation.mutate({
                questionId: currentQuestion!.id,
                answer: selectedAnswer,
              });
            }}
            disabled={selectedAnswer === null || submitAnswerMutation.isPending}
          >
            {submitAnswerMutation.isPending ? "Submitting..." : "Submit Answer"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
