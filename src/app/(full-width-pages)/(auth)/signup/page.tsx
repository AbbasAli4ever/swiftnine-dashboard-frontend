import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up | SwiftNine",
  description: "Create your SwiftNine account",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}
