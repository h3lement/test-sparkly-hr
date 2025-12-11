import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EditAdminDialogProps {
  admin: {
    id: string;
    user_id: string;
    email: string;
    name: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdminUpdated: () => void;
}

export function EditAdminDialog({ admin, open, onOpenChange, onAdminUpdated }: EditAdminDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setEmail("");
    setName("");
    setPassword("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && admin) {
      setEmail(admin.email);
      setName(admin.name || "");
      setPassword("");
    } else {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  const handleUpdate = async () => {
    if (!admin) return;

    if (!email.trim()) {
      toast({
        title: "Error",
        description: "Email is required",
        variant: "destructive",
      });
      return;
    }

    if (password && password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-admin-user", {
        body: {
          action: "update",
          userId: admin.user_id,
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
          password: password || undefined,
        },
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Error",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Admin updated",
        description: "Admin details have been updated",
      });

      resetForm();
      onOpenChange(false);
      onAdminUpdated();
    } catch (error: any) {
      console.error("Error updating admin:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update admin",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Admin</DialogTitle>
          <DialogDescription>
            Update admin account details. Leave password empty to keep current.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-email">Email *</Label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-name">Name (optional)</Label>
            <Input
              id="edit-name"
              placeholder="Update display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-password">New Password (optional)</Label>
            <Input
              id="edit-password"
              type="password"
              placeholder="Leave empty to keep current"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? "Updating..." : "Update Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}