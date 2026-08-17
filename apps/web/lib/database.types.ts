export type PlanStatus = "trial" | "active" | "past_due" | "canceled";
export type UserRole = "owner" | "member";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

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
    };
    CompositeTypes: Record<string, never>;
  };
}
