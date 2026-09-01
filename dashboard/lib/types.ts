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
  /** Enquadramento dentro do balão, 0..100 em cada eixo (50/50 = centro). */
  focal_x: number;
  focal_y: number;
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
  /** Cor do botão de ação, para qualquer tipo de CTA. */
  cta_color: string;
  offset_x: number;
  offset_y: number;
  mobile_size: "sm" | "md" | "lg" | null;
  mobile_position: "bottom-left" | "bottom-right" | null;
  mobile_offset_x: number | null;
  mobile_offset_y: number | null;
  autoplay: boolean;
  muted_start: boolean;
  delay_seconds: number;
  /** Depois de fechado, quantas horas até o vídeo voltar a aparecer. */
  reappear_hours: number;
  is_active: boolean;
  notify_webhook_url: string | null;
  notify_email: string | null;
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

export type PageRule = {
  id: string;
  widget_id: string;
  video_id: string;
  match_type: "contains" | "exact" | "all";
  pattern: string;
  created_at: string;
};

export type CtaType =
  | "whatsapp"
  | "whatsapp_form"
  | "form"
  | "buy"
  | "none"
  /** Legado: projetos antigos podem ter isso gravado. */
  | "link";

/** Plataforma de e-commerce do site, usada só pelo botão Comprar. */
export type BuyPlatform =
  | "auto"
  | "vtex"
  | "loja_integrada"
  | "nuvemshop"
  | "woocommerce"
  | "shopify"
  | "wix"
  | "tray"
  | "custom";

export type WidgetCta = {
  id: string;
  widget_id: string;
  type: CtaType;
  label: string;
  target_url: string | null;
  form_fields: { name: string; label: string; type: string; required: boolean }[] | null;
  buy_platform: BuyPlatform | null;
  /** Seletor CSS próprio, para lojas fora das plataformas conhecidas. */
  buy_selector: string | null;
};
