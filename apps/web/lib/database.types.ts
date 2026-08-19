export type PlanStatus = "trial" | "active" | "past_due" | "canceled";
export type UserRole = "owner" | "member";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";
export type NotificationType = "approval_pending" | "system";
export type EmailProvider = "gmail" | "outlook" | "resend_inbound" | "imap";
export type EmailConnectionStatus =
  | "disconnected"
  | "demo_connected"
  | "pending_oauth"
  | "active"
  | "error";
export type EmailDirection = "inbound" | "outbound" | "forward";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          plan_status: PlanStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_status?: PlanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          plan_status?: PlanStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          org_id: string;
          full_name: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          org_id: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          full_name?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      workflows: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          nodes: Json;
          edges: Json;
          is_active: boolean;
          schedule_enabled: boolean;
          schedule_every_minutes: number | null;
          last_scheduled_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name?: string;
          nodes?: Json;
          edges?: Json;
          is_active?: boolean;
          schedule_enabled?: boolean;
          schedule_every_minutes?: number | null;
          last_scheduled_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          nodes?: Json;
          edges?: Json;
          is_active?: boolean;
          schedule_enabled?: boolean;
          schedule_every_minutes?: number | null;
          last_scheduled_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "workflows_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          org_id: string;
          status: ExecutionStatus;
          trigger_payload: Json;
          logs: Json;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          resume_at: string | null;
          waiting_node_id: string | null;
        };
        Insert: {
          id?: string;
          workflow_id: string;
          org_id: string;
          status?: ExecutionStatus;
          trigger_payload?: Json;
          logs?: Json;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          resume_at?: string | null;
          waiting_node_id?: string | null;
        };
        Update: {
          id?: string;
          workflow_id?: string;
          org_id?: string;
          status?: ExecutionStatus;
          trigger_payload?: Json;
          logs?: Json;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          resume_at?: string | null;
          waiting_node_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "workflow_executions_workflow_id_fkey";
            columns: ["workflow_id"];
            isOneToOne: false;
            referencedRelation: "workflows";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role: UserRole;
          token: string;
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role?: UserRole;
          token: string;
          invited_by?: string | null;
          expires_at: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role?: UserRole;
          token?: string;
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invites_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      approvals: {
        Row: {
          id: string;
          execution_id: string;
          org_id: string;
          node_id: string;
          status: ApprovalStatus;
          requested_by: string | null;
          reviewed_by: string | null;
          payload: Json;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          execution_id: string;
          org_id: string;
          node_id: string;
          status?: ApprovalStatus;
          requested_by?: string | null;
          reviewed_by?: string | null;
          payload?: Json;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          id?: string;
          execution_id?: string;
          org_id?: string;
          node_id?: string;
          status?: ApprovalStatus;
          requested_by?: string | null;
          reviewed_by?: string | null;
          payload?: Json;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "approvals_execution_id_fkey";
            columns: ["execution_id"];
            isOneToOne: false;
            referencedRelation: "workflow_executions";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string;
          href: string | null;
          meta: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          type?: NotificationType;
          title: string;
          body?: string;
          href?: string | null;
          meta?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          body?: string;
          href?: string | null;
          meta?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      email_connections: {
        Row: {
          id: string;
          org_id: string;
          provider: EmailProvider;
          status: EmailConnectionStatus;
          display_name: string;
          email_address: string | null;
          inbound_token: string;
          default_workflow_id: string | null;
          forward_to: string | null;
          meta: Json;
          last_error: string | null;
          connected_at: string | null;
          created_at: string;
          updated_at: string;
          username: string | null;
          password: string | null;
          imap_host: string | null;
          imap_port: number | null;
          imap_secure: boolean;
          smtp_host: string | null;
          smtp_port: number | null;
          smtp_secure: boolean;
          last_synced_at: string | null;
          auto_sync: boolean;
        };
        Insert: {
          id?: string;
          org_id: string;
          provider: EmailProvider;
          status?: EmailConnectionStatus;
          display_name?: string;
          email_address?: string | null;
          inbound_token?: string;
          default_workflow_id?: string | null;
          forward_to?: string | null;
          meta?: Json;
          last_error?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
          username?: string | null;
          password?: string | null;
          imap_host?: string | null;
          imap_port?: number | null;
          imap_secure?: boolean;
          smtp_host?: string | null;
          smtp_port?: number | null;
          smtp_secure?: boolean;
          last_synced_at?: string | null;
          auto_sync?: boolean;
        };
        Update: {
          id?: string;
          org_id?: string;
          provider?: EmailProvider;
          status?: EmailConnectionStatus;
          display_name?: string;
          email_address?: string | null;
          inbound_token?: string;
          default_workflow_id?: string | null;
          forward_to?: string | null;
          meta?: Json;
          last_error?: string | null;
          connected_at?: string | null;
          created_at?: string;
          updated_at?: string;
          username?: string | null;
          password?: string | null;
          imap_host?: string | null;
          imap_port?: number | null;
          imap_secure?: boolean;
          smtp_host?: string | null;
          smtp_port?: number | null;
          smtp_secure?: boolean;
          last_synced_at?: string | null;
          auto_sync?: boolean;
        };
        Relationships: [];
      };
      email_messages: {
        Row: {
          id: string;
          org_id: string;
          connection_id: string | null;
          execution_id: string | null;
          direction: EmailDirection;
          from_address: string | null;
          to_address: string | null;
          subject: string | null;
          body_text: string | null;
          thread_id: string | null;
          status: string;
          meta: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          connection_id?: string | null;
          execution_id?: string | null;
          direction: EmailDirection;
          from_address?: string | null;
          to_address?: string | null;
          subject?: string | null;
          body_text?: string | null;
          thread_id?: string | null;
          status?: string;
          meta?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          connection_id?: string | null;
          execution_id?: string | null;
          direction?: EmailDirection;
          from_address?: string | null;
          to_address?: string | null;
          subject?: string | null;
          body_text?: string | null;
          thread_id?: string | null;
          status?: string;
          meta?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      current_org_id: { Args: Record<string, never>; Returns: string };
      is_org_owner: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      plan_status: PlanStatus;
      user_role: UserRole;
      approval_status: ApprovalStatus;
      execution_status: ExecutionStatus;
      notification_type: NotificationType;
      email_provider: EmailProvider;
      email_connection_status: EmailConnectionStatus;
      email_direction: EmailDirection;
    };
    CompositeTypes: Record<string, never>;
  };
}
