import { ENTITY_TYPES } from "@/lib/constants";
import type { StatusTone } from "@/lib/crm/constants";

/**
 * Search domain types + the entity registry. Client-safe so the palette and the
 * results page share one definition of the searchable entity set, their Arabic
 * group labels and display order. Icons are mapped in the client
 * (src/components/search/entity-icon.tsx) to keep result payloads serializable.
 */

/** The ten searchable entity kinds (a subset of ENTITY_TYPES). */
export const SEARCH_ENTITY_TYPES = {
  COMPANY: ENTITY_TYPES.COMPANY,
  PROJECT: ENTITY_TYPES.PROJECT,
  SITE: ENTITY_TYPES.SITE,
  PRACTICE: ENTITY_TYPES.PRACTICE,
  CONTRACT: ENTITY_TYPES.CONTRACT,
  PURCHASE: ENTITY_TYPES.PURCHASE,
  DOCUMENT: ENTITY_TYPES.DOCUMENT,
  TASK: ENTITY_TYPES.TASK,
  APPROVAL: ENTITY_TYPES.APPROVAL,
  USER: ENTITY_TYPES.USER,
} as const;

export type SearchEntityType =
  (typeof SEARCH_ENTITY_TYPES)[keyof typeof SEARCH_ENTITY_TYPES];

export interface SearchEntityMeta {
  /** Arabic group heading (plural). */
  label: string;
  /** Display order in the grouped results. */
  order: number;
}

export const SEARCH_ENTITY_META: Record<SearchEntityType, SearchEntityMeta> = {
  COMPANY: { label: "الشركات", order: 1 },
  PROJECT: { label: "المشروعات", order: 2 },
  SITE: { label: "المواقع", order: 3 },
  PRACTICE: { label: "الممارسات", order: 4 },
  CONTRACT: { label: "التعاقدات", order: 5 },
  PURCHASE: { label: "المشتريات", order: 6 },
  DOCUMENT: { label: "المستندات", order: 7 },
  TASK: { label: "المهام", order: 8 },
  APPROVAL: { label: "الاعتمادات", order: 9 },
  USER: { label: "المستخدمون", order: 10 },
};

/** Entity types in display order. */
export const SEARCH_ENTITY_ORDER: SearchEntityType[] = (
  Object.keys(SEARCH_ENTITY_META) as SearchEntityType[]
).sort((a, b) => SEARCH_ENTITY_META[a].order - SEARCH_ENTITY_META[b].order);

export interface SearchStatus {
  label: string;
  tone: StatusTone;
}

/** One normalized search hit — serializable (dates as ISO) for the JSON API. */
export interface SearchResult {
  /** Stable, globally-unique key: `${entityType}:${id}`. */
  key: string;
  id: string;
  entityType: SearchEntityType;
  title: string;
  subtitle: string | null;
  /** Contextual path, e.g. ["التعاقدات", "شركة النصر"]. */
  breadcrumb: string[];
  status: SearchStatus | null;
  href: string;
  /** ISO timestamp of last update, or null. */
  updatedAt: string | null;
  /** Relevance score (higher = better). */
  score: number;
}

/** A group of results for one entity type, with pagination metadata. */
export interface SearchGroup {
  entityType: SearchEntityType;
  label: string;
  items: SearchResult[];
  /** Total matches for this entity (before the per-group slice). */
  total: number;
}

export interface SearchResponse {
  query: string;
  groups: SearchGroup[];
  /** Total matches across every group. */
  total: number;
}
