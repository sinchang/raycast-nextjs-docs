export interface SearchResponse {
  results: Result[];
}

interface Result {
  hits: Hit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  exhaustiveNbHits: boolean;
  exhaustiveTypo: boolean;
  exhaustive: Exhaustive;
  query: Query;
  params: string;
  index: string;
  renderingContent: RenderingContent;
  processingTimeMS: number;
  processingTimingsMS: ProcessingTimingsMS;
}

export interface Exhaustive {
  nbHits: boolean;
  typo: boolean;
}

export interface Hit {
  title: string;
  content: string;
  path: string;
  level: number;
  position: number;
  isParent?: boolean;
  children?: string[];
  objectID: string;
  _highlightResult: HighlightResult;
  section?: string;
  anchor?: string;
  subSection?: string;
  parentName?: string;
}

export interface HighlightResult {
  title: Content;
  content: Content;
  path: Content;
  children?: Content[];
  section?: Content;
  subSection?: Content;
}

export interface Content {
  value: string;
  matchLevel: MatchLevel;
  fullyHighlighted?: boolean;
  matchedWords: Query[];
}

export enum MatchLevel {
  Full = "full",
  None = "none",
}

export enum Query {
  Fetch = "fetch",
}

export interface ProcessingTimingsMS {
  request: Request;
}

export interface Request {
  roundTrip: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface RenderingContent {}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toResponse(json: string): Response {
    return cast(JSON.parse(json), r("Response"));
  }

  public static responseToJson(value: Response): string {
    return JSON.stringify(uncast(value, r("Response")), null, 2);
  }
}

function invalidValue(typ: any, val: any, key: any, parent: any = ""): never {
  const prettyTyp = prettyTypeName(typ);
  const parentText = parent ? ` on ${parent}` : "";
  const keyText = key ? ` for key "${key}"` : "";
  throw Error(`Invalid value${keyText}${parentText}. Expected ${prettyTyp} but got ${JSON.stringify(val)}`);
}

function prettyTypeName(typ: any): string {
  if (Array.isArray(typ)) {
    if (typ.length === 2 && typ[0] === undefined) {
      return `an optional ${prettyTypeName(typ[1])}`;
    } else {
      return `one of [${typ
        .map((a) => {
          return prettyTypeName(a);
        })
        .join(", ")}]`;
    }
  } else if (typeof typ === "object" && typ.literal !== undefined) {
    return typ.literal;
  } else {
    return typeof typ;
  }
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }));
    typ.jsonToJS = map;
  }
  return typ.jsonToJS;
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {};
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }));
    typ.jsToJSON = map;
  }
  return typ.jsToJSON;
}

function transform(val: any, typ: any, getProps: any, key: any = "", parent: any = ""): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val;
    return invalidValue(typ, val, key, parent);
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length;
    for (let i = 0; i < l; i++) {
      const typ = typs[i];
      try {
        return transform(val, typ, getProps);
        // eslint-disable-next-line no-empty
      } catch (_) {}
    }
    return invalidValue(typs, val, key, parent);
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val;
    return invalidValue(
      cases.map((a) => {
        return l(a);
      }),
      val,
      key,
      parent
    );
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue(l("array"), val, key, parent);
    return val.map((el) => transform(el, typ, getProps));
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null;
    }
    const d = new Date(val);
    if (isNaN(d.valueOf())) {
      return invalidValue(l("Date"), val, key, parent);
    }
    return d;
  }

  function transformObject(props: { [k: string]: any }, additional: any, val: any): any {
    if (val === null || typeof val !== "object" || Array.isArray(val)) {
      return invalidValue(l(ref || "object"), val, key, parent);
    }
    const result: any = {};
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key];
      const v = Object.prototype.hasOwnProperty.call(val, key) ? val[key] : undefined;
      result[prop.key] = transform(v, prop.typ, getProps, key, ref);
    });
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key, ref);
      }
    });
    return result;
  }

  if (typ === "any") return val;
  if (typ === null) {
    if (val === null) return val;
    return invalidValue(typ, val, key, parent);
  }
  if (typ === false) return invalidValue(typ, val, key, parent);
  let ref: any = undefined;
  while (typeof typ === "object" && typ.ref !== undefined) {
    ref = typ.ref;
    typ = typeMap[typ.ref];
  }
  if (Array.isArray(typ)) return transformEnum(typ, val);
  if (typeof typ === "object") {
    // eslint-disable-next-line no-prototype-builtins
    return typ.hasOwnProperty("unionMembers")
      ? transformUnion(typ.unionMembers, val)
      : // eslint-disable-next-line no-prototype-builtins
      typ.hasOwnProperty("arrayItems")
      ? transformArray(typ.arrayItems, val)
      : // eslint-disable-next-line no-prototype-builtins
      typ.hasOwnProperty("props")
      ? transformObject(getProps(typ), typ.additional, val)
      : invalidValue(typ, val, key, parent);
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== "number") return transformDate(val);
  return transformPrimitive(typ, val);
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps);
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps);
}

