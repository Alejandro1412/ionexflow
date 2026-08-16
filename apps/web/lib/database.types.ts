// Hand-written to match supabase/migrations/20260816120000_init_schema.sql.
// Once `supabase start` is running locally, regenerate the real thing with:
//   pnpm supabase:gen:types
// which overwrites this file from the live schema.

export type PlanStatus = "trial" | "active" | "past_due" | "canceled";
export type UserRole = "owner" | "member";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ExecutionStatus =
  | "pending"
  | "running"
  | "paused"
  | "completed"
  | "failed";

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
        Insert: Partial<Database["public"]["Tables"]["organizations"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Row"]>;
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
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & {
          id: string;
          org_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      workflows: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          nodes: unknown;
          edges: unknown;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workflows"]["Row"]> & {
          org_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workflows"]["Row"]>;
      };
      workflow_executions: {
        Row: {
          id: string;
          workflow_id: string;
          org_id: string;
          status: ExecutionStatus;
          trigger_payload: unknown;
          logs: unknown;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: Partial<
          Database["public"]["Tables"]["workflow_executions"]["Row"]
        > & { workflow_id: string; org_id: string };
        Update: Partial<Database["public"]["Tables"]["workflow_executions"]["Row"]>;
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
          payload: unknown;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["approvals"]["Row"]> & {
          execution_id: string;
          org_id: string;
          node_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["approvals"]["Row"]>;
      };
    };
  };
}
