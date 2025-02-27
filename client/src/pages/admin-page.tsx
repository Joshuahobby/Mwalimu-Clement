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
} from "lucide-react";
import { useState } from "react";

type AdminSection = "users" | "questions" | "pricing" | "payments" | "analytics" | "settings";

export default function AdminPage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeSection, setActiveSection] = useState<AdminSection>("questions");

  if (!user?.isAdmin) {
    setLocation("/");
    return null;
  }

  // Queries for different sections
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
                {questions?.map((question) => (
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
            </div>
          )}

          {activeSection === "users" && (
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users?.map((user) => (
                    <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-sm text-muted-foreground">
                          Role: {user.isAdmin ? "Admin" : "User"}
                        </p>
                      </div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm">
                          Reset Password
                        </Button>
                        <Button variant="destructive" size="sm">
                          Deactivate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Other sections will be implemented progressively */}
          {(activeSection === "pricing" || activeSection === "payments" || 
            activeSection === "analytics" || activeSection === "settings") && (
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