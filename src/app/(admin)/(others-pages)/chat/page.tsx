import { Metadata } from "next";
import ChatbotPage from "@/components/chatbot/ChatbotPage";

export const metadata: Metadata = {
  title: "SwiftBot",
};

export default function ChatRoutePage() {
  return <ChatbotPage />;
}
