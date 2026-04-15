import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | SwiftNine",
  description: "Sign in to your SwiftNine dashboard",
};

export default function SignIn() {
  return <SignInForm />;
}
