import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

export default function TeachersLayout({ children }: Props) {
  return <div className="flex flex-col h-full">{children}</div>;
}
