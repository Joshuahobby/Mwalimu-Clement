import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, insertUserSchema } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

interface ProfileManagerProps {
  user: User;
}

export function ProfileManager({ user }: ProfileManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);

  const form = useForm({
    resolver: zodResolver(
      insertUserSchema.extend({
        displayName: insertUserSchema.shape.displayName,
        email: insertUserSchema.shape.email,
        bio: insertUserSchema.shape.bio,
      })
    ),
    defaultValues: {
      displayName: user.displayName || "",
      email: user.email || "",
      bio: user.bio || "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (data: Partial<User>) => {
      const response = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["/api/user"]);
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: Partial<User>) => {
    updateProfileMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Settings</CardTitle>
        <CardDescription>
          Manage your admin profile information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>
                      This is your public display name
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormDescription>
                      Your email address for notifications
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="bio"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bio</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormDescription>
                      A brief description about yourself
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm">Display Name</h4>
              <p className="text-muted-foreground">
                {user.displayName || "Not set"}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Email</h4>
              <p className="text-muted-foreground">
                {user.email || "Not set"}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm">Bio</h4>
              <p className="text-muted-foreground">
                {user.bio || "No bio provided"}
              </p>
            </div>
            <Button onClick={() => setIsEditing(true)}>
              Edit Profile
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
