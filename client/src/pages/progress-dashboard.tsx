import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { BookOpen, Trophy, Timer, BarChart3, Target, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

// Define strict types for our data structures
interface ExamResult {
  id: number;
  score: number;
  startTime: string;
  endTime: string;
  questionCount: number;
  correctAnswers: number;
  category: string;
}

interface CategoryPerformance {
  category: string;
  correctCount: number;
  totalCount: number;
  percentage: number;
}

interface WeeklyActivity {
  date: string;
  questions: number;
}

interface UserProgress {
  totalExams: number;
  avgScore: number;
  passRate: number;
  totalQuestions: number;
  timeSpentMinutes: number;
  recentExams: ExamResult[];
  categoryPerformance: CategoryPerformance[];
  weeklyActivity: WeeklyActivity[];
  strongestCategory?: string;
  weakestCategory?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ProgressDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: progressStats, isLoading } = useQuery<UserProgress>({
    queryKey: ["/api/user/progress"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/user/progress");
      if (!response.ok) {
        throw new Error('Failed to fetch progress data');
      }
      return response.json();
    }
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

  const calculateOverallProgress = () => {
    if (progressStats.totalQuestions === 0) return 0;
    return Math.min(100, (progressStats.avgScore * progressStats.passRate) / 100);
  };

  const overallProgress = calculateOverallProgress();

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Your Learning Progress</h1>

      {/* Overview Stats */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Overall Progress</CardTitle>
          <CardDescription>Your journey toward mastering the driving theory test</CardDescription>
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
                <p className="text-2xl font-bold">{progressStats.totalQuestions}</p>
                <p className="text-sm text-gray-500">Questions Attempted</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-3 rounded-full">
                <Trophy className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progressStats.totalExams}</p>
                <p className="text-sm text-gray-500">Exams Completed</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-yellow-100 p-3 rounded-full">
                <Target className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{Math.round(progressStats.avgScore)}%</p>
                <p className="text-sm text-gray-500">Average Score</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-3 rounded-full">
                <Timer className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progressStats.timeSpentMinutes}</p>
                <p className="text-sm text-gray-500">Minutes Studying</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Exams */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Recent Exam Results</CardTitle>
          <CardDescription>Your last {progressStats.recentExams.length} exam attempts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
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
                    <tr key={exam.id} className="border-b">
                      <td className="py-3">{examDate.toLocaleDateString()}</td>
                      <td className="py-3">{exam.score}%</td>
                      <td className="py-3">{exam.questionCount}</td>
                      <td className="py-3">{duration} min</td>
                      <td className="py-3">
                        <span className={`px-2 py-1 rounded-full text-sm ${
                          isPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {isPassed ? 'Passed' : 'Failed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Performance Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Category Performance</CardTitle>
            <CardDescription>Your strengths and areas for improvement</CardDescription>
          </CardHeader>
          <CardContent>
            {progressStats.categoryPerformance.length > 0 ? (
              <div className="h-[300px]">
                <BarChart
                  width={500}
                  height={300}
                  data={progressStats.categoryPerformance}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                  <Bar dataKey="percentage" fill="#8884d8" />
                </BarChart>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Complete more questions to see category performance</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Activity</CardTitle>
            <CardDescription>Your study consistency</CardDescription>
          </CardHeader>
          <CardContent>
            {progressStats.weeklyActivity.length > 0 ? (
              <div className="h-[300px]">
                <LineChart
                  width={500}
                  height={300}
                  data={progressStats.weeklyActivity}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="questions" stroke="#82ca9d" name="Questions Attempted" />
                </LineChart>
              </div>
            ) : (
              <p className="text-center text-muted-foreground">Start practicing to see your weekly activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Personalized Study Plan</CardTitle>
          <CardDescription>Based on your performance analysis</CardDescription>
        </CardHeader>
        <CardContent>
          {progressStats.categoryPerformance.length > 0 ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Strengths</h3>
                <p className="text-green-600">
                  You're performing well in {progressStats.strongestCategory || progressStats.categoryPerformance[0].category}
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Areas for Improvement</h3>
                <div className="space-y-2">
                  {progressStats.categoryPerformance
                    .filter(cat => cat.percentage < 70)
                    .slice(0, 3)
                    .map(category => (
                      <div key={category.category} className="flex items-center">
                        <div className="w-3 h-3 rounded-full bg-orange-500 mr-2"></div>
                        <span>{category.category}: {category.percentage}% correct</span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={() => navigate("/exam")} className="w-full">
                  Start Targeted Practice
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              Complete more questions to receive personalized recommendations
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}