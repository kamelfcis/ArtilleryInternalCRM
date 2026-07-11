import { requireUser } from "@/lib/auth/current-user";
import { hasRoleAtLeast, ROLES } from "@/lib/constants";
import { listPurchases } from "@/lib/crm/services/purchase";
import {
  companyOptions,
  projectOptions,
  contractOptions,
} from "@/lib/crm/options";
import { STATUS_OPTIONS } from "@/lib/crm/constants";
import { PageHeader } from "@/components/ui/page-header";
import { ListControls } from "@/components/crm/list-controls";
import { Pagination } from "@/components/crm/pagination";
import { toArabicDigits } from "@/lib/utils";
import { PurchasesView } from "./purchases-view";

export const metadata = { title: "المشتريات" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; page?: string };
}) {
  const user = await requireUser();
  const page = Math.max(1, Number.parseInt(searchParams.page ?? "1", 10) || 1);

  const [{ items, total }, companies, projects, contracts] = await Promise.all([
    listPurchases({
      search: searchParams.search,
      status: searchParams.status,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    companyOptions(),
    projectOptions(),
    contractOptions(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="المشتريات"
        description={`أوامر الشراء والمشتريات (${toArabicDigits(String(total))})`}
      />
      <div className="mb-4">
        <ListControls
          searchPlaceholder="بحث بالرقم أو العنوان…"
          statusOptions={[...STATUS_OPTIONS.PURCHASE]}
        />
      </div>
      <PurchasesView
        rows={items}
        companyOptions={companies}
        projectOptions={projects}
        contractOptions={contracts}
        canWrite={hasRoleAtLeast(user.role, ROLES.EDITOR)}
        canDelete={hasRoleAtLeast(user.role, ROLES.MANAGER)}
      />
      <Pagination
        basePath="/crm/purchases"
        page={page}
        totalPages={totalPages}
        params={{ search: searchParams.search, status: searchParams.status }}
      />
    </>
  );
}
