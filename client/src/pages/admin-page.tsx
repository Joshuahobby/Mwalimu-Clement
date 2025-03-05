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

type AdminSection = "users" | "questions" | "pricing" | "payments" | "analytics" | "settings";
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
                                      Success Rate: {userStats[user.id].successRate}%
                                    </p>
                                    <p className="text-sm">
                                      Last Active: {new Date(userStats[user.id].lastActive).toLocaleDateString()}
                                    </p>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
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
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

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
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Active Sessions</CardTitle>
                  <CardDescription>Monitor and manage user sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Last Activity</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions?.map((session) => (
                        <TableRow key={session.userId}>
                          <TableCell>{session.username}</TableCell>
                          <TableCell>{format(new Date(session.lastActivity), 'PPp')}</TableCell>
                          <TableCell>{session.ipAddress}</TableCell>
                          <TableCell>{session.device}</TableCell>
                          <TableCell>
                            <Badge variant={session.isActive ? "default" : "secondary"}>
                              {session.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"                              onClick={() => terminateSessionMutation.mutate(session.userId)}
                              disabled={terminateSessionMutation.isPending}
                            >
                              Terminate Session
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {!sessions?.length && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No active sessions
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
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

          <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account. The user can change their password after first login.
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
                          <Input {...field} autoComplete="off" />
                        </FormControl>
                        <FormDescription>
                          Choose a unique username for the account
                        </FormDescription>
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
                          <Input type="password" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormDescription>
                          Set a temporary password for the user
                        </FormDescription>
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
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="student">Student</SelectItem>
                            <SelectItem value="instructor">Instructor</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Select the user's role and permissions
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createUserMutation.isPending || !addUserForm.formState.isValid}
                    >
                      {createUserMutation.isPending && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      Create User
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          {activeSection === "analytics" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Select
                    value="30days"
                    onValueChange={(value) => {
                      const end = new Date();
                      const start = new Date();
                      switch (value) {
                        case "7days":
                          start.setDate(end.getDate() - 7);
                          break;
                        case "30days":
                          start.setDate(end.getDate() - 30);
                          break;
                        case "90days":
                          start.setDate(end.getDate() - 90);
                          break;
                      }
                      setDateRange({ start, end });
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">Last 7 days</SelectItem>
                      <SelectItem value="30days">Last 30 days</SelectItem>
                      <SelectItem value="90days">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={exportAnalytics} variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Export Report
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Exam Performance Trends</CardTitle>
                    <CardDescription>Pass rates and average scores over time</CardDescription>
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
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="averageScore"
                        stroke="#8884d8"
                        name="Average Score"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey={(data) => (data.passCount / data.count) * 100}
                        stroke="#82ca9d"
                        name="Pass Rate %"
                      />
                    </LineChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Category Performance</CardTitle>
                    <CardDescription>Success rates by exam category</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <BarChart
                      width={500}
                      height={300}
                      data={analyticsData?.topCategories}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="successRate" fill="#82ca9d" name="Success Rate %" />
                      <Bar dataKey="attempts" fill="#8884d8" name="Total Attempts" />
                    </BarChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>User Growth & Engagement</CardTitle>
                    <CardDescription>New registrations and active users</CardDescription>
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
                        name="New Users"
                      />
                      <Line
                        type="monotone"
                        dataKey="activeUsers"
                        stroke="#8884d8"
                        name="Active Users"
                      />
                    </LineChart>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Revenue Analysis</CardTitle>
                    <CardDescription>Revenue trends by package type</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[300px]">
                    <BarChart
                      width={500}
                      height={300}
                      data={analyticsData?.revenueData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="amount" fill="#8884d8" name="Revenue (RWF)" />
                    </BarChart>
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
                  <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="p-4 flex justify-between items-center border-b border-gray-100">
                      <h3 className="font-medium text-gray-700">List of all payments</h3>
                      <div className="flex space-x-2">
                        <select className="custom-input max-w-[180px] h-9 text-sm" defaultValue="all">
                          <option value="all">All Statuses</option>
                          <option value="completed">Completed</option>
                          <option value="pending">Pending</option>
                          <option value="failed">Failed</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </div>
                    </div>
                    <Table className="admin-table">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">ID</TableHead>
                          <TableHead>User</TableHead>
                          <TableHead>Package</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments?.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono text-xs">{payment.id}</TableCell>
                            <TableCell className="font-medium">{payment.username}</TableCell>
                            <TableCell>
                              <span className="capitalize">{payment.packageType}</span>
                            </TableCell>
                            <TableCell className="font-medium">{payment.amount} RWF</TableCell>
                            <TableCell>{format(new Date(payment.createdAt), 'PPP')}</TableCell>
                            <TableCell>
                              <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium 
                                ${payment.status === 'completed' ? 'bg-green-100 text-green-800' : 
                                  payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 
                                  payment.status === 'failed' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'}`}>
                                {payment.status}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
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
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeSection === "pricing" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Package Pricing Management</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>Manage pricing for different packages</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Package</TableHead>
                        <TableHead>Current Price (RWF)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        { type: "single", name: "Single Exam" },
                        { type: "daily", name: "Daily Access" },
                        { type: "weekly", name: "Weekly Access" },
                        { type: "monthly", name: "Monthly Access" },
                      ].map((pkg) => (
                        <TableRow key={pkg.type}>
                          <TableCell className="font-medium">{pkg.name}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={packagePrices[pkg.type as keyof typeof packagePrices]}
                              onChange={(e) => {
                                const price = parseInt(e.target.value);
                                if (!isNaN(price) && price >= 0) {
                                  updatePricingMutation.mutate({
                                    type: pkg.type,
                                    price,
                                    isEnabled: true,
                                  });
                                }
                              }}
                              className="w-32"
                            />
                          </TableCell>
                          <TableCell>
                            <Switch
                              defaultChecked={true}
                              disabled={updatePricingMutation.isPending}
                              onCheckedChange={(isEnabled) => {
                                updatePricingMutation.mutate({
                                  type: pkg.type,
                                  price: packagePrices[pkg.type as keyof typeof packagePrices],
                                  isEnabled,
                                });
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                updatePricingMutation.mutate({
                                  type: pkg.type,
                                  price: packagePrices[pkg.type as keyof typeof packagePrices],
                                  isEnabled: true,
                                });
                              }}
                            >
                              Reset to Default
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing History</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableCaption>Recent price changes</TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Package</TableHead>
                        <TableHead>Old Price</TableHead>
                        <TableHead>New Price</TableHead>
                        <TableHead>Changed By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No recent changes
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {(activeSection === "settings") && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>System Settings</CardTitle>
                  <CardDescription>Configure core system settings and preferences</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-medium">Email Notifications</h3>
                        <p className="text-sm text-muted-foreground">
                          Receive email notifications for important system events
                        </p>
                      </div>
                      <Switch
                        defaultChecked={true}
                        onCheckedChange={(checked) => {
                          toast({
                            title: `Email notifications ${checked ? 'enabled' : 'disabled'}`,
                            description: "Your preferences have been saved",
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-medium">Automatic User Approval</h3>
                        <p className="text-sm text-muted-foreground">
                          Automatically approve new user registrations
                        </p>
                      </div>
                      <Switch
                        defaultChecked={false}
                        onCheckedChange={(checked) => {
                          toast({
                            title: `Automatic approval ${checked ? 'enabled' : 'disabled'}`,
                            description: "Your preferences have been saved",
                          });
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-medium">Maintenance Mode</h3>
                        <p className="text-sm text-muted-foreground">
                          Put the application in maintenance mode
                        </p>
                      </div>
                      <Switch
                        defaultChecked={false}
                        onCheckedChange={(checked) => {
                          toast({
                            title: `Maintenance mode ${checked ? 'enabled' : 'disabled'}`,
                            description: "System status updated",
                          });
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database Management</CardTitle>
                  <CardDescription>Manage database operations and maintenance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Backup initiated",
                          description: "Database backup process started",
                        });
                      }}
                    >
                      Create Backup
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: "Optimization started",
                          description: "Database optimization in progress",
                        });
                      }}
                    >
                      Optimize Database
                    </Button>
                  </div>
                  <div className="pt-4">
                    <h4 className="text-sm font-medium mb-2">Recent Backups</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>{format(new Date(), 'PPP')}</TableCell>
                          <TableCell>2.3 MB</TableCell>
                          <TableCell>
                            <Badge>Completed</Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">Download</Button>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Information</CardTitle>
                  <CardDescription>View system status and information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-1">System Version</h4>
                        <p className="text-sm text-muted-foreground">1.0.0</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Last Updated</h4>
                        <p className="text-sm text-muted-foreground">{format(new Date(), 'PPP')}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Active Users</h4>
                        <p className="text-sm text-muted-foreground">143</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-1">Storage Used</h4>
                        <p className="text-sm text-muted-foreground">1.2 GB</p>
                      </div>
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