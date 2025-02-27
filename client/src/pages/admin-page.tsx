import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Question, insertQuestionSchema, User, Payment } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import {
  SidebarProvider,
  Sidebar,
  SidebarTrigger,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Users,
  BookOpen,
  CreditCard,
  Settings,
  BarChart3,
  Tags,
  LogOut,
  Search,
  Filter,
  Download,
  Upload,
} from "lucide-react";
import {  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type AnalyticsData = {
  examCompletions: {
    date: string;
    count: number;
  }[];
  failedQuestions: {
    questionId: number;
    question: string;
    failureCount: number;
  }[];
  userRegistrations: {
    date: string;
    count: number;
  }[];
  examSuccessRate: {
    name: string;
    value: number;
  }[];
};

type UserStats = {
  examAttempts: number;
  successRate: number;
  lastActive: string;
};

type AdminSection = "users" | "questions" | "pricing" | "payments" | "analytics" | "settings";
type PaymentStatus = "pending" | "completed" | "failed" | "refunded";

const ITEMS_PER_PAGE = 10;

export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Move this useEffect to the top level
  useEffect(() => {
    if (!user?.isAdmin) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const [activeSection, setActiveSection] = useState<AdminSection>("questions");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userCurrentPage, setUserCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  // Early return if no user or not admin, but after hooks
  if (!user) {
    return null;
  }

  // Queries
  const { data: questions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: activeSection === "users",
  });

  const { data: payments } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
    enabled: activeSection === "payments",
  });

  const { data: analyticsData } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
    enabled: activeSection === "analytics",
  });

  const { data: userStats } = useQuery<Record<number, UserStats>>({
    queryKey: ["/api/users/stats"],
    enabled: activeSection === "users",
  });

  // Extract unique categories from questions
  const categories = [...new Set(questions?.map(q => q.category) || [])];

  // Filter and paginate questions
  const filteredQuestions = questions?.filter(question => {
    const matchesSearch = question.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         question.category.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || question.category === selectedCategory;
    return matchesSearch && matchesCategory;
  }) || [];

  const totalPages = Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE);
  const paginatedQuestions = filteredQuestions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Question management form and mutations
  const form = useForm({
    resolver: zodResolver(insertQuestionSchema),
    defaultValues: {
      category: "",
      question: "",
      options: [],
      correctAnswer: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: Omit<Question, "id">) => {
      const res = await apiRequest("POST", "/api/questions", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
      form.reset();
      toast({
        title: "Success",
        description: "Question created successfully",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/questions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ userId, password }: { userId: number; password: string }) => {
      const res = await apiRequest("POST", `/api/users/${userId}/reset-password`, { password });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password has been reset successfully",
      });
      setIsResetPasswordOpen(false);
      setNewPassword("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await apiRequest("POST", `/api/users/${userId}/deactivate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User has been deactivated successfully",
      });
      setIsDeactivateOpen(false);
      setSelectedUser(null);
    },
  });

  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ paymentId, status }: { paymentId: number; status: PaymentStatus }) => {
      const res = await apiRequest("PATCH", `/api/payments/${paymentId}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({
        title: "Success",
        description: "Payment status updated successfully",
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

  const handleExport = () => {
    const questionsJson = JSON.stringify(questions, null, 2);
    const blob = new Blob([questionsJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const questions = JSON.parse(e.target?.result as string);
          // TODO: Implement bulk import API endpoint
          await apiRequest("POST", "/api/questions/bulk", questions);
          queryClient.invalidateQueries({ queryKey: ["/api/questions"] });
          toast({
            title: "Success",
            description: "Questions imported successfully",
          });
        } catch (error) {
          toast({
            title: "Error",
            description: "Failed to import questions",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };

  // Filter and paginate users
  const filteredUsers = users?.filter(user =>
    user.username.toLowerCase().includes(userSearchTerm.toLowerCase())
  ) || [];

  const totalUserPages = Math.ceil((filteredUsers.length || 0) / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (userCurrentPage - 1) * ITEMS_PER_PAGE,
    userCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar>
          <SidebarHeader>
            <div className="flex items-center justify-between px-4">
              <h2 className="text-lg font-semibold">Admin Dashboard</h2>
              <SidebarTrigger />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("users")}
                  isActive={activeSection === "users"}
                >
                  <Users className="h-4 w-4" />
                  <span>Users</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("questions")}
                  isActive={activeSection === "questions"}
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Questions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("pricing")}
                  isActive={activeSection === "pricing"}
                >
                  <Tags className="h-4 w-4" />
                  <span>Pricing</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("payments")}
                  isActive={activeSection === "payments"}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Payments</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("analytics")}
                  isActive={activeSection === "analytics"}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("settings")}
                  isActive={activeSection === "settings"}
                >
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    logoutMutation.mutate();
                    setLocation("/auth");
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 p-6">
          {activeSection === "questions" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search questions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={selectedCategory}
                    onValueChange={setSelectedCategory}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleExport} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="hidden"
                      id="import-questions"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('import-questions')?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                  </div>
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Add New Question</CardTitle>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="question"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Question</FormLabel>
                            <FormControl>
                              <Textarea {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="options"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Options (one per line)</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value.join("\n")}
                                onChange={(e) => field.onChange(e.target.value.split("\n"))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="correctAnswer"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Correct Answer (0-based index)</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={createMutation.isPending}>
                        Add Question
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {paginatedQuestions.map((question) => (
                  <Card key={question.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium text-sm text-muted-foreground mb-2">
                            {question.category}
                          </p>
                          <p className="text-lg mb-4">{question.question}</p>
                          <ul className="space-y-2">
                            {question.options.map((option, index) => (
                              <li
                                key={index}
                                className={index === question.correctAnswer ? "text-green-600 font-medium" : ""}
                              >
                                {index + 1}. {option}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <Button
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(question.id)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeSection === "users" && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {paginatedUsers.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            Role: {user.isAdmin ? "Admin" : "User"}
                          </p>
                          {userStats?.[user.id] && (
                            <div className="mt-2 space-y-1">
                              <p className="text-sm">
                                Exam Attempts: {userStats[user.id].examAttempts}
                              </p>
                              <p className="text-sm">
                                Success Rate: {userStats[user.id].successRate}%
                              </p>
                              <p className="text-sm">
                                Last Active: {new Date(userStats[user.id].lastActive).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsResetPasswordOpen(true);
                            }}
                          >
                            Reset Password
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user);
                              setIsDeactivateOpen(true);
                            }}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalUserPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => setUserCurrentPage(p => Math.max(1, p - 1))}
                        disabled={userCurrentPage === 1}
                      >
                        Previous
                      </Button>
                      <div className="flex items-center gap-2">
                        {Array.from({ length: totalUserPages }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={userCurrentPage === page ? "default" : "outline"}
                            onClick={() => setUserCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setUserCurrentPage(p => Math.min(totalUserPages, p + 1))}
                        disabled={userCurrentPage === totalUserPages}
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Reset Password Dialog */}
          <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset Password</DialogTitle>
                <DialogDescription>
                  Enter a new password for {selectedUser?.username}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Input
                  type="password"
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsResetPasswordOpen(false);
                    setNewPassword("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (selectedUser) {
                      resetPasswordMutation.mutate({
                        userId: selectedUser.id,
                        password: newPassword,
                      });
                    }
                  }}
                  disabled={resetPasswordMutation.isPending || !newPassword}
                >
                  Reset Password
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Deactivate User Dialog */}
          <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deactivate User</DialogTitle>
                <DialogDescription>
                  Are you sure you want to deactivate {selectedUser?.username}? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDeactivateOpen(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedUser) {
                      deactivateUserMutation.mutate(selectedUser.id);
                    }
                  }}
                  disabled={deactivateUserMutation.isPending}
                >
                  Deactivate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activeSection === "analytics" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Completions</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <LineChart
                      width={500}
                      height={300}
                      data={analyticsData?.examCompletions}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#8884d8"
                        name="Completions"
                      />
                    </LineChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Most Failed Questions</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <BarChart
                      width={500}
                      height={300}
                      data={analyticsData?.failedQuestions}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="question" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="failureCount" fill="#82ca9d" name="Failures" />
                    </BarChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Registrations</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <LineChart
                      width={500}
                      height={300}
                      data={analyticsData?.userRegistrations}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#82ca9d"
                        name="Registrations"
                      />
                    </LineChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Exam Success Rate</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <PieChart width={500} height={300}>
                      <Pie
                        data={analyticsData?.examSuccessRate}
                        cx={250}
                        cy={150}
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label
                      >
                        {analyticsData?.examSuccessRate.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? "#82ca9d" : "#ff8042"}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeSection === "payments" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>List of all payments</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments?.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{payment.id}</TableCell>
                          <TableCell>{payment.username}</TableCell>
                          <TableCell>{payment.packageType}</TableCell>
                          <TableCell>{payment.amount} RWF</TableCell>
                          <TableCell>{format(new Date(payment.createdAt), 'PPP')}</TableCell>
                          <TableCell>
                            <Select
                              value={payment.status}
                              onValueChange={(status: PaymentStatus) =>
                                updatePaymentStatusMutation.mutate({
                                  paymentId: payment.id,
                                  status,
                                })
                              }
                            >
                              <SelectTrigger className="w-[130px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="failed">Failed</SelectItem>
                                <SelectItem value="refunded">Refunded</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updatePaymentStatusMutation.mutate({
                                      paymentId: payment.id,
                                      status: "completed",
                                    })
                                  }
                                >
                                  Mark as Completed
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    updatePaymentStatusMutation.mutate({
                                      paymentId: payment.id,
                                      status: "refunded",
                                    })
                                  }
                                >
                                  Process Refund
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {(activeSection === "pricing" || activeSection === "settings") && (
            <Card>
              <CardHeader>
                <CardTitle>{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">This section is under development.</p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}