import { useQuery, useMutation } from "@tanstack/react-query";
import { Question, insertQuestionSchema } from "@shared/schema";
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

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  if (!user?.isAdmin) {
    setLocation("/");
    return null;
  }

  const form = useForm({
    resolver: zodResolver(insertQuestionSchema),
    defaultValues: {
      category: "",
      question: "",
      options: [],
      correctAnswer: 0,
    },
  });

  const { data: questions } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Question) => {
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Card className="mb-8">
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
    </div>
  );
}
