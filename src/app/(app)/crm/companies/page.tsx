import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listCompanies } from "@/lib/crm/services/company";
import { STATUS_OPTIONS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { CompaniesView } from "./companies-view";

export const metadata = { title: "الشركات" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const { items, total } = await listCompanies({
    search: searchParams.search,
    status: searchParams.status,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="الشركات"
        description={`سجل الموردين والشركات (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls
          searchPlaceholder="بحث بالاسم أو الرمز أو مسؤول التواصل…"
          statusOptions={[...STATUS_OPTIONS.COMPANY]}
        />
      </div>
      <CompaniesView
        rows={items}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/companies"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search, status: searchParams.status }}
      />
    </>
  );
}
