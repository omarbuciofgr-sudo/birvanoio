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
      blocked_domains: {
        Row: {
          block_count: number | null
          block_reason: string | null
          blocked_at: string
          domain: string
          http_status: number | null
          id: string
          last_attempt_at: string
          retry_after: string | null
        }
        Insert: {
          block_count?: number | null
          block_reason?: string | null
          blocked_at?: string
          domain: string
          http_status?: number | null
          id?: string
          last_attempt_at?: string
          retry_after?: string | null
        }
        Update: {
          block_count?: number | null
          block_reason?: string | null
          blocked_at?: string
          domain?: string
          http_status?: number | null
          id?: string
          last_attempt_at?: string
          retry_after?: string | null
        }
        Relationships: []
      }
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
      client_organizations: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      client_users: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean | null
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean | null
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_submissions: {
        Row: {
          created_at: string
          email: string
          first_name: string
          followed_up_at: string | null
          id: string
          last_name: string
          message: string
          notes: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          first_name: string
          followed_up_at?: string | null
          id?: string
          last_name: string
          message: string
          notes?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          followed_up_at?: string | null
          id?: string
          last_name?: string
          message?: string
          notes?: string | null
          status?: string
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
      crawl_logs: {
        Row: {
          blocked_detected: boolean | null
          blocked_reason: string | null
          completed_at: string | null
          created_at: string
          domain: string
          errors: Json | null
          id: string
          job_id: string
          pages_blocked_count: number | null
          pages_crawled_count: number | null
          pages_error_count: number | null
          started_at: string | null
        }
        Insert: {
          blocked_detected?: boolean | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          domain: string
          errors?: Json | null
          id?: string
          job_id: string
          pages_blocked_count?: number | null
          pages_crawled_count?: number | null
          pages_error_count?: number | null
          started_at?: string | null
        }
        Update: {
          blocked_detected?: boolean | null
          blocked_reason?: string | null
          completed_at?: string | null
          created_at?: string
          domain?: string
          errors?: Json | null
          id?: string
          job_id?: string
          pages_blocked_count?: number | null
          pages_crawled_count?: number | null
          pages_error_count?: number | null
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      domain_cache: {
        Row: {
          cache_expires_at: string
          created_at: string
          domain: string
          id: string
          last_scraped_at: string
          lead_id: string | null
          scraped_pages_count: number | null
        }
        Insert: {
          cache_expires_at: string
          created_at?: string
          domain: string
          id?: string
          last_scraped_at?: string
          lead_id?: string | null
          scraped_pages_count?: number | null
        }
        Update: {
          cache_expires_at?: string
          created_at?: string
          domain?: string
          id?: string
          last_scraped_at?: string
          lead_id?: string | null
          scraped_pages_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "domain_cache_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
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
      enrichment_logs: {
        Row: {
          action: string
          created_at: string
          credits_used: number | null
          error_message: string | null
          fields_enriched: Json | null
          id: string
          lead_id: string
          provider: Database["public"]["Enums"]["enrichment_provider"]
          request_data: Json | null
          response_data: Json | null
          success: boolean
        }
        Insert: {
          action: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          fields_enriched?: Json | null
          id?: string
          lead_id: string
          provider: Database["public"]["Enums"]["enrichment_provider"]
          request_data?: Json | null
          response_data?: Json | null
          success: boolean
        }
        Update: {
          action?: string
          created_at?: string
          credits_used?: number | null
          error_message?: string | null
          fields_enriched?: Json | null
          id?: string
          lead_id?: string
          provider?: Database["public"]["Enums"]["enrichment_provider"]
          request_data?: Json | null
          response_data?: Json | null
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "enrichment_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_providers_config: {
        Row: {
          api_key_secret_name: string | null
          config: Json | null
          created_at: string
          display_name: string
          id: string
          is_enabled: boolean | null
          provider: Database["public"]["Enums"]["enrichment_provider"]
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          config?: Json | null
          created_at?: string
          display_name: string
          id?: string
          is_enabled?: boolean | null
          provider: Database["public"]["Enums"]["enrichment_provider"]
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          config?: Json | null
          created_at?: string
          display_name?: string
          id?: string
          is_enabled?: boolean | null
          provider?: Database["public"]["Enums"]["enrichment_provider"]
          updated_at?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          job_type: string
          locked_at: string | null
          locked_by: string | null
          max_attempts: number | null
          next_attempt_at: string | null
          payload: Json | null
          priority: number | null
          reference_id: string
          result: Json | null
          status: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          payload?: Json | null
          priority?: number | null
          reference_id: string
          result?: Json | null
          status?: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          job_type?: string
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number | null
          next_attempt_at?: string | null
          payload?: Json | null
          priority?: number | null
          reference_id?: string
          result?: Json | null
          status?: string
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
      lead_duplicates: {
        Row: {
          created_at: string
          duplicate_lead_id: string
          id: string
          match_reason: string
          merged_at: string | null
          primary_lead_id: string
        }
        Insert: {
          created_at?: string
          duplicate_lead_id: string
          id?: string
          match_reason: string
          merged_at?: string | null
          primary_lead_id: string
        }
        Update: {
          created_at?: string
          duplicate_lead_id?: string
          id?: string
          match_reason?: string
          merged_at?: string | null
          primary_lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_duplicates_duplicate_lead_id_fkey"
            columns: ["duplicate_lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_duplicates_primary_lead_id_fkey"
            columns: ["primary_lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          business_name: string
          city: string | null
          client_id: string
          company_size: string | null
          contact_name: string | null
          contacted_at: string | null
          converted_at: string | null
          created_at: string
          email: string | null
          estimated_revenue: string | null
          id: string
          industry: string | null
          lead_score: number | null
          linkedin_url: string | null
          notes: string | null
          phone: string | null
          social_profiles: Json | null
          source_url: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          business_name: string
          city?: string | null
          client_id: string
          company_size?: string | null
          contact_name?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          estimated_revenue?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          social_profiles?: Json | null
          source_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          business_name?: string
          city?: string | null
          client_id?: string
          company_size?: string | null
          contact_name?: string | null
          contacted_at?: string | null
          converted_at?: string | null
          created_at?: string
          email?: string | null
          estimated_revenue?: string | null
          id?: string
          industry?: string | null
          lead_score?: number | null
          linkedin_url?: string | null
          notes?: string | null
          phone?: string | null
          social_profiles?: Json | null
          source_url?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      message_templates: {
        Row: {
          body: string
          category: string | null
          client_id: string
          created_at: string
          id: string
          is_shared: boolean
          name: string
          subject: string | null
          type: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          body: string
          category?: string | null
          client_id: string
          created_at?: string
          id?: string
          is_shared?: boolean
          name: string
          subject?: string | null
          type: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          body?: string
          category?: string | null
          client_id?: string
          created_at?: string
          id?: string
          is_shared?: boolean
          name?: string
          subject?: string | null
          type?: string
          updated_at?: string
          usage_count?: number
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
      scheduled_messages: {
        Row: {
          body: string
          client_id: string
          created_at: string
          error_message: string | null
          id: string
          lead_id: string
          scheduled_for: string
          sent_at: string | null
          status: string
          subject: string | null
          type: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id: string
          scheduled_for: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          lead_id?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      schema_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          fields: Json
          id: string
          is_default: boolean | null
          name: string
          niche: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_default?: boolean | null
          name: string
          niche: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          fields?: Json
          id?: string
          is_default?: boolean | null
          name?: string
          niche?: string
          updated_at?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          batch_size: number | null
          checkpoint_index: number | null
          completed_at: string | null
          completed_targets: number | null
          created_at: string
          created_by: string | null
          description: string | null
          failed_targets: number | null
          id: string
          input_method: string | null
          last_checkpoint_at: string | null
          max_pages_per_domain: number | null
          name: string
          request_delay_ms: number | null
          respect_robots_txt: boolean | null
          schema_template_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["scrape_job_status"]
          target_urls: Json
          total_targets: number | null
          updated_at: string
          use_playwright_fallback: boolean | null
        }
        Insert: {
          batch_size?: number | null
          checkpoint_index?: number | null
          completed_at?: string | null
          completed_targets?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failed_targets?: number | null
          id?: string
          input_method?: string | null
          last_checkpoint_at?: string | null
          max_pages_per_domain?: number | null
          name: string
          request_delay_ms?: number | null
          respect_robots_txt?: boolean | null
          schema_template_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          target_urls?: Json
          total_targets?: number | null
          updated_at?: string
          use_playwright_fallback?: boolean | null
        }
        Update: {
          batch_size?: number | null
          checkpoint_index?: number | null
          completed_at?: string | null
          completed_targets?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          failed_targets?: number | null
          id?: string
          input_method?: string | null
          last_checkpoint_at?: string | null
          max_pages_per_domain?: number | null
          name?: string
          request_delay_ms?: number | null
          respect_robots_txt?: boolean | null
          schema_template_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          target_urls?: Json
          total_targets?: number | null
          updated_at?: string
          use_playwright_fallback?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "scrape_jobs_schema_template_id_fkey"
            columns: ["schema_template_id"]
            isOneToOne: false
            referencedRelation: "schema_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_leads: {
        Row: {
          all_emails: Json | null
          all_phones: Json | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_org: string | null
          best_email: string | null
          best_phone: string | null
          confidence_score: number | null
          contact_form_source_url: string | null
          contact_form_url: string | null
          created_at: string
          domain: string
          email_source_url: string | null
          email_validation_notes: string | null
          email_validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          enrichment_data: Json | null
          enrichment_providers_used: Json | null
          full_name: string | null
          id: string
          job_id: string | null
          linkedin_search_url: string | null
          name_source_url: string | null
          phone_line_type: string | null
          phone_source_url: string | null
          phone_validation_notes: string | null
          phone_validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          qc_flag: string | null
          qc_notes: string | null
          schema_data: Json | null
          schema_evidence: Json | null
          schema_template_id: string | null
          scraped_at: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["scraped_lead_status"]
          updated_at: string
        }
        Insert: {
          all_emails?: Json | null
          all_phones?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_org?: string | null
          best_email?: string | null
          best_phone?: string | null
          confidence_score?: number | null
          contact_form_source_url?: string | null
          contact_form_url?: string | null
          created_at?: string
          domain: string
          email_source_url?: string | null
          email_validation_notes?: string | null
          email_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          enrichment_data?: Json | null
          enrichment_providers_used?: Json | null
          full_name?: string | null
          id?: string
          job_id?: string | null
          linkedin_search_url?: string | null
          name_source_url?: string | null
          phone_line_type?: string | null
          phone_source_url?: string | null
          phone_validation_notes?: string | null
          phone_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          qc_flag?: string | null
          qc_notes?: string | null
          schema_data?: Json | null
          schema_evidence?: Json | null
          schema_template_id?: string | null
          scraped_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["scraped_lead_status"]
          updated_at?: string
        }
        Update: {
          all_emails?: Json | null
          all_phones?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_org?: string | null
          best_email?: string | null
          best_phone?: string | null
          confidence_score?: number | null
          contact_form_source_url?: string | null
          contact_form_url?: string | null
          created_at?: string
          domain?: string
          email_source_url?: string | null
          email_validation_notes?: string | null
          email_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          enrichment_data?: Json | null
          enrichment_providers_used?: Json | null
          full_name?: string | null
          id?: string
          job_id?: string | null
          linkedin_search_url?: string | null
          name_source_url?: string | null
          phone_line_type?: string | null
          phone_source_url?: string | null
          phone_validation_notes?: string | null
          phone_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          qc_flag?: string | null
          qc_notes?: string | null
          schema_data?: Json | null
          schema_evidence?: Json | null
          schema_template_id?: string | null
          scraped_at?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["scraped_lead_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_leads_assigned_to_org_fkey"
            columns: ["assigned_to_org"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraped_leads_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scraped_leads_schema_template_id_fkey"
            columns: ["schema_template_id"]
            isOneToOne: false
            referencedRelation: "schema_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_pages: {
        Row: {
          blocked_reason: string | null
          created_at: string
          domain: string
          error_message: string | null
          extracted_signals: Json | null
          html_content: string | null
          http_status: number | null
          id: string
          job_id: string
          markdown_content: string | null
          page_type: string | null
          processing_time_ms: number | null
          scraped_at: string | null
          status: Database["public"]["Enums"]["scraped_page_status"]
          url: string
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          domain: string
          error_message?: string | null
          extracted_signals?: Json | null
          html_content?: string | null
          http_status?: number | null
          id?: string
          job_id: string
          markdown_content?: string | null
          page_type?: string | null
          processing_time_ms?: number | null
          scraped_at?: string | null
          status?: Database["public"]["Enums"]["scraped_page_status"]
          url: string
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          domain?: string
          error_message?: string | null
          extracted_signals?: Json | null
          html_content?: string | null
          http_status?: number | null
          id?: string
          job_id?: string
          markdown_content?: string | null
          page_type?: string | null
          processing_time_ms?: number | null
          scraped_at?: string | null
          status?: Database["public"]["Enums"]["scraped_page_status"]
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_pages_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraper_locks: {
        Row: {
          expires_at: string
          id: string
          lock_key: string
          lock_type: string
          locked_at: string
          locked_by: string | null
        }
        Insert: {
          expires_at: string
          id?: string
          lock_key: string
          lock_type: string
          locked_at?: string
          locked_by?: string | null
        }
        Update: {
          expires_at?: string
          id?: string
          lock_key?: string
          lock_type?: string
          locked_at?: string
          locked_by?: string | null
        }
        Relationships: []
      }
      scraper_stats: {
        Row: {
          avg_processing_time_ms: number | null
          id: string
          jobs_completed: number | null
          jobs_failed: number | null
          period_end: string
          period_start: string
          recorded_at: string
          targets_failed: number | null
          targets_processed: number | null
          targets_success: number | null
        }
        Insert: {
          avg_processing_time_ms?: number | null
          id?: string
          jobs_completed?: number | null
          jobs_failed?: number | null
          period_end: string
          period_start: string
          recorded_at?: string
          targets_failed?: number | null
          targets_processed?: number | null
          targets_success?: number | null
        }
        Update: {
          avg_processing_time_ms?: number | null
          id?: string
          jobs_completed?: number | null
          jobs_failed?: number | null
          period_end?: string
          period_start?: string
          recorded_at?: string
          targets_failed?: number | null
          targets_processed?: number | null
          targets_success?: number | null
        }
        Relationships: []
      }
      team_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          assigned_to: string
          id: string
          lead_id: string
          notes: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          assigned_to: string
          id?: string
          lead_id: string
          notes?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          assigned_to?: string
          id?: string
          lead_id?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      validation_logs: {
        Row: {
          created_at: string
          id: string
          input_value: string
          lead_id: string
          provider: string | null
          result_details: Json | null
          result_status: Database["public"]["Enums"]["validation_status"]
          validation_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_value: string
          lead_id: string
          provider?: string | null
          result_details?: Json | null
          result_status: Database["public"]["Enums"]["validation_status"]
          validation_type: string
        }
        Update: {
          created_at?: string
          id?: string
          input_value?: string
          lead_id?: string
          provider?: string | null
          result_details?: Json | null
          result_status?: Database["public"]["Enums"]["validation_status"]
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "validation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
            referencedColumns: ["id"]
          },
        ]
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
          recording_url: string | null
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
          recording_url?: string | null
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
          recording_url?: string | null
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
      webhook_integrations: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          trigger_event: string
          webhook_url: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          trigger_event: string
          webhook_url: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          trigger_event?: string
          webhook_url?: string
        }
        Relationships: []
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
      get_user_organization: { Args: { p_user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_email: { Args: { p_email: string }; Returns: string }
      normalize_phone: { Args: { p_phone: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "client"
      enrichment_provider: "apollo" | "hunter" | "clearbit" | "manual"
      lead_status: "new" | "contacted" | "qualified" | "converted" | "lost"
      scrape_job_status:
        | "draft"
        | "queued"
        | "running"
        | "paused"
        | "completed"
        | "failed"
        | "cancelled"
      scraped_lead_status:
        | "new"
        | "review"
        | "approved"
        | "assigned"
        | "in_progress"
        | "won"
        | "lost"
        | "rejected"
      scraped_page_status:
        | "pending"
        | "scraping"
        | "scraped"
        | "failed"
        | "blocked"
        | "skipped"
      validation_status: "unverified" | "likely_valid" | "verified" | "invalid"
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
      enrichment_provider: ["apollo", "hunter", "clearbit", "manual"],
      lead_status: ["new", "contacted", "qualified", "converted", "lost"],
      scrape_job_status: [
        "draft",
        "queued",
        "running",
        "paused",
        "completed",
        "failed",
        "cancelled",
      ],
      scraped_lead_status: [
        "new",
        "review",
        "approved",
        "assigned",
        "in_progress",
        "won",
        "lost",
        "rejected",
      ],
      scraped_page_status: [
        "pending",
        "scraping",
        "scraped",
        "failed",
        "blocked",
        "skipped",
      ],
      validation_status: ["unverified", "likely_valid", "verified", "invalid"],
    },
  },
} as const
