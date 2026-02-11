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
      ai_agents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          last_run_at: string | null
          model: string
          name: string
          prompt: string
          runs_count: number
          tools: string[] | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          model?: string
          name: string
          prompt: string
          runs_count?: number
          tools?: string[] | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          last_run_at?: string | null
          model?: string
          name?: string
          prompt?: string
          runs_count?: number
          tools?: string[] | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          performed_at: string
          performed_by: string | null
          reason: string | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          performed_at?: string
          performed_by?: string | null
          reason?: string | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      backup_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          date_range_days: number | null
          day_of_week: number | null
          destination_config: Json | null
          destination_type: string
          export_format: string | null
          frequency: string
          hour: number | null
          id: string
          include_analytics: boolean | null
          include_audit_log: boolean | null
          include_leads: boolean | null
          is_active: boolean | null
          last_run_at: string | null
          last_run_record_count: number | null
          last_run_status: string | null
          lead_status_filter: string[] | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_range_days?: number | null
          day_of_week?: number | null
          destination_config?: Json | null
          destination_type: string
          export_format?: string | null
          frequency?: string
          hour?: number | null
          id?: string
          include_analytics?: boolean | null
          include_audit_log?: boolean | null
          include_leads?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_record_count?: number | null
          last_run_status?: string | null
          lead_status_filter?: string[] | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_range_days?: number | null
          day_of_week?: number | null
          destination_config?: Json | null
          destination_type?: string
          export_format?: string | null
          frequency?: string
          hour?: number | null
          id?: string
          include_analytics?: boolean | null
          include_audit_log?: boolean | null
          include_leads?: boolean | null
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_record_count?: number | null
          last_run_status?: string | null
          lead_status_filter?: string[] | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      client_api_keys: {
        Row: {
          api_key_hash: string
          api_key_prefix: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_name: string
          last_used_at: string | null
          organization_id: string
          permissions: Json | null
          rate_limit_per_minute: number | null
        }
        Insert: {
          api_key_hash: string
          api_key_prefix: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_name: string
          last_used_at?: string | null
          organization_id: string
          permissions?: Json | null
          rate_limit_per_minute?: number | null
        }
        Update: {
          api_key_hash?: string
          api_key_prefix?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_name?: string
          last_used_at?: string | null
          organization_id?: string
          permissions?: Json | null
          rate_limit_per_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
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
      client_webhooks: {
        Row: {
          created_at: string
          created_by: string | null
          events: Json | null
          failure_count: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          organization_id: string
          secret_hash: string | null
          webhook_url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: Json | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          organization_id: string
          secret_hash?: string | null
          webhook_url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: Json | null
          failure_count?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          organization_id?: string
          secret_hash?: string | null
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_webhooks_organization_id_fkey"
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
      conversion_events: {
        Row: {
          client_lead_id: string | null
          event_data: Json | null
          event_type: string
          id: string
          lead_id: string | null
          recorded_at: string
          recorded_by: string | null
          value_usd: number | null
        }
        Insert: {
          client_lead_id?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          lead_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          value_usd?: number | null
        }
        Update: {
          client_lead_id?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          lead_id?: string | null
          recorded_at?: string
          recorded_by?: string | null
          value_usd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_client_lead_id_fkey"
            columns: ["client_lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
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
      credit_balances: {
        Row: {
          bonus_credits: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_cost_analysis: {
        Row: {
          calculated_at: string
          calculated_cost_cents: number
          cogs_cost_cents: number
          event_type: string
          id: string
          margin_percent: number
          scenario: string
          sell_price_cents: number
        }
        Insert: {
          calculated_at?: string
          calculated_cost_cents: number
          cogs_cost_cents: number
          event_type: string
          id?: string
          margin_percent: number
          scenario?: string
          sell_price_cents: number
        }
        Update: {
          calculated_at?: string
          calculated_cost_cents?: number
          cogs_cost_cents?: number
          event_type?: string
          id?: string
          margin_percent?: number
          scenario?: string
          sell_price_cents?: number
        }
        Relationships: []
      }
      credit_event_config: {
        Row: {
          avg_calls_per_lead: number
          base_credits: number
          cache_ttl_hours: number
          confidence_threshold: number
          created_at: string
          created_by: string | null
          description: string | null
          event_name: string
          event_type: string
          id: string
          is_active: boolean
          max_provider_calls: number
          providers_involved: string[] | null
          success_rate: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avg_calls_per_lead?: number
          base_credits?: number
          cache_ttl_hours?: number
          confidence_threshold?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_name: string
          event_type: string
          id?: string
          is_active?: boolean
          max_provider_calls?: number
          providers_involved?: string[] | null
          success_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avg_calls_per_lead?: number
          base_credits?: number
          cache_ttl_hours?: number
          confidence_threshold?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          event_name?: string
          event_type?: string
          id?: string
          is_active?: boolean
          max_provider_calls?: number
          providers_involved?: string[] | null
          success_rate?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount_paid_cents: number
          created_at: string
          credits_purchased: number
          id: string
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_paid_cents: number
          created_at?: string
          credits_purchased: number
          id?: string
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_paid_cents?: number
          created_at?: string
          credits_purchased?: number
          id?: string
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_usage: {
        Row: {
          action: string
          created_at: string
          credits_spent: number
          id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_spent?: number
          id?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_spent?: number
          id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      crm_integrations: {
        Row: {
          api_key_secret_name: string | null
          auto_sync_enabled: boolean | null
          created_at: string
          created_by: string | null
          crm_type: string
          field_mapping: Json | null
          id: string
          instance_url: string | null
          is_active: boolean | null
          last_sync_at: string | null
          leads_synced_count: number | null
          name: string
          sync_error: string | null
          sync_on_status: string[] | null
          updated_at: string
        }
        Insert: {
          api_key_secret_name?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          crm_type: string
          field_mapping?: Json | null
          id?: string
          instance_url?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          leads_synced_count?: number | null
          name: string
          sync_error?: string | null
          sync_on_status?: string[] | null
          updated_at?: string
        }
        Update: {
          api_key_secret_name?: string | null
          auto_sync_enabled?: boolean | null
          created_at?: string
          created_by?: string | null
          crm_type?: string
          field_mapping?: Json | null
          id?: string
          instance_url?: string | null
          is_active?: boolean | null
          last_sync_at?: string | null
          leads_synced_count?: number | null
          name?: string
          sync_error?: string | null
          sync_on_status?: string[] | null
          updated_at?: string
        }
        Relationships: []
      }
      custom_reports: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: string
          is_shared: boolean
          name: string
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          name: string
          report_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_shared?: boolean
          name?: string
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      digest_subscriptions: {
        Row: {
          created_at: string
          digest_day_of_week: number | null
          digest_frequency: string
          digest_hour: number | null
          email_address: string
          id: string
          include_alerts: boolean | null
          include_job_summary: boolean | null
          include_metrics: boolean | null
          include_new_leads: boolean | null
          is_active: boolean | null
          last_sent_at: string | null
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          digest_day_of_week?: number | null
          digest_frequency?: string
          digest_hour?: number | null
          email_address: string
          id?: string
          include_alerts?: boolean | null
          include_job_summary?: boolean | null
          include_metrics?: boolean | null
          include_new_leads?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          digest_day_of_week?: number | null
          digest_frequency?: string
          digest_hour?: number | null
          email_address?: string
          id?: string
          include_alerts?: boolean | null
          include_job_summary?: boolean | null
          include_metrics?: boolean | null
          include_new_leads?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          organization_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "digest_subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
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
      enrichment_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          input_data: Json
          lookup_type: string
          provider: string
          result_data: Json | null
          success: boolean
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          input_data: Json
          lookup_type: string
          provider: string
          result_data?: Json | null
          success: boolean
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          input_data?: Json
          lookup_type?: string
          provider?: string
          result_data?: Json | null
          success?: boolean
        }
        Relationships: []
      }
      enrichment_credit_usage: {
        Row: {
          created_at: string
          credits_used: number
          id: string
          one_time_credits: number
          period_start: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_used?: number
          id?: string
          one_time_credits?: number
          period_start?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits_used?: number
          id?: string
          one_time_credits?: number
          period_start?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      enrichment_logs: {
        Row: {
          action: string
          cost_usd: number | null
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
          cost_usd?: number | null
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
          cost_usd?: number | null
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
      enrichment_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          enrich_company: boolean | null
          enrich_email: boolean | null
          enrich_linkedin: boolean | null
          enrich_phone: boolean | null
          id: string
          is_active: boolean | null
          max_credits_per_lead: number | null
          min_score: number | null
          name: string
          trigger_on: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrich_company?: boolean | null
          enrich_email?: boolean | null
          enrich_linkedin?: boolean | null
          enrich_phone?: boolean | null
          id?: string
          is_active?: boolean | null
          max_credits_per_lead?: number | null
          min_score?: number | null
          name: string
          trigger_on?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          enrich_company?: boolean | null
          enrich_email?: boolean | null
          enrich_linkedin?: boolean | null
          enrich_phone?: boolean | null
          id?: string
          is_active?: boolean | null
          max_credits_per_lead?: number | null
          min_score?: number | null
          name?: string
          trigger_on?: string
          updated_at?: string
        }
        Relationships: []
      }
      intent_signals: {
        Row: {
          confidence_score: number | null
          created_at: string
          detected_at: string
          expires_at: string | null
          id: string
          is_processed: boolean | null
          lead_id: string | null
          signal_data: Json | null
          signal_source: string | null
          signal_type: string
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string
          detected_at?: string
          expires_at?: string | null
          id?: string
          is_processed?: boolean | null
          lead_id?: string | null
          signal_data?: Json | null
          signal_source?: string | null
          signal_type: string
        }
        Update: {
          confidence_score?: number | null
          created_at?: string
          detected_at?: string
          expires_at?: string | null
          id?: string
          is_processed?: boolean | null
          lead_id?: string | null
          signal_data?: Json | null
          signal_source?: string | null
          signal_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "intent_signals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "scraped_leads"
            referencedColumns: ["id"]
          },
        ]
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
      lead_routing_rules: {
        Row: {
          assign_to_org: string | null
          assign_to_user: string | null
          auto_enrich: boolean | null
          created_at: string
          created_by: string | null
          criteria_industry: string[] | null
          criteria_lead_type: string[] | null
          criteria_max_score: number | null
          criteria_min_score: number | null
          criteria_state: string[] | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          priority: number | null
          send_webhook: boolean | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          assign_to_org?: string | null
          assign_to_user?: string | null
          auto_enrich?: boolean | null
          created_at?: string
          created_by?: string | null
          criteria_industry?: string[] | null
          criteria_lead_type?: string[] | null
          criteria_max_score?: number | null
          criteria_min_score?: number | null
          criteria_state?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          priority?: number | null
          send_webhook?: boolean | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          assign_to_org?: string | null
          assign_to_user?: string | null
          auto_enrich?: boolean | null
          created_at?: string
          created_by?: string | null
          criteria_industry?: string[] | null
          criteria_lead_type?: string[] | null
          criteria_max_score?: number | null
          criteria_min_score?: number | null
          criteria_state?: string[] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          priority?: number | null
          send_webhook?: boolean | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_routing_rules_assign_to_org_fkey"
            columns: ["assign_to_org"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_scoring_config: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          threshold_cold: number | null
          threshold_hot: number | null
          threshold_warm: number | null
          updated_at: string
          weight_company_size_match: number | null
          weight_email_verified: number | null
          weight_has_address: number | null
          weight_has_email: number | null
          weight_has_phone: number | null
          weight_industry_match: number | null
          weight_intent_signal: number | null
          weight_location_match: number | null
          weight_phone_verified: number | null
          weight_recent_activity: number | null
          weight_website_quality: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          threshold_cold?: number | null
          threshold_hot?: number | null
          threshold_warm?: number | null
          updated_at?: string
          weight_company_size_match?: number | null
          weight_email_verified?: number | null
          weight_has_address?: number | null
          weight_has_email?: number | null
          weight_has_phone?: number | null
          weight_industry_match?: number | null
          weight_intent_signal?: number | null
          weight_location_match?: number | null
          weight_phone_verified?: number | null
          weight_recent_activity?: number | null
          weight_website_quality?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          threshold_cold?: number | null
          threshold_hot?: number | null
          threshold_warm?: number | null
          updated_at?: string
          weight_company_size_match?: number | null
          weight_email_verified?: number | null
          weight_has_address?: number | null
          weight_has_email?: number | null
          weight_has_phone?: number | null
          weight_industry_match?: number | null
          weight_intent_signal?: number | null
          weight_location_match?: number | null
          weight_phone_verified?: number | null
          weight_recent_activity?: number | null
          weight_website_quality?: number | null
        }
        Relationships: []
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
      notification_channels: {
        Row: {
          channel_type: string
          config: Json | null
          created_at: string
          created_by: string | null
          failure_count: number | null
          high_value_lead_score: number | null
          id: string
          is_active: boolean | null
          last_triggered_at: string | null
          name: string
          notify_on_daily_summary: boolean | null
          notify_on_high_value_lead: boolean | null
          notify_on_job_complete: boolean | null
          notify_on_job_failure: boolean | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          channel_type: string
          config?: Json | null
          created_at?: string
          created_by?: string | null
          failure_count?: number | null
          high_value_lead_score?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name: string
          notify_on_daily_summary?: boolean | null
          notify_on_high_value_lead?: boolean | null
          notify_on_job_complete?: boolean | null
          notify_on_job_failure?: boolean | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          channel_type?: string
          config?: Json | null
          created_at?: string
          created_by?: string | null
          failure_count?: number | null
          high_value_lead_score?: number | null
          id?: string
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string
          notify_on_daily_summary?: boolean | null
          notify_on_high_value_lead?: boolean | null
          notify_on_job_complete?: boolean | null
          notify_on_job_failure?: boolean | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      performance_metrics: {
        Row: {
          endpoint: string | null
          id: string
          metric_type: string
          operation: string | null
          period_end: string | null
          period_start: string | null
          recorded_at: string
          value_json: Json | null
          value_numeric: number | null
        }
        Insert: {
          endpoint?: string | null
          id?: string
          metric_type: string
          operation?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_at?: string
          value_json?: Json | null
          value_numeric?: number | null
        }
        Update: {
          endpoint?: string | null
          id?: string
          metric_type?: string
          operation?: string | null
          period_end?: string | null
          period_start?: string | null
          recorded_at?: string
          value_json?: Json | null
          value_numeric?: number | null
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
          industry: string | null
          last_name: string | null
          phone: string | null
          role_title: string | null
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
          industry?: string | null
          last_name?: string | null
          phone?: string | null
          role_title?: string | null
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
          industry?: string | null
          last_name?: string | null
          phone?: string | null
          role_title?: string | null
          sender_email?: string | null
          twilio_phone_number?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_pricing_config: {
        Row: {
          api_name: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          notes: string | null
          provider_name: string
          unit_cost_cents: number
          unit_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          provider_name: string
          unit_cost_cents?: number
          unit_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          provider_name?: string
          unit_cost_cents?: number
          unit_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          created_at: string
          description: string | null
          filters: Json
          id: string
          is_default: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filters?: Json
          id?: string
          is_default?: boolean | null
          name?: string
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
      scheduled_scrape_jobs: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          input_method: string | null
          is_active: boolean | null
          last_run_at: string | null
          last_run_job_id: string | null
          max_results: number | null
          name: string
          next_run_at: string | null
          run_count: number | null
          schedule_day_of_month: number | null
          schedule_day_of_week: number | null
          schedule_hour: number | null
          schedule_type: string
          schema_template_id: string | null
          search_location: string | null
          search_query: string | null
          target_urls: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          input_method?: string | null
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_job_id?: string | null
          max_results?: number | null
          name: string
          next_run_at?: string | null
          run_count?: number | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_hour?: number | null
          schedule_type?: string
          schema_template_id?: string | null
          search_location?: string | null
          search_query?: string | null
          target_urls?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          input_method?: string | null
          is_active?: boolean | null
          last_run_at?: string | null
          last_run_job_id?: string | null
          max_results?: number | null
          name?: string
          next_run_at?: string | null
          run_count?: number | null
          schedule_day_of_month?: number | null
          schedule_day_of_week?: number | null
          schedule_hour?: number | null
          schedule_type?: string
          schema_template_id?: string | null
          search_location?: string | null
          search_query?: string | null
          target_urls?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_scrape_jobs_last_run_job_id_fkey"
            columns: ["last_run_job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_scrape_jobs_schema_template_id_fkey"
            columns: ["schema_template_id"]
            isOneToOne: false
            referencedRelation: "schema_templates"
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
          target_contact_role: string | null
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
          target_contact_role?: string | null
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
          target_contact_role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      scrape_jobs: {
        Row: {
          batch_size: number | null
          budget_exceeded: boolean | null
          checkpoint_index: number | null
          completed_at: string | null
          completed_targets: number | null
          created_at: string
          created_by: string | null
          current_cost_usd: number | null
          description: string | null
          failed_targets: number | null
          id: string
          input_method: string | null
          job_budget_usd: number | null
          last_checkpoint_at: string | null
          max_enrichment_calls_per_domain: number | null
          max_pages_per_domain: number | null
          max_verification_calls_per_lead: number | null
          name: string
          request_delay_ms: number | null
          respect_robots_txt: boolean | null
          schema_template_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["scrape_job_status"]
          target_contact_role: string | null
          target_urls: Json
          total_targets: number | null
          updated_at: string
          use_playwright_fallback: boolean | null
        }
        Insert: {
          batch_size?: number | null
          budget_exceeded?: boolean | null
          checkpoint_index?: number | null
          completed_at?: string | null
          completed_targets?: number | null
          created_at?: string
          created_by?: string | null
          current_cost_usd?: number | null
          description?: string | null
          failed_targets?: number | null
          id?: string
          input_method?: string | null
          job_budget_usd?: number | null
          last_checkpoint_at?: string | null
          max_enrichment_calls_per_domain?: number | null
          max_pages_per_domain?: number | null
          max_verification_calls_per_lead?: number | null
          name: string
          request_delay_ms?: number | null
          respect_robots_txt?: boolean | null
          schema_template_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          target_contact_role?: string | null
          target_urls?: Json
          total_targets?: number | null
          updated_at?: string
          use_playwright_fallback?: boolean | null
        }
        Update: {
          batch_size?: number | null
          budget_exceeded?: boolean | null
          checkpoint_index?: number | null
          completed_at?: string | null
          completed_targets?: number | null
          created_at?: string
          created_by?: string | null
          current_cost_usd?: number | null
          description?: string | null
          failed_targets?: number | null
          id?: string
          input_method?: string | null
          job_budget_usd?: number | null
          last_checkpoint_at?: string | null
          max_enrichment_calls_per_domain?: number | null
          max_pages_per_domain?: number | null
          max_verification_calls_per_lead?: number | null
          name?: string
          request_delay_ms?: number | null
          respect_robots_txt?: boolean | null
          schema_template_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["scrape_job_status"]
          target_contact_role?: string | null
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
          address: string | null
          address_evidence_snippet: string | null
          address_evidence_type: string | null
          address_source_url: string | null
          ai_insights: string | null
          all_emails: Json | null
          all_phones: Json | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_to_org: string | null
          best_contact_selection_reason: string | null
          best_contact_title: string | null
          best_email: string | null
          best_phone: string | null
          confidence_score: number | null
          contact_form_source_url: string | null
          contact_form_url: string | null
          created_at: string
          domain: string
          email_evidence_snippet: string | null
          email_evidence_type: string | null
          email_source_url: string | null
          email_validation_notes: string | null
          email_validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          email_verification_method: string | null
          email_verification_result: Json | null
          email_verified_at: string | null
          enrichment_data: Json | null
          enrichment_providers_used: Json | null
          full_name: string | null
          id: string
          intent_signals_count: number | null
          is_suppressed: boolean | null
          job_id: string | null
          latest_intent_signal: string | null
          lead_score: number | null
          lead_type: string | null
          linkedin_search_url: string | null
          name_evidence_snippet: string | null
          name_evidence_type: string | null
          name_source_url: string | null
          phone_evidence_snippet: string | null
          phone_evidence_type: string | null
          phone_line_type: string | null
          phone_source_url: string | null
          phone_validation_notes: string | null
          phone_validation_status:
            | Database["public"]["Enums"]["validation_status"]
            | null
          phone_verification_method: string | null
          phone_verification_result: Json | null
          phone_verified_at: string | null
          priority: string | null
          qc_flag: string | null
          qc_notes: string | null
          recommended_action: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          schema_data: Json | null
          schema_evidence: Json | null
          schema_template_id: string | null
          score_breakdown: Json | null
          scraped_at: string | null
          source_type: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["scraped_lead_status"]
          suppression_reason: string | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          address_evidence_snippet?: string | null
          address_evidence_type?: string | null
          address_source_url?: string | null
          ai_insights?: string | null
          all_emails?: Json | null
          all_phones?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_org?: string | null
          best_contact_selection_reason?: string | null
          best_contact_title?: string | null
          best_email?: string | null
          best_phone?: string | null
          confidence_score?: number | null
          contact_form_source_url?: string | null
          contact_form_url?: string | null
          created_at?: string
          domain: string
          email_evidence_snippet?: string | null
          email_evidence_type?: string | null
          email_source_url?: string | null
          email_validation_notes?: string | null
          email_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          email_verification_method?: string | null
          email_verification_result?: Json | null
          email_verified_at?: string | null
          enrichment_data?: Json | null
          enrichment_providers_used?: Json | null
          full_name?: string | null
          id?: string
          intent_signals_count?: number | null
          is_suppressed?: boolean | null
          job_id?: string | null
          latest_intent_signal?: string | null
          lead_score?: number | null
          lead_type?: string | null
          linkedin_search_url?: string | null
          name_evidence_snippet?: string | null
          name_evidence_type?: string | null
          name_source_url?: string | null
          phone_evidence_snippet?: string | null
          phone_evidence_type?: string | null
          phone_line_type?: string | null
          phone_source_url?: string | null
          phone_validation_notes?: string | null
          phone_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          phone_verification_method?: string | null
          phone_verification_result?: Json | null
          phone_verified_at?: string | null
          priority?: string | null
          qc_flag?: string | null
          qc_notes?: string | null
          recommended_action?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schema_data?: Json | null
          schema_evidence?: Json | null
          schema_template_id?: string | null
          score_breakdown?: Json | null
          scraped_at?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["scraped_lead_status"]
          suppression_reason?: string | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          address_evidence_snippet?: string | null
          address_evidence_type?: string | null
          address_source_url?: string | null
          ai_insights?: string | null
          all_emails?: Json | null
          all_phones?: Json | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_to_org?: string | null
          best_contact_selection_reason?: string | null
          best_contact_title?: string | null
          best_email?: string | null
          best_phone?: string | null
          confidence_score?: number | null
          contact_form_source_url?: string | null
          contact_form_url?: string | null
          created_at?: string
          domain?: string
          email_evidence_snippet?: string | null
          email_evidence_type?: string | null
          email_source_url?: string | null
          email_validation_notes?: string | null
          email_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          email_verification_method?: string | null
          email_verification_result?: Json | null
          email_verified_at?: string | null
          enrichment_data?: Json | null
          enrichment_providers_used?: Json | null
          full_name?: string | null
          id?: string
          intent_signals_count?: number | null
          is_suppressed?: boolean | null
          job_id?: string | null
          latest_intent_signal?: string | null
          lead_score?: number | null
          lead_type?: string | null
          linkedin_search_url?: string | null
          name_evidence_snippet?: string | null
          name_evidence_type?: string | null
          name_source_url?: string | null
          phone_evidence_snippet?: string | null
          phone_evidence_type?: string | null
          phone_line_type?: string | null
          phone_source_url?: string | null
          phone_validation_notes?: string | null
          phone_validation_status?:
            | Database["public"]["Enums"]["validation_status"]
            | null
          phone_verification_method?: string | null
          phone_verification_result?: Json | null
          phone_verified_at?: string | null
          priority?: string | null
          qc_flag?: string | null
          qc_notes?: string | null
          recommended_action?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          schema_data?: Json | null
          schema_evidence?: Json | null
          schema_template_id?: string | null
          score_breakdown?: Json | null
          scraped_at?: string | null
          source_type?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["scraped_lead_status"]
          suppression_reason?: string | null
          tags?: string[] | null
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
      search_credits: {
        Row: {
          created_at: string
          free_searches_used: number
          id: string
          purchased_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_searches_used?: number
          id?: string
          purchased_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_searches_used?: number
          id?: string
          purchased_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signal_subscriptions: {
        Row: {
          config: Json | null
          created_at: string
          folder: string | null
          frequency: string
          id: string
          is_active: boolean
          monthly_matches: number
          name: string
          notify_email: boolean
          notify_in_app: boolean
          signal_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          folder?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          monthly_matches?: number
          name: string
          notify_email?: boolean
          notify_in_app?: boolean
          signal_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          folder?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          monthly_matches?: number
          name?: string
          notify_email?: boolean
          notify_in_app?: boolean
          signal_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      source_analytics: {
        Row: {
          avg_confidence_score: number | null
          avg_lead_score: number | null
          cost_per_conversion: number | null
          cost_per_lead: number | null
          created_at: string
          id: string
          leads_assigned: number | null
          leads_converted: number | null
          leads_enriched: number | null
          leads_generated: number | null
          leads_verified: number | null
          period_end: string
          period_start: string
          source_identifier: string | null
          source_type: string
          total_cost_usd: number | null
        }
        Insert: {
          avg_confidence_score?: number | null
          avg_lead_score?: number | null
          cost_per_conversion?: number | null
          cost_per_lead?: number | null
          created_at?: string
          id?: string
          leads_assigned?: number | null
          leads_converted?: number | null
          leads_enriched?: number | null
          leads_generated?: number | null
          leads_verified?: number | null
          period_end: string
          period_start: string
          source_identifier?: string | null
          source_type: string
          total_cost_usd?: number | null
        }
        Update: {
          avg_confidence_score?: number | null
          avg_lead_score?: number | null
          cost_per_conversion?: number | null
          cost_per_lead?: number | null
          created_at?: string
          id?: string
          leads_assigned?: number | null
          leads_converted?: number | null
          leads_enriched?: number | null
          leads_generated?: number | null
          leads_verified?: number | null
          period_end?: string
          period_start?: string
          source_identifier?: string | null
          source_type?: string
          total_cost_usd?: number | null
        }
        Relationships: []
      }
      suppression_list_client: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          organization_id: string
          reason: string | null
          suppression_type: string
          value: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          organization_id: string
          reason?: string | null
          suppression_type: string
          value: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          organization_id?: string
          reason?: string | null
          suppression_type?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppression_list_client_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppression_list_global: {
        Row: {
          added_by: string | null
          created_at: string
          id: string
          reason: string | null
          suppression_type: string
          value: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          suppression_type: string
          value: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          suppression_type?: string
          value?: string
        }
        Relationships: []
      }
      team_activity_log: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_activity_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
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
      team_performance_snapshots: {
        Row: {
          avg_response_time_minutes: number | null
          calls_made: number
          created_at: string
          emails_sent: number
          id: string
          leads_contacted: number
          leads_converted: number
          leads_created: number
          pipeline_value: number | null
          revenue_generated: number | null
          sms_sent: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          avg_response_time_minutes?: number | null
          calls_made?: number
          created_at?: string
          emails_sent?: number
          id?: string
          leads_contacted?: number
          leads_converted?: number
          leads_created?: number
          pipeline_value?: number | null
          revenue_generated?: number | null
          sms_sent?: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          avg_response_time_minutes?: number | null
          calls_made?: number
          created_at?: string
          emails_sent?: number
          id?: string
          leads_contacted?: number
          leads_converted?: number
          leads_created?: number
          pipeline_value?: number | null
          revenue_generated?: number | null
          sms_sent?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_email_accounts: {
        Row: {
          created_at: string
          email_address: string
          id: string
          is_default: boolean
          is_verified: boolean
          label: string
          last_used_at: string | null
          smtp_host: string
          smtp_password_encrypted: string
          smtp_port: number
          smtp_username: string
          updated_at: string
          use_tls: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label?: string
          last_used_at?: string | null
          smtp_host: string
          smtp_password_encrypted: string
          smtp_port?: number
          smtp_username: string
          updated_at?: string
          use_tls?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string
          id?: string
          is_default?: boolean
          is_verified?: boolean
          label?: string
          last_used_at?: string | null
          smtp_host?: string
          smtp_password_encrypted?: string
          smtp_port?: number
          smtp_username?: string
          updated_at?: string
          use_tls?: boolean
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_phone_numbers: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          label: string
          phone_number: string
          twilio_validation_code: string | null
          updated_at: string
          user_id: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone_number: string
          twilio_validation_code?: string | null
          updated_at?: string
          user_id: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string
          phone_number?: string
          twilio_validation_code?: string | null
          updated_at?: string
          user_id?: string
          verification_status?: string
          verified_at?: string | null
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
      verification_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          id: string
          input_value: string
          provider: string | null
          result_data: Json | null
          result_status: string
          verification_type: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          id?: string
          input_value: string
          provider?: string | null
          result_data?: Json | null
          result_status: string
          verification_type: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          id?: string
          input_value?: string
          provider?: string | null
          result_data?: Json | null
          result_status?: string
          verification_type?: string
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
      webhook_delivery_log: {
        Row: {
          delivered_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          success: boolean
          webhook_id: string
        }
        Insert: {
          delivered_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          success: boolean
          webhook_id: string
        }
        Update: {
          delivered_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          success?: boolean
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_delivery_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "client_webhooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_delivery_log_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "client_webhooks_safe"
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
      client_api_keys_safe: {
        Row: {
          api_key_prefix: string | null
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string | null
          is_active: boolean | null
          key_name: string | null
          last_used_at: string | null
          organization_id: string | null
          permissions: Json | null
          rate_limit_per_minute: number | null
        }
        Insert: {
          api_key_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_name?: string | null
          last_used_at?: string | null
          organization_id?: string | null
          permissions?: Json | null
          rate_limit_per_minute?: number | null
        }
        Update: {
          api_key_prefix?: string | null
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string | null
          is_active?: boolean | null
          key_name?: string | null
          last_used_at?: string | null
          organization_id?: string | null
          permissions?: Json | null
          rate_limit_per_minute?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_webhooks_safe: {
        Row: {
          created_at: string | null
          created_by: string | null
          events: Json | null
          failure_count: number | null
          id: string | null
          is_active: boolean | null
          last_triggered_at: string | null
          name: string | null
          organization_id: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          events?: Json | null
          failure_count?: number | null
          id?: string | null
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string | null
          organization_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          events?: Json | null
          failure_count?: number | null
          id?: string | null
          is_active?: boolean | null
          last_triggered_at?: string | null
          name?: string | null
          organization_id?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "client_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_chat_rate_limit: {
        Args: { session_uuid: string }
        Returns: boolean
      }
      get_organization_api_keys: {
        Args: { p_organization_id: string }
        Returns: {
          api_key_prefix: string
          created_at: string
          created_by: string
          expires_at: string
          id: string
          is_active: boolean
          key_name: string
          last_used_at: string
          organization_id: string
          permissions: Json
          rate_limit_per_minute: number
        }[]
      }
      get_organization_webhooks: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          created_by: string
          events: Json
          failure_count: number
          id: string
          is_active: boolean
          last_triggered_at: string
          name: string
          organization_id: string
          webhook_url: string
        }[]
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
      enrichment_provider:
        | "apollo"
        | "hunter"
        | "clearbit"
        | "manual"
        | "pdl"
        | "snovio"
        | "rocketreach"
        | "lusha"
        | "contactout"
        | "google_search"
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
      enrichment_provider: [
        "apollo",
        "hunter",
        "clearbit",
        "manual",
        "pdl",
        "snovio",
        "rocketreach",
        "lusha",
        "contactout",
        "google_search",
      ],
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
