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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      assignees: {
        Row: {
          created_at: string
          department_id: string | null
          email: string | null
          id: string
          name: string
          user_id: string
          weekly_capacity: number
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          name: string
          user_id: string
          weekly_capacity?: number
        }
        Update: {
          created_at?: string
          department_id?: string | null
          email?: string | null
          id?: string
          name?: string
          user_id?: string
          weekly_capacity?: number
        }
        Relationships: [
          {
            foreignKeyName: "assignees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          completed: boolean
          created_at: string
          due_date: string | null
          id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_date?: string | null
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string
          country: string
          created_at: string
          email: string
          id: string
          name: string
          phone: string
          position: string
          user_id: string
        }
        Insert: {
          company?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          position?: string
          user_id: string
        }
        Update: {
          company?: string
          country?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string
          position?: string
          user_id?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      email_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          enabled: boolean
          id: string
          selected_assignee_ids: Json
          selected_topic_ids: Json
          send_all_topics: boolean
          send_hour: number
          send_minute: number
          send_to_all_assignees: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          id?: string
          selected_assignee_ids?: Json
          selected_topic_ids?: Json
          send_all_topics?: boolean
          send_hour?: number
          send_minute?: number
          send_to_all_assignees?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          enabled?: boolean
          id?: string
          selected_assignee_ids?: Json
          selected_topic_ids?: Json
          send_all_topics?: boolean
          send_hour?: number
          send_minute?: number
          send_to_all_assignees?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      entry_attachments: {
        Row: {
          created_at: string
          entry_id: string
          entry_type: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          entry_type: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          entry_type?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
        }
        Relationships: []
      }
      note_sections: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          notebook_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          notebook_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          notebook_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          id: string
          note_id: string
          tag_id: string
        }
        Insert: {
          id?: string
          note_id: string
          tag_id: string
        }
        Update: {
          id?: string
          note_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          notebook_id: string | null
          section_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string | null
          section_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          notebook_id?: string | null
          section_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "note_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_emails: {
        Row: {
          assignee_email: string
          assignee_name: string
          confirmed: boolean
          confirmed_at: string | null
          email_type: string
          id: string
          responded: boolean
          responded_at: string | null
          sent_at: string
          topic_id: string
          user_id: string
        }
        Insert: {
          assignee_email: string
          assignee_name: string
          confirmed?: boolean
          confirmed_at?: string | null
          email_type?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          sent_at?: string
          topic_id: string
          user_id: string
        }
        Update: {
          assignee_email?: string
          assignee_name?: string
          confirmed?: boolean
          confirmed_at?: string | null
          email_type?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          sent_at?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_emails_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          topic_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          topic_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_completions: {
        Row: {
          completed_date: string
          created_at: string
          id: string
          reminder_id: string
          user_id: string
        }
        Insert: {
          completed_date: string
          created_at?: string
          id?: string
          reminder_id: string
          user_id: string
        }
        Update: {
          completed_date?: string
          created_at?: string
          id?: string
          reminder_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_completions_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          color: string
          created_at: string
          id: string
          recurrence_day: number
          recurrence_months: number
          recurrence_type: string
          recurrence_week: number | null
          title: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          recurrence_day: number
          recurrence_months?: number
          recurrence_type: string
          recurrence_week?: number | null
          title: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          recurrence_day?: number
          recurrence_months?: number
          recurrence_type?: string
          recurrence_week?: number | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          content: string
          created_at: string
          id: string
          period_end: string
          period_start: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          period_end: string
          period_start: string
          title: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          period_end?: string
          period_start?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      score_snapshots: {
        Row: {
          assignee_name: string
          created_at: string
          dimensions: Json
          id: string
          score: number
          snapshot_date: string
          user_id: string
        }
        Insert: {
          assignee_name: string
          created_at?: string
          dimensions?: Json
          id?: string
          score: number
          snapshot_date?: string
          user_id: string
        }
        Update: {
          assignee_name?: string
          created_at?: string
          dimensions?: Json
          id?: string
          score?: number
          snapshot_date?: string
          user_id?: string
        }
        Relationships: []
      }
      subtask_contacts: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          sort_order: number
          subtask_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          sort_order?: number
          subtask_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          sort_order?: number
          subtask_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtask_contacts_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtask_entries: {
        Row: {
          content: string
          created_at: string
          id: string
          subtask_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          subtask_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          subtask_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtask_entries_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      subtasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          contact: string
          created_at: string
          due_date: string | null
          id: string
          notes: string
          responsible: string
          sort_order: number
          title: string
          topic_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          contact?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string
          responsible?: string
          sort_order?: number
          title: string
          topic_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          contact?: string
          created_at?: string
          due_date?: string | null
          id?: string
          notes?: string
          responsible?: string
          sort_order?: number
          title?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      topic_reschedules: {
        Row: {
          created_at: string
          id: string
          is_external: boolean
          new_date: string | null
          previous_date: string | null
          reason: string
          topic_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_external?: boolean
          new_date?: string | null
          previous_date?: string | null
          reason?: string
          topic_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_external?: boolean
          new_date?: string | null
          previous_date?: string | null
          reason?: string
          topic_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_reschedules_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_tags: {
        Row: {
          id: string
          tag_id: string
          topic_id: string
        }
        Insert: {
          id?: string
          tag_id: string
          topic_id: string
        }
        Update: {
          id?: string
          tag_id?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_tags_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          assignee: string | null
          closed_at: string | null
          created_at: string
          department_id: string | null
          due_date: string | null
          execution_order: number | null
          hh_type: string | null
          hh_value: number | null
          id: string
          is_ongoing: boolean
          pause_reason: string
          paused_at: string | null
          pinned: boolean
          priority: Database["public"]["Enums"]["topic_priority"]
          progress_notes: string | null
          sort_order: number
          start_date: string | null
          status: Database["public"]["Enums"]["topic_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          due_date?: string | null
          execution_order?: number | null
          hh_type?: string | null
          hh_value?: number | null
          id?: string
          is_ongoing?: boolean
          pause_reason?: string
          paused_at?: string | null
          pinned?: boolean
          priority?: Database["public"]["Enums"]["topic_priority"]
          progress_notes?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["topic_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          due_date?: string | null
          execution_order?: number | null
          hh_type?: string | null
          hh_value?: number | null
          id?: string
          is_ongoing?: boolean
          pause_reason?: string
          paused_at?: string | null
          pinned?: boolean
          priority?: Database["public"]["Enums"]["topic_priority"]
          progress_notes?: string | null
          sort_order?: number
          start_date?: string | null
          status?: Database["public"]["Enums"]["topic_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      worker_incidents: {
        Row: {
          assignee_email: string
          assignee_name: string
          category: Database["public"]["Enums"]["incident_category"]
          created_at: string
          description: string
          email_sent: boolean
          email_sent_at: string | null
          id: string
          incident_date: string
          title: string
          user_id: string
        }
        Insert: {
          assignee_email?: string
          assignee_name: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          incident_date?: string
          title: string
          user_id: string
        }
        Update: {
          assignee_email?: string
          assignee_name?: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          description?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          incident_date?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      owns_entry_attachment: {
        Args: { _entry_id: string; _entry_type: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      incident_category: "leve" | "moderada" | "grave"
      topic_priority: "alta" | "media" | "baja"
      topic_status: "activo" | "completado" | "pausado" | "seguimiento"
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
      incident_category: ["leve", "moderada", "grave"],
      topic_priority: ["alta", "media", "baja"],
      topic_status: ["activo", "completado", "pausado", "seguimiento"],
    },
  },
} as const
