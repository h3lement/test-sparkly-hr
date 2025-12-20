export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_logs: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          html_body: string | null
          id: string
          language: string | null
          last_attempt_at: string | null
          original_log_id: string | null
          quiz_lead_id: string | null
          recipient_email: string
          resend_attempts: number
          resend_id: string | null
          sender_email: string
          sender_name: string
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          original_log_id?: string | null
          quiz_lead_id?: string | null
          recipient_email: string
          resend_attempts?: number
          resend_id?: string | null
          sender_email: string
          sender_name: string
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          html_body?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          original_log_id?: string | null
          quiz_lead_id?: string | null
          recipient_email?: string
          resend_attempts?: number
          resend_id?: string | null
          sender_email?: string
          sender_name?: string
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_original_log_id_fkey"
            columns: ["original_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_quiz_lead_id_fkey"
            columns: ["quiz_lead_id"]
            isOneToOne: false
            referencedRelation: "quiz_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          id: string
          is_live: boolean
          sender_email: string
          sender_name: string
          subjects: Json
          template_type: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          is_live?: boolean
          sender_email: string
          sender_name: string
          subjects?: Json
          template_type?: string
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          id?: string
          is_live?: boolean
          sender_email?: string
          sender_name?: string
          subjects?: Json
          template_type?: string
          version_number?: number
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_slug: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          page_slug: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          page_slug?: string
          session_id?: string
        }
        Relationships: []
      }
      pending_admin_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_leads: {
        Row: {
          answers: Json | null
          created_at: string
          email: string
          id: string
          language: string | null
          openness_score: number | null
          result_category: string
          score: number
          total_questions: number
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          email: string
          id?: string
          language?: string | null
          openness_score?: number | null
          result_category: string
          score: number
          total_questions: number
        }
        Update: {
          answers?: Json | null
          created_at?: string
          email?: string
          id?: string
          language?: string | null
          openness_score?: number | null
          result_category?: string
          score?: number
          total_questions?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
