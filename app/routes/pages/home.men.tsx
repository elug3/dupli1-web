import { GenderHome, meta as homeMeta } from "./home";

export function meta() {
  return homeMeta();
}

/** The men's home; visiting it is remembered as the shopper's mode. */
export default function MenHome() {
  return <GenderHome fixed="men" />;
}
