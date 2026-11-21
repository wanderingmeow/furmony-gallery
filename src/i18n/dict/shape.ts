// The shape every dictionary must match.
//
// 简体中文 is the source: `Dict` is read off that file, so a new key there is a compile error in
// the other three until they answer it. Strings are widened to `string`, and a function keeps the
// arguments it takes, which is what keeps `t('sort.title', mode)` checked.
import { zh } from "./zh";

type Shape<T> = T extends (...args: infer A) => string
  ? (...args: A) => string
  : T extends string
    ? string
    : { [K in keyof T]: Shape<T[K]> };

export type Dict = Shape<typeof zh>;
