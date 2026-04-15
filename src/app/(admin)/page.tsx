import InboxPage from "@/components/inbox/InboxPage";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home | SwiftNine",
  description: "Inbox and notifications",
};

export default function Home() {
  return <InboxPage />;
}
