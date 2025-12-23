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
      activity_logs: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      cta_templates: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          cta_description: Json
          cta_retry_text: Json
          cta_retry_url: string | null
          cta_text: Json
          cta_title: Json
          cta_url: string | null
          id: string
          is_live: boolean
          name: string | null
          quiz_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta_description?: Json
          cta_retry_text?: Json
          cta_retry_url?: string | null
          cta_text?: Json
          cta_title?: Json
          cta_url?: string | null
          id?: string
          is_live?: boolean
          name?: string | null
          quiz_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta_description?: Json
          cta_retry_text?: Json
          cta_retry_url?: string | null
          cta_text?: Json
          cta_title?: Json
          cta_url?: string | null
          id?: string
          is_live?: boolean
          name?: string | null
          quiz_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_templates_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: true
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_reputation_history: {
        Row: {
          checked_at: string
          created_at: string
          dnsbl_checked_count: number
          dnsbl_listed_count: number
          domain: string
          full_result: Json | null
          id: string
          notification_sent: boolean | null
          overall_status: string
          recommendations: Json | null
          vt_harmless: number | null
          vt_malicious: number | null
          vt_reputation: number | null
          vt_suspicious: number | null
        }
        Insert: {
          checked_at?: string
          created_at?: string
          dnsbl_checked_count?: number
          dnsbl_listed_count?: number
          domain: string
          full_result?: Json | null
          id?: string
          notification_sent?: boolean | null
          overall_status: string
          recommendations?: Json | null
          vt_harmless?: number | null
          vt_malicious?: number | null
          vt_reputation?: number | null
          vt_suspicious?: number | null
        }
        Update: {
          checked_at?: string
          created_at?: string
          dnsbl_checked_count?: number
          dnsbl_listed_count?: number
          domain?: string
          full_result?: Json | null
          id?: string
          notification_sent?: boolean | null
          overall_status?: string
          recommendations?: Json | null
          vt_harmless?: number | null
          vt_malicious?: number | null
          vt_reputation?: number | null
          vt_suspicious?: number | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounce_reason: string | null
          bounce_type: string | null
          bounced_at: string | null
          click_count: number | null
          clicked_at: string | null
          complained_at: string | null
          complaint_type: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string | null
          email_type: string
          error_message: string | null
          html_body: string | null
          hypothesis_lead_id: string | null
          id: string
          language: string | null
          last_attempt_at: string | null
          open_count: number | null
          opened_at: string | null
          original_log_id: string | null
          provider_response: Json | null
          quiz_id: string | null
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
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          complaint_type?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          email_type: string
          error_message?: string | null
          html_body?: string | null
          hypothesis_lead_id?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          original_log_id?: string | null
          provider_response?: Json | null
          quiz_id?: string | null
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
          bounce_reason?: string | null
          bounce_type?: string | null
          bounced_at?: string | null
          click_count?: number | null
          clicked_at?: string | null
          complained_at?: string | null
          complaint_type?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string | null
          email_type?: string
          error_message?: string | null
          html_body?: string | null
          hypothesis_lead_id?: string | null
          id?: string
          language?: string | null
          last_attempt_at?: string | null
          open_count?: number | null
          opened_at?: string | null
          original_log_id?: string | null
          provider_response?: Json | null
          quiz_id?: string | null
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
            foreignKeyName: "email_logs_hypothesis_lead_id_fkey"
            columns: ["hypothesis_lead_id"]
            isOneToOne: false
            referencedRelation: "hypothesis_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_original_log_id_fkey"
            columns: ["original_log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
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
      email_queue: {
        Row: {
          created_at: string
          email_type: string
          error_message: string | null
          html_body: string
          hypothesis_lead_id: string | null
          id: string
          language: string | null
          max_retries: number
          processing_started_at: string | null
          quiz_id: string | null
          quiz_lead_id: string | null
          recipient_email: string
          reply_to_email: string | null
          retry_count: number
          scheduled_for: string
          sender_email: string
          sender_name: string
          sent_at: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          email_type: string
          error_message?: string | null
          html_body: string
          hypothesis_lead_id?: string | null
          id?: string
          language?: string | null
          max_retries?: number
          processing_started_at?: string | null
          quiz_id?: string | null
          quiz_lead_id?: string | null
          recipient_email: string
          reply_to_email?: string | null
          retry_count?: number
          scheduled_for?: string
          sender_email: string
          sender_name: string
          sent_at?: string | null
          status?: string
          subject: string
        }
        Update: {
          created_at?: string
          email_type?: string
          error_message?: string | null
          html_body?: string
          hypothesis_lead_id?: string | null
          id?: string
          language?: string | null
          max_retries?: number
          processing_started_at?: string | null
          quiz_id?: string | null
          quiz_lead_id?: string | null
          recipient_email?: string
          reply_to_email?: string | null
          retry_count?: number
          scheduled_for?: string
          sender_email?: string
          sender_name?: string
          sent_at?: string | null
          status?: string
          subject?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_content: Json
          created_at: string
          created_by: string | null
          created_by_email: string | null
          cta_template_id: string | null
          estimated_cost_eur: number | null
          id: string
          input_tokens: number | null
          is_live: boolean
          output_tokens: number | null
          quiz_id: string | null
          sender_email: string
          sender_name: string
          subjects: Json
          template_type: string
          version_number: number
          web_result_version_id: string | null
        }
        Insert: {
          body_content?: Json
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta_template_id?: string | null
          estimated_cost_eur?: number | null
          id?: string
          input_tokens?: number | null
          is_live?: boolean
          output_tokens?: number | null
          quiz_id?: string | null
          sender_email: string
          sender_name: string
          subjects?: Json
          template_type?: string
          version_number?: number
          web_result_version_id?: string | null
        }
        Update: {
          body_content?: Json
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          cta_template_id?: string | null
          estimated_cost_eur?: number | null
          id?: string
          input_tokens?: number | null
          is_live?: boolean
          output_tokens?: number | null
          quiz_id?: string | null
          sender_email?: string
          sender_name?: string
          subjects?: Json
          template_type?: string
          version_number?: number
          web_result_version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_cta_template_id_fkey"
            columns: ["cta_template_id"]
            isOneToOne: false
            referencedRelation: "cta_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_web_result_version_id_fkey"
            columns: ["web_result_version_id"]
            isOneToOne: false
            referencedRelation: "quiz_result_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_webhook_events: {
        Row: {
          created_at: string
          event_data: Json
          event_type: string
          id: string
          processed: boolean
          resend_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_type: string
          id?: string
          processed?: boolean
          resend_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_type?: string
          id?: string
          processed?: boolean
          resend_id?: string
        }
        Relationships: []
      }
      hypothesis_leads: {
        Row: {
          created_at: string
          email: string
          email_html: string | null
          email_subject: string | null
          feedback_action_plan: string | null
          feedback_new_learnings: string | null
          id: string
          language: string | null
          openness_score: number | null
          quiz_id: string
          score: number
          session_id: string
          total_questions: number
        }
        Insert: {
          created_at?: string
          email: string
          email_html?: string | null
          email_subject?: string | null
          feedback_action_plan?: string | null
          feedback_new_learnings?: string | null
          id?: string
          language?: string | null
          openness_score?: number | null
          quiz_id: string
          score: number
          session_id: string
          total_questions: number
        }
        Update: {
          created_at?: string
          email?: string
          email_html?: string | null
          email_subject?: string | null
          feedback_action_plan?: string | null
          feedback_new_learnings?: string | null
          id?: string
          language?: string | null
          openness_score?: number | null
          quiz_id?: string
          score?: number
          session_id?: string
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_leads_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      hypothesis_pages: {
        Row: {
          created_at: string
          description: Json
          id: string
          page_number: number
          quiz_id: string
          title: Json
        }
        Insert: {
          created_at?: string
          description?: Json
          id?: string
          page_number: number
          quiz_id: string
          title?: Json
        }
        Update: {
          created_at?: string
          description?: Json
          id?: string
          page_number?: number
          quiz_id?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_pages_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      hypothesis_questions: {
        Row: {
          correct_answer_man: boolean
          correct_answer_woman: boolean
          created_at: string
          hypothesis_text: Json
          hypothesis_text_man: Json
          hypothesis_text_woman: Json
          id: string
          interview_question: Json
          interview_question_man: Json
          interview_question_woman: Json
          page_id: string
          question_order: number
          truth_explanation: Json
        }
        Insert: {
          correct_answer_man?: boolean
          correct_answer_woman?: boolean
          created_at?: string
          hypothesis_text?: Json
          hypothesis_text_man?: Json
          hypothesis_text_woman?: Json
          id?: string
          interview_question?: Json
          interview_question_man?: Json
          interview_question_woman?: Json
          page_id: string
          question_order: number
          truth_explanation?: Json
        }
        Update: {
          correct_answer_man?: boolean
          correct_answer_woman?: boolean
          created_at?: string
          hypothesis_text?: Json
          hypothesis_text_man?: Json
          hypothesis_text_woman?: Json
          id?: string
          interview_question?: Json
          interview_question_man?: Json
          interview_question_woman?: Json
          page_id?: string
          question_order?: number
          truth_explanation?: Json
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_questions_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "hypothesis_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      hypothesis_responses: {
        Row: {
          answer_man: boolean | null
          answer_woman: boolean | null
          created_at: string
          id: string
          question_id: string
          quiz_id: string
          session_id: string
        }
        Insert: {
          answer_man?: boolean | null
          answer_woman?: boolean | null
          created_at?: string
          id?: string
          question_id: string
          quiz_id: string
          session_id: string
        }
        Update: {
          answer_man?: boolean | null
          answer_woman?: boolean | null
          created_at?: string
          id?: string
          question_id?: string
          quiz_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hypothesis_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "hypothesis_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hypothesis_responses_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      open_mindedness_result_levels: {
        Row: {
          color_class: string | null
          created_at: string
          description: Json
          emoji: string | null
          id: string
          max_score: number
          min_score: number
          quiz_id: string
          title: Json
        }
        Insert: {
          color_class?: string | null
          created_at?: string
          description?: Json
          emoji?: string | null
          id?: string
          max_score: number
          min_score: number
          quiz_id: string
          title?: Json
        }
        Update: {
          color_class?: string | null
          created_at?: string
          description?: Json
          emoji?: string | null
          id?: string
          max_score?: number
          min_score?: number
          quiz_id?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "open_mindedness_result_levels_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
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
      pending_email_notifications: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          lead_type: string
          max_attempts: number
          processed_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          lead_type: string
          max_attempts?: number
          processed_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          lead_type?: string
          max_attempts?: number
          processed_at?: string | null
          status?: string
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
      quiz_answers: {
        Row: {
          answer_order: number
          answer_text: Json
          created_at: string
          id: string
          question_id: string
          score_value: number
        }
        Insert: {
          answer_order: number
          answer_text?: Json
          created_at?: string
          id?: string
          question_id: string
          score_value?: number
        }
        Update: {
          answer_order?: number
          answer_text?: Json
          created_at?: string
          id?: string
          question_id?: string
          score_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_leads: {
        Row: {
          answers: Json | null
          created_at: string
          email: string
          email_html: string | null
          email_subject: string | null
          id: string
          language: string | null
          openness_score: number | null
          quiz_id: string | null
          result_category: string
          score: number
          total_questions: number
        }
        Insert: {
          answers?: Json | null
          created_at?: string
          email: string
          email_html?: string | null
          email_subject?: string | null
          id?: string
          language?: string | null
          openness_score?: number | null
          quiz_id?: string | null
          result_category: string
          score: number
          total_questions: number
        }
        Update: {
          answers?: Json | null
          created_at?: string
          email?: string
          email_html?: string | null
          email_subject?: string | null
          id?: string
          language?: string | null
          openness_score?: number | null
          quiz_id?: string | null
          result_category?: string
          score?: number
          total_questions?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_leads_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          created_at: string
          id: string
          question_order: number
          question_text: Json
          question_type: string
          quiz_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          question_order: number
          question_text?: Json
          question_type?: string
          quiz_id: string
        }
        Update: {
          created_at?: string
          id?: string
          question_order?: number
          question_text?: Json
          question_type?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_result_levels: {
        Row: {
          color_class: string | null
          created_at: string
          description: Json
          emoji: string | null
          id: string
          insights: Json
          max_score: number
          min_score: number
          quiz_id: string
          title: Json
        }
        Insert: {
          color_class?: string | null
          created_at?: string
          description?: Json
          emoji?: string | null
          id?: string
          insights?: Json
          max_score: number
          min_score: number
          quiz_id: string
          title?: Json
        }
        Update: {
          color_class?: string | null
          created_at?: string
          description?: Json
          emoji?: string | null
          id?: string
          insights?: Json
          max_score?: number
          min_score?: number
          quiz_id?: string
          title?: Json
        }
        Relationships: [
          {
            foreignKeyName: "quiz_result_levels_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_result_versions: {
        Row: {
          created_at: string
          created_by: string | null
          created_by_email: string | null
          estimated_cost_eur: number | null
          generation_params: Json
          id: string
          input_tokens: number | null
          is_live: boolean
          output_tokens: number | null
          quiz_id: string
          result_levels: Json
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estimated_cost_eur?: number | null
          generation_params?: Json
          id?: string
          input_tokens?: number | null
          is_live?: boolean
          output_tokens?: number | null
          quiz_id: string
          result_levels?: Json
          version_number?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          estimated_cost_eur?: number | null
          generation_params?: Json
          id?: string
          input_tokens?: number | null
          is_live?: boolean
          output_tokens?: number | null
          quiz_id?: string
          result_levels?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_result_versions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          badge_text: Json
          buying_persona: string | null
          created_at: string
          created_by: string | null
          cta_description: Json
          cta_retry_text: Json
          cta_retry_url: string | null
          cta_template_id: string | null
          cta_text: Json
          cta_title: Json
          cta_url: string | null
          description: Json
          discover_items: Json
          display_order: number | null
          duration_text: Json
          enable_scoring: boolean
          headline: Json
          headline_highlight: Json
          icp_description: string | null
          id: string
          include_open_mindedness: boolean
          is_active: boolean
          primary_language: string
          quiz_type: string
          show_confetti: boolean
          shuffle_answers: boolean
          shuffle_questions: boolean
          slug: string
          title: Json
          tone_intensity: number | null
          tone_of_voice: string | null
          tone_source: string | null
          translation_meta: Json
          updated_at: string
          use_tone_for_ai: boolean | null
        }
        Insert: {
          badge_text?: Json
          buying_persona?: string | null
          created_at?: string
          created_by?: string | null
          cta_description?: Json
          cta_retry_text?: Json
          cta_retry_url?: string | null
          cta_template_id?: string | null
          cta_text?: Json
          cta_title?: Json
          cta_url?: string | null
          description?: Json
          discover_items?: Json
          display_order?: number | null
          duration_text?: Json
          enable_scoring?: boolean
          headline?: Json
          headline_highlight?: Json
          icp_description?: string | null
          id?: string
          include_open_mindedness?: boolean
          is_active?: boolean
          primary_language?: string
          quiz_type?: string
          show_confetti?: boolean
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          slug: string
          title?: Json
          tone_intensity?: number | null
          tone_of_voice?: string | null
          tone_source?: string | null
          translation_meta?: Json
          updated_at?: string
          use_tone_for_ai?: boolean | null
        }
        Update: {
          badge_text?: Json
          buying_persona?: string | null
          created_at?: string
          created_by?: string | null
          cta_description?: Json
          cta_retry_text?: Json
          cta_retry_url?: string | null
          cta_template_id?: string | null
          cta_text?: Json
          cta_title?: Json
          cta_url?: string | null
          description?: Json
          discover_items?: Json
          display_order?: number | null
          duration_text?: Json
          enable_scoring?: boolean
          headline?: Json
          headline_highlight?: Json
          icp_description?: string | null
          id?: string
          include_open_mindedness?: boolean
          is_active?: boolean
          primary_language?: string
          quiz_type?: string
          show_confetti?: boolean
          shuffle_answers?: boolean
          shuffle_questions?: boolean
          slug?: string
          title?: Json
          tone_intensity?: number | null
          tone_of_voice?: string | null
          tone_source?: string | null
          translation_meta?: Json
          updated_at?: string
          use_tone_for_ai?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_cta_template_id_fkey"
            columns: ["cta_template_id"]
            isOneToOne: false
            referencedRelation: "cta_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          created_at: string
          email_type: string
          id: string
          lead_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email_type: string
          id?: string
          lead_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email_type?: string
          id?: string
          lead_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "hypothesis_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      ui_translations: {
        Row: {
          created_at: string
          id: string
          quiz_id: string | null
          translation_key: string
          translations: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          quiz_id?: string | null
          translation_key: string
          translations?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          quiz_id?: string | null
          translation_key?: string
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ui_translations_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          preference_key: string
          preference_value: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          preference_key: string
          preference_value?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          preference_key?: string
          preference_value?: Json
          updated_at?: string
          user_id?: string
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
