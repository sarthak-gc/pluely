// Call playbooks: the objectives a call should cover and the topics it should
// stay on. Hardcoded for now — this is the data model a playbook editor would
// later persist alongside system prompts.

export interface PlaybookItem {
  id: string;
  label: string;
  // What actually counts as covering this item. Sent to the model as guidance,
  // so keep it concrete — vague hints produce false ticks.
  hint: string;
}

export interface Playbook {
  id: string;
  name: string;
  goal: string;
  topics: string[];
  items: PlaybookItem[];
}

export const SALES_DISCOVERY_PLAYBOOK: Playbook = {
  id: "sales-discovery",
  name: "Sales discovery",
  goal: "Qualify the prospect and agree a concrete next step.",
  topics: [
    "the prospect's current workflow and tooling",
    "problems and cost of their current approach",
    "budget and purchasing process",
    "who decides and who else is involved",
    "timeline",
    "next steps",
  ],
  items: [
    {
      id: "current-process",
      label: "Understood their current process",
      hint: "The prospect has described how they handle this today, including any tool they currently use.",
    },
    {
      id: "pain",
      label: "Identified a specific pain",
      hint: "A concrete problem or cost of the status quo was named — not a generic complaint.",
    },
    {
      id: "budget",
      label: "Established budget",
      hint: "A number, range, existing spend, or an explicit statement about willingness to pay was given.",
    },
    {
      id: "authority",
      label: "Identified the decision maker",
      hint: "It is clear who signs off, or who else needs to be involved in the decision.",
    },
    {
      id: "next-step",
      label: "Agreed a concrete next step",
      hint: "A specific follow-up action was agreed, ideally with a date or timeframe.",
    },
  ],
};

export const PLAYBOOKS: Playbook[] = [SALES_DISCOVERY_PLAYBOOK];