function l(typ: any) {
  return { literal: typ };
}

function a(typ: any) {
  return { arrayItems: typ };
}

function u(...typs: any[]) {
  return { unionMembers: typs };
}

function o(props: any[], additional: any) {
  return { props, additional };
}

function m(additional: any) {
  return { props: [], additional };
}

function r(name: string) {
  return { ref: name };
}

const typeMap: any = {
  Response: o([{ json: "results", js: "results", typ: a(r("Result")) }], false),
  Result: o(
    [
      { json: "hits", js: "hits", typ: a(r("Hit")) },
      { json: "nbHits", js: "nbHits", typ: 0 },
      { json: "page", js: "page", typ: 0 },
      { json: "nbPages", js: "nbPages", typ: 0 },
      { json: "hitsPerPage", js: "hitsPerPage", typ: 0 },
      { json: "exhaustiveNbHits", js: "exhaustiveNbHits", typ: true },
      { json: "exhaustiveTypo", js: "exhaustiveTypo", typ: true },
      { json: "exhaustive", js: "exhaustive", typ: r("Exhaustive") },
      { json: "query", js: "query", typ: r("Query") },
      { json: "params", js: "params", typ: "" },
      { json: "index", js: "index", typ: "" },
      { json: "renderingContent", js: "renderingContent", typ: r("RenderingContent") },
      { json: "processingTimeMS", js: "processingTimeMS", typ: 0 },
      { json: "processingTimingsMS", js: "processingTimingsMS", typ: r("ProcessingTimingsMS") },
    ],
    false
  ),
  Exhaustive: o(
    [
      { json: "nbHits", js: "nbHits", typ: true },
      { json: "typo", js: "typo", typ: true },
    ],
    false
  ),
  Hit: o(
    [
      { json: "title", js: "title", typ: "" },
      { json: "content", js: "content", typ: "" },
      { json: "path", js: "path", typ: "" },
      { json: "level", js: "level", typ: 0 },
      { json: "position", js: "position", typ: 0 },
      { json: "isParent", js: "isParent", typ: u(undefined, true) },
      { json: "children", js: "children", typ: u(undefined, a("")) },
      { json: "objectID", js: "objectID", typ: "" },
      { json: "_highlightResult", js: "_highlightResult", typ: r("HighlightResult") },
      { json: "section", js: "section", typ: u(undefined, "") },
      { json: "anchor", js: "anchor", typ: u(undefined, "") },
      { json: "subSection", js: "subSection", typ: u(undefined, "") },
      { json: "parentName", js: "parentName", typ: u(undefined, "") },
    ],
    false
  ),
  HighlightResult: o(
    [
      { json: "title", js: "title", typ: r("Content") },
      { json: "content", js: "content", typ: r("Content") },
      { json: "path", js: "path", typ: r("Content") },
      { json: "children", js: "children", typ: u(undefined, a(r("Content"))) },
      { json: "section", js: "section", typ: u(undefined, r("Content")) },
      { json: "subSection", js: "subSection", typ: u(undefined, r("Content")) },
    ],
    false
  ),
  Content: o(
    [
      { json: "value", js: "value", typ: "" },
      { json: "matchLevel", js: "matchLevel", typ: r("MatchLevel") },
      { json: "fullyHighlighted", js: "fullyHighlighted", typ: u(undefined, true) },
      { json: "matchedWords", js: "matchedWords", typ: a(r("Query")) },
    ],
    false
  ),
  ProcessingTimingsMS: o([{ json: "request", js: "request", typ: r("Request") }], false),
  Request: o([{ json: "roundTrip", js: "roundTrip", typ: 0 }], false),
  RenderingContent: o([], false),
  MatchLevel: ["full", "none"],
  Query: ["fetch"],
};
