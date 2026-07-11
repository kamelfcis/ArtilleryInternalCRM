import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listContracts } from "@/lib/crm/services/contract";
import {
  companyOptions,
  projectOptions,
  practiceOptions,
} from "@/lib/crm/options";
import { STATUS_OPTIONS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { ContractsView } from "./contracts-view";

export const metadata = { title: "التعاقدات" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [{ items, total }, companies, projects, practices] = await Promise.all([
    listContracts({
      search: searchParams.search,
      status: searchParams.status,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    companyOptions(),
    projectOptions(),
    practiceOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="التعاقدات"
        description={`العقود والاتفاقيات (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls
          searchPlaceholder="بحث بالرقم أو العنوان…"
          statusOptions={[...STATUS_OPTIONS.CONTRACT]}
        />
      </div>
      <ContractsView
        rows={items}
        companyOptions={companies}
        projectOptions={projects}
        practiceOptions={practices}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/contracts"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search, status: searchParams.status }}
      />
    </>
  );
}
