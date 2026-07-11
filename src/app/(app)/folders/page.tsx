import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current-user";
import { getFolderView } from "@/lib/services/folder-view";
import { PageHeader } from "@/components/ui/page-header";
import { FolderExplorer } from "@/components/explorer/folder-explorer";

export const metadata: Metadata = { title: "الوثائق والمجلدات" };

// Always reflect the latest folder contents (documents change frequently).
export const dynamic = "force-dynamic";

export default async function FoldersRootPage() {
  const user = await requireUser();
  const view = await getFolderView(null, user);

  return (
    <>
      <PageHeader
        title="الوثائق والمجلدات"
        description="المجلدات الرئيسية لقسم الاحتياجات"
      />
      <FolderExplorer
        currentFolderId={null}
        canEdit={view.capabilities.canEdit}
        canManage={view.capabilities.canManage}
        subfolders={view.subfolders}
        documents={view.documents}
      />
    </>
  );
}
