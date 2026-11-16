import { GenderHome, meta as homeMeta } from "./home";

export function meta() {
  return homeMeta();
}

/** The women's home; visiting it is remembered as the shopper's mode. */
export default function WomenHome() {
  return <GenderHome fixed="women" />;
}
