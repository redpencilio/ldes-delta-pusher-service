export type Term = {
  type: string;
  datatype?: string;
  value: string | number | boolean;
} & ({
  "xml:lang"?: string;
  lang?: never;
} | {
  "xml:lang"?: never;
  lang?: string;
});

export type Quad = {
  subject: Term;
  predicate: Term;
  object: Term;
};

export type Changeset = {
  inserts: Quad[];
  deletes: Quad[];
};
