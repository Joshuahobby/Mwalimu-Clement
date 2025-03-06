
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useToast } from '../components/ui/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { QuestionCard } from '../components/exam/question-card';
import { QuestionNavigation } from '../components/exam/question-navigation';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Exam, Question } from '../types';

export default function ExamReviewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [, setLocation] = useLocation();
  
  // Get the exam ID from the URL
  const params = new URLSearchParams(window.location.search);
  const examId = params.get('id');
  
  // Get the exam and questions data
  const { data: exam, isLoading: examLoading, error: examError } = useQuery({
    queryKey: ['exam', examId],
    queryFn: async () => {
      if (!examId) return null;
      const res = await fetch(`/api/exams/${examId}`);
      if (!res.ok) throw new Error('Failed to fetch exam');
      return res.json();
    },
    enabled: !!examId,
  });
  
  const { data: questionsData, isLoading: questionsLoading, error: questionsError } = useQuery({
    queryKey: ['questions'],
    queryFn: async () => {
      const res = await fetch('/api/questions');
      if (!res.ok) throw new Error('Failed to fetch questions');
      return res.json();
    },
  });
  
  // Find the current question
  const currentQuestion = exam && questionsData && exam.questions[currentQuestionIndex] 
    ? Object.values(questionsData).find((q: any) => q.id === exam.questions[currentQuestionIndex])
    : null;
  
  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };
  
  const handleNextQuestion = () => {
    if (exam && currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };
  
  // Calculate statistics
  const getStatistics = () => {
    if (!exam || !questionsData) return null;
    
    const correctAnswers = exam.questions.reduce((count, questionId, index) => {
      const question = Object.values(questionsData).find((q: any) => q.id === questionId);
      if (question && exam.answers[index] === question.correctAnswer) {
        return count + 1;
      }
      return count;
    }, 0);
    
    const incorrectAnswers = exam.questions.length - correctAnswers;
    const score = Math.round((correctAnswers / exam.questions.length) * 100);
    
    return {
      correctAnswers,
      incorrectAnswers,
      score,
    };
  };
  
  const stats = getStatistics();
  
  // Show loading state
  if (examLoading || questionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading exam review...</p>
        </div>
      </div>
    );
  }
  
  // Show error states
  if (examError || questionsError || !exam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-red-600 mb-4">
          Failed to load exam review
        </h1>
        <Button onClick={() => setLocation("/")}>Return to Dashboard</Button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <Button 
        variant="ghost" 
        className="mb-4" 
        onClick={() => navigate(`/exam-results?id=${examId}`)}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Results
      </Button>
      
      <div className="flex flex-col gap-6 md:flex-row">
        {/* Main content */}
        <div className="flex-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Exam Review</CardTitle>
              <CardDescription>Review your answers and see the correct solutions</CardDescription>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center">
                    <CheckCircle className="text-green-500 mr-2" />
                    <span>{stats?.correctAnswers} correct</span>
                  </div>
                  <div className="flex items-center">
                    <XCircle className="text-red-500 mr-2" />
                    <span>{stats?.incorrectAnswers} incorrect</span>
                  </div>
                </div>
                <div className="text-lg font-bold">
                  Score: {stats?.score}%
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Current question review */}
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion as Question}
              currentIndex={currentQuestionIndex}
              totalQuestions={exam.questions.length}
              selectedAnswer={exam.answers[currentQuestionIndex]}
              onAnswerSelect={() => {}}
              showFeedback={true}
              isReviewMode={true}
              correctAnswer={(currentQuestion as Question).correctAnswer}
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
            
            <Button
              onClick={handleNextQuestion}
              disabled={currentQuestionIndex === exam.questions.length - 1}
            >
              Next
            </Button>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-4">
          <QuestionNavigation
            totalQuestions={exam.questions.length}
            currentQuestion={currentQuestionIndex}
            answers={exam.answers}
            onQuestionSelect={(index) => setCurrentQuestionIndex(index)}
          />
          
          <Card>
            <CardContent className="p-4">
              <Button 
                className="w-full" 
                onClick={() => navigate("/")}
              >
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
