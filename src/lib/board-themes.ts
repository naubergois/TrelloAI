import type { Board } from "./types";
import { ensureBoardHierarchy } from "./board-hierarchy";

export type BoardBackgroundId =
  | "ceara"
  | "terra-da-luz"
  | "litoral"
  | "iracema"
  | "trello"
  | "trello-sage"
  | "trello-gold"
  | "trello-berry"
  | "trello-lilac"
  | "trello-petal"
  | "midnight"
  | "ocean"
  | "forest"
  | "sunset"
  | "graphite"
  | "aurora"
  | "ember"
  | "slate";

export type BoardDesignId = "classic" | "soft" | "compact" | "dense";

export interface BoardBackground {
  id: BoardBackgroundId;
  name: string;
  description: string;
  /** Preview swatch for gallery cards */
  preview: string;
  /** Full-page background for the open board */
  surface: string;
}

export interface BoardDesign {
  id: BoardDesignId;
  name: string;
  description: string;
  vars: {
    "--board-radius": string;
    "--board-list-radius": string;
    "--board-card-radius": string;
    "--board-gap": string;
    "--board-panel-alpha": string;
    "--board-list-width": string;
  };
}

const BOARD_SURFACE_VARS = {
  "--board-list-bg": "rgba(255, 255, 255, 0.14)",
  "--board-list-border": "rgba(255, 255, 255, 0.22)",
  "--board-list-header-border": "rgba(255, 255, 255, 0.14)",
  "--board-card-bg": "#ffffff",
  "--board-card-text": "#172b4d",
  "--board-card-muted": "#5e6c84",
  "--board-card-border": "rgba(9, 30, 66, 0.08)",
  "--board-header-bar": "rgba(0, 0, 0, 0.15)",
} as const;

