import type { Metadata } from "next";
import CubeSurfaceLab from "@/components/cube-surface/CubeSurfaceLab";

export const metadata: Metadata = {
  title: "Cube Surface Study | LibreCosta",
  robots: { index: false, follow: false },
};

export default function CubeSurfaceStudyPage() {
  return <CubeSurfaceLab />;
}
