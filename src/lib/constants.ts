export const CGE_BOARD_ID = "cge";
export const ASESI_BOARD_ID = "asesi";
export const ASESI_TEAM_ID = "asesi-team";

export const CGE_LIST_IDS = {
  backlog: "cge-list-backlog",
  doing: "cge-list-doing",
  done: "cge-list-done",
  risks: "cge-list-maya-risks",
} as const;

export const ASESI_LIST_IDS = {
  backlog: "asesi-list-backlog",
  doing: "asesi-list-doing",
  review: "asesi-list-review",
  done: "asesi-list-done",
  risks: "asesi-list-maya-risks",
} as const;

export const MAYA_RISKS_LIST_KEY = "maya-risks" as const;
export const MAYA_RISKS_LIST_TITLE = "Riscos Maya";
export const MAYA_GIT_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