export const BOARD_BACKGROUNDS: BoardBackground[] = [
  {
    id: "ceara",
    name: "Ceará",
    description: "Verde e ouro da bandeira do Estado",
    preview:
      "radial-gradient(180px 120px at 80% 10%, rgba(255,209,0,0.55), transparent 55%), linear-gradient(160deg,#04662e,#00863b 50%,#0b3d22)",
    surface:
      "radial-gradient(900px 480px at 88% 0%, rgba(255,209,0,0.28), transparent 55%), radial-gradient(800px 420px at 12% -8%, rgba(255,255,255,0.12), transparent 55%), linear-gradient(165deg,#04662e 0%,#00863b 46%,#0b3d22 100%)",
  },
  {
    id: "terra-da-luz",
    name: "Terra da Luz",
    description: "Sol do Mucuripe sobre o sertão",
    preview:
      "radial-gradient(160px 110px at 70% 15%, rgba(255,209,0,0.7), transparent 50%), linear-gradient(155deg,#6b4c2f,#eb5f0a 48%,#04662e)",
    surface:
      "radial-gradient(700px 400px at 85% -5%, rgba(255,209,0,0.35), transparent 50%), linear-gradient(160deg,#3d2a18 0%,#6b4c2f 38%,#8a4a16 70%,#04662e 100%)",
  },
  {
    id: "litoral",
    name: "Litoral",
    description: "Jangada no mar de Fortaleza",
    preview:
      "linear-gradient(180deg,#1a6b8a 0%,#0e8a6a 45%,#c9a24a 78%,#00863b 100%)",
    surface:
      "radial-gradient(900px 420px at 20% 0%, rgba(255,255,255,0.16), transparent 50%), linear-gradient(180deg,#0c4a62 0%,#127a8a 40%,#c9a24a 78%,#04662e 100%)",
  },
  {
    id: "iracema",
    name: "Iracema",
    description: "Laranja do Governo do Ceará",
    preview: "linear-gradient(155deg,#8a3208,#eb5f0a 50%,#04662e)",
    surface:
      "radial-gradient(800px 420px at 90% 0%, rgba(255,209,0,0.2), transparent 55%), linear-gradient(165deg,#5a2208 0%,#eb5f0a 48%,#04662e 100%)",
  },
  {
    id: "trello",
    name: "Azul clássico",
    description: "Azul profundo",
    preview: "linear-gradient(160deg,#026aa7,#0079bf 55%,#055a8c)",
    surface:
      "radial-gradient(900px 480px at 12% -8%, rgba(255,255,255,0.14), transparent 55%), radial-gradient(700px 420px at 88% 0%, rgba(0,121,191,0.35), transparent 50%), linear-gradient(165deg,#026aa7 0%,#0079bf 42%,#055a8c 100%)",
  },
  {
    id: "trello-sage",
    name: "Verde",
    description: "Verde Trello",
    preview: "linear-gradient(155deg,#3f6f21,#519839 50%,#49852e)",
    surface:
      "radial-gradient(800px 420px at 15% 0%, rgba(255,255,255,0.12), transparent 55%), linear-gradient(165deg,#3f6f21 0%,#519839 48%,#49852e 100%)",
  },
  {
    id: "trello-gold",
    name: "Dourado",
    description: "Âmbar caloroso",
    preview: "linear-gradient(155deg,#8f5a18,#d29034 50%,#b87d2b)",
    surface:
      "radial-gradient(800px 420px at 85% 0%, rgba(255,255,255,0.1), transparent 55%), linear-gradient(165deg,#8f5a18 0%,#d29034 48%,#b87d2b 100%)",
  },
  {
    id: "trello-berry",
    name: "Vermelho",
    description: "Vermelho terroso",
    preview: "linear-gradient(155deg,#7a2e1f,#b04632 50%,#943b2a)",
    surface:
      "radial-gradient(800px 420px at 20% 0%, rgba(255,255,255,0.1), transparent 55%), linear-gradient(165deg,#7a2e1f 0%,#b04632 48%,#943b2a 100%)",
  },
  {
    id: "trello-lilac",
    name: "Lilás",
    description: "Púrpura suave",
    preview: "linear-gradient(155deg,#5c4778,#89609e 50%,#745589)",
    surface:
      "radial-gradient(800px 420px at 80% 0%, rgba(255,255,255,0.1), transparent 55%), linear-gradient(165deg,#5c4778 0%,#89609e 48%,#745589 100%)",
  },
  {
    id: "trello-petal",
    name: "Rosa",
    description: "Rosa petal",
    preview: "linear-gradient(155deg,#8a3d62,#cd5a91 50%,#b44d7d)",
    surface:
      "radial-gradient(800px 420px at 10% 0%, rgba(255,255,255,0.12), transparent 55%), linear-gradient(165deg,#8a3d62 0%,#cd5a91 48%,#b44d7d 100%)",
  },
  {
    id: "midnight",
    name: "Meia-noite",
    description: "Azul profundo com brilho teal",
    preview:
      "radial-gradient(500px 280px at 15% 0%, rgba(46,196,182,0.35), transparent 60%), linear-gradient(160deg,#06101c,#0a1628 50%,#0d1f33)",
    surface:
      "radial-gradient(1200px 600px at 10% -10%, rgba(46,196,182,0.18), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(255,183,3,0.12), transparent 50%), radial-gradient(800px 700px at 50% 110%, rgba(56,132,255,0.14), transparent 55%), linear-gradient(160deg,#06101c 0%,#0a1628 45%,#0d1f33 100%)",
  },
  {
    id: "ocean",
    name: "Oceano",
    description: "Ciano e azul marinho",
    preview:
      "radial-gradient(420px 260px at 80% 10%, rgba(56,189,248,0.35), transparent 55%), linear-gradient(150deg,#042f3a,#0a4a5c 45%,#063447)",
    surface:
      "radial-gradient(1000px 500px at 80% -5%, rgba(56,189,248,0.22), transparent 55%), radial-gradient(800px 600px at 10% 100%, rgba(14,116,144,0.28), transparent 50%), linear-gradient(155deg,#031820 0%,#0a3a48 48%,#052a38 100%)",
  },
  {
    id: "forest",
    name: "Floresta",
    description: "Verde musgo e sombra",
    preview:
      "radial-gradient(400px 240px at 20% 20%, rgba(74,222,128,0.28), transparent 55%), linear-gradient(155deg,#0a1f14,#123024 50%,#0c2418)",
    surface:
      "radial-gradient(900px 500px at 15% 0%, rgba(74,222,128,0.16), transparent 55%), radial-gradient(700px 500px at 90% 80%, rgba(21,128,61,0.2), transparent 50%), linear-gradient(160deg,#07150e 0%,#102418 50%,#0a1c12 100%)",
  },
  {
    id: "sunset",
    name: "Pôr do sol",
    description: "Âmbar quente sobre navy",
    preview:
      "radial-gradient(420px 240px at 70% 0%, rgba(251,146,60,0.4), transparent 55%), linear-gradient(150deg,#1a0f18,#2a1524 40%,#3b1d18)",
    surface:
      "radial-gradient(1000px 480px at 85% -10%, rgba(251,146,60,0.22), transparent 55%), radial-gradient(700px 500px at 10% 90%, rgba(244,63,94,0.12), transparent 50%), linear-gradient(155deg,#120a14 0%,#241018 48%,#1a1210 100%)",
  },
  {
    id: "graphite",
    name: "Grafite",
    description: "Neutro escuro minimalista",
    preview: "linear-gradient(145deg,#141414,#1f1f22 50%,#2a2a2e)",
    surface:
      "radial-gradient(800px 500px at 50% -20%, rgba(255,255,255,0.06), transparent 50%), linear-gradient(160deg,#0e0e10 0%,#17171a 50%,#1c1c20 100%)",
  },
  {
    id: "aurora",
    name: "Aurora",
    description: "Verde-água e azul elétrico",
    preview:
      "linear-gradient(135deg,#062a2e 0%,#0b3d4a 40%,#134e6f 70%,#1a3a5c 100%)",
    surface:
      "radial-gradient(900px 500px at 0% 0%, rgba(45,212,191,0.2), transparent 50%), radial-gradient(800px 500px at 100% 30%, rgba(59,130,246,0.18), transparent 50%), linear-gradient(160deg,#04161a 0%,#0a2c38 45%,#0c2438 100%)",
  },
  {
    id: "ember",
    name: "Brasa",
    description: "Carvão com fogo baixo",
    preview:
      "radial-gradient(380px 220px at 30% 10%, rgba(239,68,68,0.35), transparent 55%), linear-gradient(150deg,#1a0c0c,#2a1210 50%,#1c1010)",
    surface:
      "radial-gradient(900px 480px at 20% -5%, rgba(239,68,68,0.16), transparent 55%), radial-gradient(700px 500px at 90% 100%, rgba(251,146,60,0.12), transparent 50%), linear-gradient(160deg,#120808 0%,#1c0e0c 50%,#160c0a 100%)",
  },
  {
    id: "slate",
    name: "Ardósia",
    description: "Azul-acinzentado sóbrio",
    preview: "linear-gradient(150deg,#1e293b,#334155 55%,#1e293b)",
    surface:
      "radial-gradient(900px 500px at 70% 0%, rgba(148,163,184,0.12), transparent 55%), linear-gradient(160deg,#0f172a 0%,#1e293b 48%,#0f172a 100%)",
  },
];

