import type { ReactNode } from "react";

export default function AdminPageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="text-xs font-semibold text-gray-500">ADMIN</div>
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.subtitle ? (
          <p className="mt-1 text-sm text-gray-500">{props.subtitle}</p>
        ) : null}
      </div>

      {props.actions ? <div className="flex gap-2">{props.actions}</div> : null}
    </div>
  );
}
