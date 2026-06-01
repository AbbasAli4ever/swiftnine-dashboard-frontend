import CourseLibrary from "@/components/university/CourseLibrary";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Course Library | SwiftNine University",
};

export default function CourseLibraryPage() {
  return <CourseLibrary />;
}
