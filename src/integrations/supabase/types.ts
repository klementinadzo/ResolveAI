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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          arr: number
          contact_name: string
          created_at: string
          id: string
          initials: string
          name: string
          owner: string
          renewal_date: string
          risk: Database["public"]["Enums"]["account_risk"]
          sentiment: Database["public"]["Enums"]["account_sentiment"]
          summary: string
          tier: Database["public"]["Enums"]["account_tier"]
          updated_at: string
          user_count: number
        }
        Insert: {
          arr?: number
          contact_name: string
          created_at?: string
          id: string
          initials: string
          name: string
          owner: string
          renewal_date: string
          risk: Database["public"]["Enums"]["account_risk"]
          sentiment: Database["public"]["Enums"]["account_sentiment"]
          summary?: string
          tier: Database["public"]["Enums"]["account_tier"]
          updated_at?: string
          user_count?: number
        }
        Update: {
          arr?: number
          contact_name?: string
          created_at?: string
          id?: string
          initials?: string
          name?: string
          owner?: string
          renewal_date?: string
          risk?: Database["public"]["Enums"]["account_risk"]
          sentiment?: Database["public"]["Enums"]["account_sentiment"]
          summary?: string
          tier?: Database["public"]["Enums"]["account_tier"]
          updated_at?: string
          user_count?: number
        }
        Relationships: []
      }
      follow_ups: {
        Row: {
          account_id: string
          completed_at: string | null
          created_at: string
          due_date: string
          id: string
          owner: string
          reason: string
          status: Database["public"]["Enums"]["follow_up_status"]
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at: string
        }
        Insert: {
          account_id: string
          completed_at?: string | null
          created_at?: string
          due_date: string
          id?: string
          owner: string
          reason: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Update: {
          account_id?: string
          completed_at?: string | null
          created_at?: string
          due_date?: string
          id?: string
          owner?: string
          reason?: string
          status?: Database["public"]["Enums"]["follow_up_status"]
          type?: Database["public"]["Enums"]["follow_up_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_name: string
          body: string
          created_at: string
          from_customer: boolean
          id: string
          sent_at: string
          ticket_id: string
        }
        Insert: {
          author_name: string
          body: string
          created_at?: string
          from_customer: boolean
          id?: string
          sent_at?: string
          ticket_id: string
        }
        Update: {
          author_name?: string
          body?: string
          created_at?: string
          from_customer?: boolean
          id?: string
          sent_at?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          account_id: string
          assignee: string
          category: string
          created_at: string
          draft: string
          id: string
          knowledge: string[]
          opened_on: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          reopened: boolean
          status: Database["public"]["Enums"]["ticket_status"]
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          assignee?: string
          category: string
          created_at?: string
          draft?: string
          id: string
          knowledge?: string[]
          opened_on: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          reopened?: boolean
          status?: Database["public"]["Enums"]["ticket_status"]
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          assignee?: string
          category?: string
          created_at?: string
          draft?: string
          id?: string
          knowledge?: string[]
          opened_on?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          reopened?: boolean
          status?: Database["public"]["Enums"]["ticket_status"]
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_events: {
        Row: {
          account_id: string
          created_at: string
          detail: string
          id: string
          kind: Database["public"]["Enums"]["timeline_kind"]
          occurred_at: string
          title: string
        }
        Insert: {
          account_id: string
          created_at?: string
          detail?: string
          id?: string
          kind: Database["public"]["Enums"]["timeline_kind"]
          occurred_at?: string
          title: string
        }
        Update: {
          account_id?: string
          created_at?: string
          detail?: string
          id?: string
          kind?: Database["public"]["Enums"]["timeline_kind"]
          occurred_at?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      account_risk: "High" | "Medium" | "Low"
      account_sentiment: "Declining" | "Stable" | "Improving"
      account_tier: "Enterprise" | "Growth" | "Starter"
      follow_up_status: "Open" | "Done"
      follow_up_type:
        | "Customer check-in"
        | "Escalate to Customer Success Lead"
        | "Executive outreach"
        | "Recovery plan"
      ticket_priority: "High" | "Medium" | "Low"
      ticket_status: "Open" | "Pending" | "Escalated" | "Resolved"
      timeline_kind: "ticket" | "followup" | "reply" | "risk"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      account_risk: ["High", "Medium", "Low"],
      account_sentiment: ["Declining", "Stable", "Improving"],
      account_tier: ["Enterprise", "Growth", "Starter"],
      follow_up_status: ["Open", "Done"],
      follow_up_type: [
        "Customer check-in",
        "Escalate to Customer Success Lead",
        "Executive outreach",
        "Recovery plan",
      ],
      ticket_priority: ["High", "Medium", "Low"],
      ticket_status: ["Open", "Pending", "Escalated", "Resolved"],
      timeline_kind: ["ticket", "followup", "reply", "risk"],
    },
  },
} as const
