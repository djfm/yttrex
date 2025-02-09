import * as t from "io-ts";
import { DateFromISOString } from "io-ts-types/lib/DateFromISOString";

export const ChannelADV = t.strict(
  {
    href: t.string,
    selectorName: t.string,
    sponsoredName: t.string,
    sponsoredSite: t.string,
    authorName: t.string,
    authorSource: t.string,
    title: t.string,
    savingTime: DateFromISOString,
  },
  "ChannelADV"
);
export type ChannelADV = t.TypeOf<typeof ChannelADV>;
