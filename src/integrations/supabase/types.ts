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
      chat_messages: {
        Row: {
          ai_qualified: boolean | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          sender_type: string
          session_id: string
          visitor_email: string | null
          visitor_name: string | null
          visitor_phone: string | null
        }
        Insert: {
          ai_qualified?: boolean | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          sender_type: string
          session_id?: string
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Update: {
          ai_qualified?: boolean | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          sender_type?: string
          session_id?: string
          visitor_email?: string | null
          visitor_name?: string | null
          visitor_phone?: string | null
        }
        Relationships: []
      }
      conversation_logs: {
        Row: {
          call_sid: string | null
          client_id: string
          content: string | null
          created_at: string
          direction: string | null
          duration_seconds: number | null
          id: string
          lead_id: string
          recording_url: string | null
          sentiment: string | null
          subject: string | null
          type: string
        }
        Insert: {
          call_sid?: string | null
          client_id: string
          content?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id: string
          recording_url?: string | null
          sentiment?: string | null
          subject?: string | null
          type: string
        }
        Update: {
          call_sid?: string | null
          client_id?: string
          content?: string | null
          created_at?: string
          direction?: string | null
          duration_seconds?: number | null
          id?: string
          lead_id?: string
          recording_url?: string | null
          sentiment?: string | null
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaign_steps: {
        Row: {
          body_template: string
          campaign_id: string
          created_at: string
          delay_days: number
          id: string
          step_order: number
          subject_template: string
        }
        Insert: {
          body_template: string
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order: number
          subject_template: string
        }
        Update: {
          body_template?: string
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          subject_template?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          client_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_campaign_enrollments: {
        Row: {
          campaign_id: string
          current_step: number
          enrolled_at: string
          id: string
          last_step_sent_at: string | null
          lead_id: string
          next_send_at: string | null
          status: string
        }
        Insert: {
          campaign_id: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_step_sent_at?: string | null
          lead_id: string
          next_send_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string
          current_step?: number
          enrolled_at?: string
          id?: string
          last_step_sent_at?: string | null
          lead_id?: string
          next_send_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "email_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_campaign_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business_name: string
          city: string | null
          client_id: string
          contact_name: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          id: string
          industry: string | null
          lead_score: number | null
          notes: string | null
          phone: string | null
          source_url: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          client_id: string
          contact_name?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          notes?: string | null
          phone?: string | null
          source_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          client_id?: string
          contact_name?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          notes?: string | null
          phone?: string | null
          source_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_name: string | null
          created_at: string
          elevenlabs_agent_id: string | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          sender_email: string | null
          twilio_phone_number: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          sender_email?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_name?: string | null
          created_at?: string
          elevenlabs_agent_id?: string | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          sender_email?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_agent_calls: {
        Row: {
          ai_transcript: string | null
          call_outcome: string | null
          call_summary: string | null
          client_id: string
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          lead_id: string
          script_template: string | null
          started_at: string | null
          status: string
        }
        Insert: {
          ai_transcript?: string | null
          call_outcome?: string | null
          call_summary?: string | null
          client_id: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id: string
          script_template?: string | null
          started_at?: string | null
          status?: string
        }
        Update: {
          ai_transcript?: string | null
          call_outcome?: string | null
          call_summary?: string | null
          client_id?: string
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          lead_id?: string
          script_template?: string | null
          started_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_agent_calls_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_chat_rate_limit: {
        Args: { session_uuid: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "client"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
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
      app_role: ["admin", "client"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
    },
  },
} as const