export const BOARD_DESIGNS: BoardDesign[] = [
  {
    id: "classic",
    name: "Clássico",
    description: "Cantos médios e painéis translúcidos",
    vars: {
      "--board-radius": "1.25rem",
      "--board-list-radius": "1rem",
      "--board-card-radius": "0.75rem",
      "--board-gap": "0.75rem",
      "--board-panel-alpha": "0.72",
      "--board-list-width": "18rem",
    },
  },
  {
    id: "soft",
    name: "Suave",
    description: "Mais arredondado e arejado",
    vars: {
      "--board-radius": "1.75rem",
      "--board-list-radius": "1.35rem",
      "--board-card-radius": "1rem",
      "--board-gap": "1rem",
      "--board-panel-alpha": "0.62",
      "--board-list-width": "18.5rem",
    },
  },
  {
    id: "compact",
    name: "Compacto",
    description: "Mais conteúdo por coluna",
    vars: {
      "--board-radius": "0.85rem",
      "--board-list-radius": "0.75rem",
      "--board-card-radius": "0.55rem",
      "--board-gap": "0.5rem",
      "--board-panel-alpha": "0.8",
      "--board-list-width": "16rem",
    },
  },
  {
    id: "dense",
    name: "Denso",
    description: "Cantos retos e colunas estreitas",
    vars: {
      "--board-radius": "0.5rem",
      "--board-list-radius": "0.4rem",
      "--board-card-radius": "0.35rem",
      "--board-gap": "0.4rem",
      "--board-panel-alpha": "0.88",
      "--board-list-width": "15rem",
    },
  },
];

export const DEFAULT_BACKGROUND_ID: BoardBackgroundId = "ceara";
export const DEFAULT_DESIGN_ID: BoardDesignId = "classic";

export function getBackground(id?: string | null): BoardBackground {
  return (
    BOARD_BACKGROUNDS.find((b) => b.id === id) ??
    BOARD_BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID)!
  );
}

export function getDesign(id?: string | null): BoardDesign {
  return (
    BOARD_DESIGNS.find((d) => d.id === id) ??
    BOARD_DESIGNS.find((d) => d.id === DEFAULT_DESIGN_ID)!
  );
}

export function ensureBoardAppearance(board: Board): Board {
  return ensureBoardHierarchy({
    ...board,
    memberIds: board.memberIds ?? [],
    teamId: board.teamId ?? null,
    backgroundId: (board.backgroundId as BoardBackgroundId) || DEFAULT_BACKGROUND_ID,
    designId: (board.designId as BoardDesignId) || DEFAULT_DESIGN_ID,
  });
}

export function boardThemeStyle(board: Pick<Board, "backgroundId" | "designId">) {
  const bg = getBackground(board.backgroundId);
  const design = getDesign(board.designId);
  return {
    backgroundImage: bg.surface,
    backgroundAttachment: "fixed" as const,
    ...BOARD_SURFACE_VARS,
    ...design.vars,
  };
}
