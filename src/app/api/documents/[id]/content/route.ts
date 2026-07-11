import { type NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { canView } from "@/lib/authz";
import { openReadStream } from "@/lib/storage";
import { emitEvent, EVENT_NAMES } from "@/lib/events";
import { ENTITY_TYPES } from "@/lib/constants";

// File streaming requires the Node.js runtime (fs access).
export const runtime = "nodejs";

/**
 * Stream a document's current version. Enforces authentication and folder-level
 * view permission independently of middleware. `?download=1` forces a download
 * (Content-Disposition: attachment) and records a download audit entry;
 * otherwise the file is served inline for in-browser preview (e.g. PDFs).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const document = await prisma.document.findFirst({
    where: { id: params.id, deletedAt: null },
    select: {
      id: true,
      name: true,
      originalName: true,
      mimeType: true,
      size: true,
      storageKey: true,
      folder: { select: { id: true, path: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "الوثيقة غير موجودة" }, { status: 404 });
  }

  if (!(await canView(user, document.folder))) {
    return NextResponse.json({ error: "لا تملك صلاحية الوصول" }, { status: 403 });
  }

  const isDownload = req.nextUrl.searchParams.get("download") === "1";

  if (isDownload) {
    await emitEvent({
      eventName: EVENT_NAMES.DocumentDownloaded,
      actorId: user.id,
      entityType: ENTITY_TYPES.DOCUMENT,
      entityId: document.id,
      metadata: { name: document.name },
    });
  }

  let nodeStream;
  try {
    nodeStream = await openReadStream(document.storageKey);
  } catch {
    return NextResponse.json(
      { error: "تعذّر قراءة الملف من وحدة التخزين" },
      { status: 500 },
    );
  }

  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  const filename = encodeURIComponent(document.originalName);
  const disposition = isDownload ? "attachment" : "inline";

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": document.mimeType,
      "Content-Length": String(document.size),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
