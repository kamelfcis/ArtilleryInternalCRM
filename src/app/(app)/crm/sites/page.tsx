import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listSites } from "@/lib/crm/services/site";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { SitesView } from "./sites-view";

export const metadata = { title: "المواقع" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function SitesPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const { items, total } = await listSites({
    search: searchParams.search,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="المواقع"
        description={`المواقع والمنشآت (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls searchPlaceholder="بحث بالاسم أو الرمز…" />
      </div>
      <SitesView
        rows={items}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/sites"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search }}
      />
    </>
  );
}
