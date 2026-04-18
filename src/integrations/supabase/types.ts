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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assignees: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string | null
          email: string | null
          id: string
          name: string
          updated_by: string | null
          user_id: string
          weekly_capacity: number
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          id?: string
          name: string
          updated_by?: string | null
          user_id: string
          weekly_capacity?: number
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          email?: string | null
          id?: string
          name?: string
          updated_by?: string | null
          user_id?: string
          weekly_capacity?: number
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignees_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          completed: boolean
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          title: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          title: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          title?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string
          country: string
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          phone: string
          position: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          company?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          position?: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          company?: string
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          position?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      email_schedules: {
        Row: {
          created_at: string
          created_by: string | null
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
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_schedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          entry_id: string
          entry_type: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          entry_id: string
          entry_type: string
          file_name: string
          file_size?: number
          file_type?: string
          file_url: string
          id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          entry_id?: string
          entry_type?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entry_attachments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      note_sections: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          notebook_id: string
          sort_order: number
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          notebook_id: string
          sort_order?: number
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          notebook_id?: string
          sort_order?: number
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "note_sections_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_sections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      note_tags: {
        Row: {
          created_by: string | null
          id: string
          note_id: string
          tag_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_by?: string | null
          id?: string
          note_id: string
          tag_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_by?: string | null
          id?: string
          note_id?: string
          tag_id?: string
          updated_by?: string | null
          workspace_id?: string | null
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
          {
            foreignKeyName: "note_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          notebook_id: string | null
          section_id: string | null
          title: string
          updated_at: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notebook_id?: string | null
          section_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notebook_id?: string | null
          section_id?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
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
          {
            foreignKeyName: "notes_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          created_by: string | null
          email_type: string
          id: string
          responded: boolean
          responded_at: string | null
          reviewed: boolean
          reviewed_at: string | null
          sent_at: string
          topic_id: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          assignee_email: string
          assignee_name: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_by?: string | null
          email_type?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          sent_at?: string
          topic_id: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          assignee_email?: string
          assignee_name?: string
          confirmed?: boolean
          confirmed_at?: string | null
          created_by?: string | null
          email_type?: string
          id?: string
          responded?: boolean
          responded_at?: string | null
          reviewed?: boolean
          reviewed_at?: string | null
          sent_at?: string
          topic_id?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_emails_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          email: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          email?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progress_entries: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          source: string
          topic_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: string
          topic_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          source?: string
          topic_id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_completions: {
        Row: {
          completed_date: string
          created_at: string
          created_by: string | null
          id: string
          reminder_id: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          completed_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          reminder_id: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          completed_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reminder_id?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_completions_reminder_id_fkey"
            columns: ["reminder_id"]
            isOneToOne: false
            referencedRelation: "reminders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_completions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_emails: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          enabled: boolean
          id: string
          message: string
          recipient_emails: Json
          send_hour: number
          subject: string
          updated_at: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          enabled?: boolean
          id?: string
          message?: string
          recipient_emails?: Json
          send_hour?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          enabled?: boolean
          id?: string
          message?: string
          recipient_emails?: Json
          send_hour?: number
          subject?: string
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          recurrence_day: number
          recurrence_months: number
          recurrence_type: string
          recurrence_week: number | null
          title: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recurrence_day: number
          recurrence_months?: number
          recurrence_type: string
          recurrence_week?: number | null
          title: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recurrence_day?: number
          recurrence_months?: number
          recurrence_type?: string
          recurrence_week?: number | null
          title?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          period_end: string
          period_start: string
          title: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end: string
          period_start: string
          title: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          period_end?: string
          period_start?: string
          title?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      score_snapshots: {
        Row: {
          assignee_name: string
          created_at: string
          created_by: string | null
          dimensions: Json
          id: string
          score: number
          snapshot_date: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          assignee_name: string
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          id?: string
          score: number
          snapshot_date?: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          assignee_name?: string
          created_at?: string
          created_by?: string | null
          dimensions?: Json
          id?: string
          score?: number
          snapshot_date?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_snapshots_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subtask_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          sort_order: number
          subtask_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          sort_order?: number
          subtask_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          sort_order?: number
          subtask_id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtask_contacts_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtask_contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      subtask_entries: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          subtask_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          subtask_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          subtask_id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtask_entries_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtask_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          created_by: string | null
          due_date: string | null
          id: string
          notes: string
          responsible: string
          sort_order: number
          title: string
          topic_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          contact?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          responsible?: string
          sort_order?: number
          title: string
          topic_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          contact?: string
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string
          responsible?: string
          sort_order?: number
          title?: string
          topic_id?: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtasks_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_reminders: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          note: string
          reminder_date: string
          sent: boolean
          topic_id: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          reminder_date: string
          sent?: boolean
          topic_id: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string
          reminder_date?: string
          sent?: boolean
          topic_id?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_reminders_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_reminders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_reschedules: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_external: boolean
          new_date: string | null
          previous_date: string | null
          reason: string
          topic_id: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_external?: boolean
          new_date?: string | null
          previous_date?: string | null
          reason?: string
          topic_id: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_external?: boolean
          new_date?: string | null
          previous_date?: string | null
          reason?: string
          topic_id?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_reschedules_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topic_reschedules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_tags: {
        Row: {
          created_by: string | null
          id: string
          tag_id: string
          topic_id: string
          updated_by: string | null
          workspace_id: string | null
        }
        Insert: {
          created_by?: string | null
          id?: string
          tag_id: string
          topic_id: string
          updated_by?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_by?: string | null
          id?: string
          tag_id?: string
          topic_id?: string
          updated_by?: string | null
          workspace_id?: string | null
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
          {
            foreignKeyName: "topic_tags_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          archived: boolean
          assignee: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
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
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          archived?: boolean
          assignee?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          archived?: boolean
          assignee?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
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
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      update_tokens: {
        Row: {
          assignee_name: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          token: string
          topic_id: string | null
          updated_by: string | null
          used: boolean
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          assignee_name: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
          topic_id?: string | null
          updated_by?: string | null
          used?: boolean
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          assignee_name?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          token?: string
          topic_id?: string | null
          updated_by?: string | null
          used?: boolean
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "update_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          created_by: string | null
          description: string
          email_sent: boolean
          email_sent_at: string | null
          id: string
          incident_date: string
          title: string
          updated_by: string | null
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          assignee_email?: string
          assignee_name: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          incident_date?: string
          title: string
          updated_by?: string | null
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          assignee_email?: string
          assignee_name?: string
          category?: Database["public"]["Enums"]["incident_category"]
          created_at?: string
          created_by?: string | null
          description?: string
          email_sent?: boolean
          email_sent_at?: string | null
          id?: string
          incident_date?: string
          title?: string
          updated_by?: string | null
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "worker_incidents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          accepted: boolean
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          accepted?: boolean
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_workspace_role: {
        Args: {
          _min_role: Database["public"]["Enums"]["workspace_role"]
          _user_id: string
          _workspace_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      owns_entry_attachment: {
        Args: { _entry_id: string; _entry_type: string; _user_id: string }
        Returns: boolean
      }
      user_workspace_ids: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      incident_category: "leve" | "moderada" | "grave"
      topic_priority: "alta" | "media" | "baja"
      topic_status: "activo" | "completado" | "pausado" | "seguimiento"
      workspace_role: "owner" | "admin" | "editor" | "viewer"
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
      workspace_role: ["owner", "admin", "editor", "viewer"],
    },
  },
} as const
