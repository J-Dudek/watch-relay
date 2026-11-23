export interface Section {
  readonly h: string;
  readonly p: readonly string[];
}
export interface PagesMessages {
  readonly faq: { title: string; items: readonly { q: string; a: readonly string[] }[] };
  readonly privacy: { title: string; sections: readonly Section[] };
  readonly legal: { title: string; sections: readonly Section[] };
}
