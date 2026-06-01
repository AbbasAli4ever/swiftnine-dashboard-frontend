import PortalSelectPage from "@/components/portal/PortalSelectPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Select Portal | SwiftNine",
};

export default function PortalSelect() {
  return <PortalSelectPage />;
}
