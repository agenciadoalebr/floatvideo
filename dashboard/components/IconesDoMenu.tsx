/**
 * Ícones do menu do site.
 *
 * Desenhados aqui, em traço, em vez de uma biblioteca inteira baixada
 * para oito desenhos — e no mesmo peso da tipografia, que é o que faz
 * eles parecerem parte do texto e não adesivos colados.
 */
function Base({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconeVideos = (
  <Base>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5l5 3.5-5 3.5z" />
  </Base>
);

export const IconeUpload = (
  <Base>
    <path d="M12 15V4m0 0L8 8m4-4l4 4" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </Base>
);

export const IconeWidget = (
  <Base>
    <rect x="3" y="3" width="18" height="18" rx="4" />
    <circle cx="16" cy="16" r="3" />
  </Base>
);

export const IconeBotao = (
  <Base>
    <rect x="3" y="7" width="18" height="10" rx="3" />
    <path d="M8 12h8" />
  </Base>
);

export const IconeCodigo = (
  <Base>
    <path d="M9 8l-4 4 4 4M15 8l4 4-4 4" />
  </Base>
);

export const IconeAnalytics = (
  <Base>
    <path d="M4 19h16" />
    <path d="M6 15l4-5 3 3 5-7" />
  </Base>
);

export const IconeLeads = (
  <Base>
    <circle cx="9" cy="9" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0111 0" />
    <path d="M16 8a3 3 0 010 6M17.5 19a5.5 5.5 0 00-2-4.2" />
  </Base>
);

export const IconeMetricas = (
  <Base>
    <path d="M5 20V10M12 20V4M19 20v-7" />
  </Base>
);
