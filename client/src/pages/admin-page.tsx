import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Question, insertQuestionSchema, User, Payment, packagePrices, insertUserSchema, InsertUser } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
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
  MoreHorizontal,
} from "lucide-react";
import {
  Select,
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
  DialogTrigger,
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from 'lucide-react';
import { DateRangePicker } from "@/components/ui/date-range-picker";


type AnalyticsData = {
  examCompletions: {
    date: string;
    count: number;
    passCount: number;
    failCount: number;
    averageScore: number;
  }[];
  failedQuestions: {
    questionId: number;
    question: string;
    failureCount: number;
    category: string;
  }[];
  userRegistrations: {
    date: string;
    count: number;
    activeUsers: number;
  }[];
  examSuccessRate: {
    name: string;
    value: number;
  }[];
  topCategories: {
    category: string;
    successRate: number;
    attempts: number;
  }[];
  revenueData: {
    date: string;
    amount: number;
    packageType: string;
  }[];
};

type UserStats = {
  examAttempts: number;
  successRate: number;
  lastActive: string;
};

type AdminSection = "users" | "questions" | "pricing" | "payments" | "analytics" | "settings" | "audit-logs";
type PaymentStatus = "pending" | "completed" | "failed" | "refunded";
type PricingPackage = {
  type: keyof typeof packagePrices;
  name: string;
  price: number;
  isEnabled: boolean;
};
type UserRole = "admin" | "instructor" | "student";

const ITEMS_PER_PAGE = 10;

export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const addUserForm = useForm<InsertUser>({
    resolver: zodResolver(insertUserSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "student" as const,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: InsertUser) => {
      try {
        const res = await apiRequest("POST", "/api/users", data);
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || 'Failed to create user');
        }
        const responseData = await res.json();
        return responseData;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(error.message);
        }
        throw new Error('An unexpected error occurred');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsAddUserOpen(false);
      addUserForm.reset();
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });


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
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    end: new Date()
  });
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("all");


  if (!user) {
    return null;
  }

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
    queryKey: ["/api/analytics", dateRange.start.toISOString(), dateRange.end.toISOString()],
    enabled: activeSection === "analytics",
  });

  const { data: userStats } = useQuery<Record<number, UserStats>>({
    queryKey: ["/api/users/stats"],
    enabled: activeSection === "users",
  });

  const categories = Array.from(new Set(questions?.map(q => q.category) || []));

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

  const updatePricingMutation = useMutation({
    mutationFn: async (data: { type: string; price: number; isEnabled: boolean }) => {
      try {
        const res = await apiRequest("PATCH", "/api/pricing", data);
        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`Failed to update pricing: ${res.statusText}. ${errorText}`);
        }
        return { success: true, type: data.type, price: data.price, isEnabled: data.isEnabled };
      } catch (error) {
        console.error("Pricing update error:", error);
        throw error;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricing"] });
      toast({
        title: "Success",
        description: `Pricing updated successfully for ${data.type}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating pricing",
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

  const filteredUsers = users?.filter(user =>
    user.username.toLowerCase().includes(userSearchTerm.toLowerCase())
  ) || [];

  const totalUserPages = Math.ceil((filteredUsers.length || 0) / ITEMS_PER_PAGE);
  const paginatedUsers = filteredUsers.slice(
    (userCurrentPage - 1) * ITEMS_PER_PAGE,
    userCurrentPage * ITEMS_PER_PAGE
  );

  const exportAnalytics = () => {
    if (!analyticsData) return;

    const csvData = [
      ["Date", "Exam Completions", "Pass Rate", "Average Score", "New Users", "Revenue"],
      ...analyticsData.examCompletions.map(day => [
        day.date,
        day.count.toString(),
        ((day.passCount / day.count) * 100).toFixed(2) + "%",
        day.averageScore.toFixed(2),
        analyticsData.userRegistrations.find(u => u.date === day.date)?.count || "0",
        analyticsData.revenueData.find(r => r.date === day.date)?.amount.toString() || "0"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${format(dateRange.start, 'yyyy-MM-dd')}_to_${format(dateRange.end, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const bulkActionMutation = useMutation({
    mutationFn: async ({ userIds, action }: { userIds: number[]; action: string }) => {
      const res = await apiRequest("POST", "/api/users/bulk-action", { userIds, action });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setSelectedUsers([]);
      toast({
        title: "Success",
        description: "Bulk action completed successfully",
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

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: number; role: UserRole }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/role`, { role });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Success",
        description: "User role updated successfully",
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

  const { data: sessions } = useQuery<{
    userId: number;
    username: string;
    lastActivity: string;
    ipAddress: string;
    device: string;
    isActive: boolean;
  }[]>({
    queryKey: ["/api/sessions"],
    enabled: activeSection === "users",
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const terminateSessionMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/sessions/${userId}/terminate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      toast({
        title: "Success",
        description: "Session terminated successfully",
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

  const { data: auditLogs, isLoading: auditLogsLoading } = useQuery<{
    id: number;
    createdAt: string;
    adminId: number;
    actionType: string;
    targetType: string;
    targetId?: number;
    details?: { before?: any; after?: any; message?: string };
    ipAddress: string;
    userAgent: string;
  }[]>(
    ["/api/audit-logs", actionTypeFilter, dateRange.start.toISOString(), dateRange.end.toISOString()],
    { enabled: activeSection === "audit-logs" }
  );

  const auditActionTypes = Array.from(new Set(auditLogs?.map((log) => log.actionType) || []));


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
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => setActiveSection("audit-logs")}
                  isActive={activeSection === "audit-logs"}
                >
                  <Filter className="h-4 w-4" />
                  <span>Audit Logs</span>
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
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {selectedUsers.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          Bulk Actions ({selectedUsers.length})
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={() => bulkActionMutation.mutate({
                            userIds: selectedUsers,
                            action: "deactivate"
                          })}
                        >
                          Deactivate Selected
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkActionMutation.mutate({
                            userIds: selectedUsers,
                            action: "activate"
                          })}
                        >
                          Activate Selected
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
                <Button onClick={() => setIsAddUserOpen(true)}>
                  Add New User
                </Button>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Manage user accounts and permissions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">
                              <Checkbox
                                checked={selectedUsers.length === paginatedUsers.length}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedUsers(paginatedUsers.map(u => u.id));
                                  } else {
                                    setSelectedUsers([]);
                                  }
                                }}
                              />
                            </TableHead>
                            <TableHead>Username</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Statistics</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedUsers.includes(user.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedUsers([...selectedUsers, user.id]);
                                    } else {
                                      setSelectedUsers(selectedUsers.filter(id => id !== user.id));
                                    }
                                  }}
                                />
                              </TableCell>
                              <TableCell>{user.username}</TableCell>
                              <TableCell>
                                <Select
                                  value={user.role || "student"}
                                  onValueChange={(value: UserRole) => {
                                    updateRoleMutation.mutate({
                                      userId: user.id,
                                      role: value,
                                    });
                                  }}
                                >
                                  <SelectTrigger className="w-[130px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="student">Student</SelectItem>
                                    <SelectItem value="instructor">Instructor</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={user.isActive ? "default" : "secondary"}
                                >
                                  {user.isActive ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {userStats?.[user.id] && (
                                  <div className="space-y-1">
                                    <p className="text-sm">
                                      Exam Attempts: {userStats[user.id].examAttempts}
                                    </p>
                                    <p className="text-sm">
                                      Success Rate: {userStats[user.id].successRate.toFixed(2)}%
                                    </p>
                                    <p className="text-sm">
                                      Last Active: {format(new Date(userStats[user.id].lastActive), 'PP')}
                                    </p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                      <span className="sr-only">Open menu</span>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setIsResetPasswordOpen(true);
                                      }}
                                    >
                                      Reset Password
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedUser(user);
                                        setIsDeactivateOpen(true);
                                      }}
                                    >
                                      {user.isActive ? "Deactivate" : "Activate"}
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

              <Dialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                      Enter a new password for {selectedUser?.username}
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                  />
                  <DialogFooter>
                    <Button
                      onClick={() => {
                        if (selectedUser) {
                          resetPasswordMutation.mutate({
                            userId: selectedUser.id,
                            password: newPassword,
                          });
                        }
                      }}
                      disabled={resetPasswordMutation.isPending}
                    >
                      Reset Password
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {selectedUser?.isActive ? "Deactivate" : "Activate"} User
                    </DialogTitle>
                    <DialogDescription>
                      Are you sure you want to {selectedUser?.isActive ? "deactivate" : "activate"} {selectedUser?.username}?
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (selectedUser) {
                          deactivateUserMutation.mutate(selectedUser.id);
                        }
                      }}
                      disabled={deactivateUserMutation.isPending}
                    >
                      {selectedUser?.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>
                      Create a new user account
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...addUserForm}>
                    <form onSubmit={addUserForm.handleSubmit((data) => createUserMutation.mutate(data))} className="space-y-4">
                      <FormField
                        control={addUserForm.control}
                        name="username"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Username</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={addUserForm.control}
                        name="role"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Role</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="student">Student</SelectItem>
                                <SelectItem value="instructor">Instructor</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={createUserMutation.isPending}>
                          {createUserMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Create User
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {activeSection === "audit-logs" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Audit Logs</CardTitle>
                  <CardDescription>Track and monitor administrative actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-4">
                      <div className="flex-1">
                        <Select onValueChange={(value) => setActionTypeFilter(value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Filter by action" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            {auditActionTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type.replace(/_/g, ' ').toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <DateRangePicker
                        from={dateRange.start}
                        to={dateRange.end}
                        onSelect={(range) => {
                          if (range?.from && range?.to) {
                            setDateRange({ start: range.from, end: range.to });
                          }
                        }}
                      />
                    </div>

                    {/* Audit Log Table */}
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Timestamp</TableHead>
                            <TableHead>Admin</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLogs?.map((log) => (
                            <TableRow key={log.id}>
                              <TableCell>
                                {format(new Date(log.createdAt), 'PP p')}
                              </TableCell>
                              <TableCell>{log.adminId}</TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {log.actionType.replace(/_/g, ' ').toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {log.targetType} {log.targetId && `#${log.targetId}`}
                              </TableCell>
                              <TableCell>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="ghost" size="sm">
                                      View Details
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Audit Log Details</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4">
                                      <div>
                                        <h4 className="font-medium">Before:</h4>
                                        <pre className="mt-2 rounded bg-muted p-4">
                                          <code>
                                            {JSON.stringify(log.details?.before, null, 2)}
                                          </code>
                                        </pre>
                                      </div>
                                      <div>
                                        <h4 className="font-medium">After:</h4>
                                        <pre className="mt-2 rounded bg-muted p-4">
                                          <code>
                                            {JSON.stringify(log.details?.after, null, 2)}
                                          </code>
                                        </pre>
                                      </div>
                                      {log.details?.message && (
                                        <div>
                                          <h4 className="font-medium">Message:</h4>
                                          <p className="mt-2">{log.details.message}</p>
                                        </div>
                                      )}
                                      <div className="text-sm text-muted-foreground">
                                        <p>IP Address: {log.ipAddress}</p>
                                        <p>User Agent: {log.userAgent}</p>
                                      </div>
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}