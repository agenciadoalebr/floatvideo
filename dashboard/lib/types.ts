export type Project = {
  id: string;
  organization_id: string;
  name: string;
  domain: string | null;
  embed_key: string;
  created_at: string;
};

export type VideoStatus = "processing" | "ready" | "error";

export type Video = {
  id: string;
  project_id: string;
  name: string | null;
  source_type: "upload" | "youtube";
  youtube_id: string | null;
  original_file_key: string | null;
  mp4_url: string | null;
  webm_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  status: VideoStatus;
  error_message: string | null;
  created_at: string;
};

export type Widget = {
  id: string;
  project_id: string;
  video_id: string | null;
  name: string;
  shape: "round" | "rectangular";
  size: "sm" | "md" | "lg";
  position: "bottom-left" | "bottom-right";
  border_color: string;
  offset_x: number;
  offset_y: number;
  mobile_size: "sm" | "md" | "lg" | null;
  mobile_position: "bottom-left" | "bottom-right" | null;
  mobile_offset_x: number | null;
  mobile_offset_y: number | null;
  autoplay: boolean;
  muted_start: boolean;
  delay_seconds: number;
  is_active: boolean;
  created_at: string;
};

export type OrgRole = "owner" | "admin" | "editor";

export type Member = {
  user_id: string;
  role: OrgRole;
  email: string;
  created_at: string;
};

export type Invite = {
  id: string;
  email: string;
  role: OrgRole;
  created_at: string;
  accepted_at: string | null;
};

export type Lead = {
  id: string;
  widget_id: string;
  video_id: string | null;
  data: Record<string, unknown>;
  page_url: string | null;
  session_id: string | null;
  created_at: string;
};

export type WidgetCta = {
  id: string;
  widget_id: string;
  type: "link" | "whatsapp" | "form";
  label: string;
  target_url: string | null;
  form_fields: { name: string; label: string; type: string; required: boolean }[] | null;
};
