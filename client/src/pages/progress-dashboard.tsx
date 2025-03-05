
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { BookOpen, Trophy, Timer, BarChart3, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

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

interface ExamResult {
  id: number;
  score: number;
  startTime: string;
  endTime: string;
  questionCount: number;
}

interface CategoryPerformance {
  category: string;
  correctCount: number;
  totalCount: number;
  percentage: number;
}

interface ProgressStats {
  totalExams: number;
  avgScore: number;
  passRate: number;
  totalQuestions: number;
  journey?: PaymentJourney;
  recentExams: ExamResult[];
  categoryPerformance: CategoryPerformance[];
  weeklyActivity: {
    date: string;
    questions: number;
  }[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ProgressDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  
  const { data: progressStats, isLoading } = useQuery<ProgressStats>({
    queryKey: ["user-progress"],
    queryFn: () => apiRequest("/api/user/progress"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4">Loading your progress data...</p>
        </div>
      </div>
    );
  }

  if (!progressStats) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h1 className="text-2xl font-bold mb-6">Progress Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <BarChart3 className="h-10 w-10 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Progress Data Yet</h3>
            <p className="text-muted-foreground mb-6">Start practicing or take an exam to see your progress metrics.</p>
            <Button onClick={() => navigate("/exam")}>Start Practice Exam</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate overall progress percentage based on journey or exams
  const calculateOverallProgress = () => {
    if (progressStats.journey?.total_questions_attempted && progressStats.journey.correct_answers) {
      return Math.min(100, (progressStats.journey.correct_answers / Math.max(1, progressStats.totalQuestions)) * 100);
    } else if (progressStats.totalExams > 0) {
      return Math.min(100, progressStats.passRate);
    }
    return 0;
  };

  const overallProgress = calculateOverallProgress();
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Progress Dashboard</h1>
      
      {/* Overview Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>Your journey toward driving test success</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex justify-between mb-2">
              <span>Progress</span>
              <span>{Math.round(overallProgress)}%</span>
            </div>
            <Progress value={overallProgress} className="h-2" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-3 rounded-full">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {progressStats.journey?.total_questions_attempted || 0}
                </p>
                <p className="text-sm text-gray-500">Questions Attempted</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <Trophy className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {progressStats.totalExams}
                </p>
                <p className="text-sm text-gray-500">Exams Completed</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-3 rounded-full">
                <Target className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {progressStats.avgScore ? Math.round(progressStats.avgScore) : 0}%
                </p>
                <p className="text-sm text-gray-500">Average Score</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-3 rounded-full">
                <Timer className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {progressStats.journey?.time_spent_minutes || 0}
                </p>
                <p className="text-sm text-gray-500">Minutes Studying</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Charts Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Performance by Category</CardTitle>
            <CardDescription>Your strengths and areas for improvement</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {progressStats.categoryPerformance.length > 0 ? (
              <BarChart
                width={500}
                height={300}
                data={progressStats.categoryPerformance.map(cat => ({
                  name: cat.category,
                  score: cat.percentage,
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                <Bar dataKey="score" fill="#8884d8" />
              </BarChart>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Complete more questions to see category performance</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Weekly Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Your studying consistency</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            {progressStats.weeklyActivity && progressStats.weeklyActivity.length > 0 ? (
              <LineChart
                width={500}
                height={300}
                data={progressStats.weeklyActivity}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="questions" stroke="#82ca9d" name="Questions" />
              </LineChart>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Start practicing to see your weekly activity</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* Recent Exams */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Exam Results</CardTitle>
          <CardDescription>Your last {progressStats.recentExams.length} exam attempts</CardDescription>
        </CardHeader>
        <CardContent>
          {progressStats.recentExams.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left py-3">Date</th>
                    <th className="text-left py-3">Score</th>
                    <th className="text-left py-3">Questions</th>
                    <th className="text-left py-3">Time Taken</th>
                    <th className="text-left py-3">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {progressStats.recentExams.map((exam) => {
                    const examDate = new Date(exam.startTime);
                    const endTime = new Date(exam.endTime);
                    const duration = Math.round((endTime.getTime() - examDate.getTime()) / 60000);
                    const isPassed = exam.score >= 70;
                    
                    return (
                      <tr key={exam.id}>
                        <td className="py-3">{examDate.toLocaleDateString()}</td>
                        <td className="py-3">{exam.score}%</td>
                        <td className="py-3">{exam.questionCount}</td>
                        <td className="py-3">{duration} min</td>
                        <td className="py-3">
                          <span className={`px-2 py-1 rounded-full text-sm ${isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {isPassed ? 'Passed' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">You haven't taken any exams yet</p>
              <Button onClick={() => navigate("/exam")}>Take an Exam</Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Study Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Study Recommendations</CardTitle>
          <CardDescription>Personalized suggestions to improve your performance</CardDescription>
        </CardHeader>
        <CardContent>
          {progressStats.categoryPerformance.length > 0 ? (
            <>
              <h3 className="font-semibold mb-3">Focus on these categories:</h3>
              <ul className="space-y-2">
                {progressStats.categoryPerformance
                  .sort((a, b) => a.percentage - b.percentage)
                  .slice(0, 3)
                  .map((category) => (
                    <li key={category.category} className="flex items-center">
                      <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                      <span>{category.category}: {category.percentage}% correct</span>
                    </li>
                  ))}
              </ul>
              <div className="mt-6">
                <Button onClick={() => navigate("/practice")}>Practice Weak Areas</Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Complete more questions to get personalized recommendations</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
