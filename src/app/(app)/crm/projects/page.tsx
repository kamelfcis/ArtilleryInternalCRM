import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listProjects } from "@/lib/crm/services/project";
import { siteOptions } from "@/lib/crm/options";
import { STATUS_OPTIONS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "المشروعات" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [{ items, total }, sites] = await Promise.all([
    listProjects({
      search: searchParams.search,
      status: searchParams.status,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    siteOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="المشروعات"
        description={`مشروعات القسم (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls
          searchPlaceholder="بحث بالاسم أو الرمز…"
          statusOptions={[...STATUS_OPTIONS.PROJECT]}
        />
      </div>
      <ProjectsView
        rows={items}
        siteOptions={sites}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/projects"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search, status: searchParams.status }}
      />
    </>
  );
}
