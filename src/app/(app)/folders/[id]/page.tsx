import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getFolderView } from "@/lib/services/folder-view";
import { NotFoundError } from "@/lib/errors";
import { PageHeader } from "@/components/ui/page-header";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FolderExplorer } from "@/components/explorer/folder-explorer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const user = await requireUser();
  try {
    const view = await getFolderView(params.id, user);
    return { title: view.folder?.name ?? "مجلد" };
  } catch {
    return { title: "مجلد غير موجود" };
  }
}

export default async function FolderPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireUser();

  let view;
  try {
    view = await getFolderView(params.id, user);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  if (!view.folder) notFound();

  const trail = view.breadcrumbs.map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <PageHeader
        title={view.folder.name}
        description={view.folder.description ?? undefined}
      >
        <Breadcrumbs trail={trail} />
      </PageHeader>
      <FolderExplorer
        currentFolderId={view.folder.id}
        canEdit={view.capabilities.canEdit}
        canManage={view.capabilities.canManage}
        subfolders={view.subfolders}
        documents={view.documents}
      />
    </>
  );
}
