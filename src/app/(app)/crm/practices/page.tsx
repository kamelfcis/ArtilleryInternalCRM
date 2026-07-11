import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listPractices } from "@/lib/crm/services/practice";
import { projectOptions, companyOptions } from "@/lib/crm/options";
import { STATUS_OPTIONS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { PracticesView } from "./practices-view";

export const metadata = { title: "الممارسات" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PracticesPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [{ items, total }, projects, companies] = await Promise.all([
    listPractices({
      search: searchParams.search,
      status: searchParams.status,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    projectOptions(),
    companyOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="الممارسات"
        description={`الممارسات والمناقصات (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls
          searchPlaceholder="بحث بالرقم أو العنوان…"
          statusOptions={[...STATUS_OPTIONS.PRACTICE]}
        />
      </div>
      <PracticesView
        rows={items}
        projectOptions={projects}
        companyOptions={companies}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/practices"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search, status: searchParams.status }}
      />
    </>
  );
}
