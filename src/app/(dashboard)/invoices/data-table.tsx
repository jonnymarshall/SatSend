"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ColumnFiltersState,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { bulkArchive, bulkDelete, bulkMarkPaid, bulkUnarchive } from "./bulk-actions";
import {
  publishInvoice,
  publishAndSendEmail,
  publishAndMarkSent,
  duplicateInvoice,
  markOverdue,
  markUnpaid,
} from "./actions";
import { buildColumns, InvoiceRow } from "./columns";
import { useInvoiceRealtime } from "./use-invoice-realtime";

const DEFAULT_PAGE_SIZE = 10;

function parsePageParam(raw: string | null): number {
  // Returns a 0-indexed pageIndex. Invalid / missing / <1 → 0 (page 1).
  if (raw == null) return 0;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 0;
  return n - 1;
}

const COLUMN_LABELS: Record<string, string> = {
  invoice_number: "Invoice",
  client_name: "Client",
  created_at: "Date Sent",
  due_date: "Date Due",
  total_fiat: "Amount",
  status: "Status",
};

interface Props {
  data: InvoiceRow[];
  userId: string;
}

export function InvoiceDataTable({ data, userId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useInvoiceRealtime(userId);
  const [pagination, setPagination] = React.useState<PaginationState>(() => ({
    pageIndex: parsePageParam(searchParams.get("page")),
    pageSize: DEFAULT_PAGE_SIZE,
  }));

  const onPaginationChange = React.useCallback(
    (updater: Updater<PaginationState>) => {
      setPagination((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        // Reflect pageIndex in the URL so back / forward / refresh / share preserve it.
        // Page 1 = no param (canonical clean URL).
        const params = new URLSearchParams(searchParams.toString());
        if (next.pageIndex > 0) {
          params.set("page", String(next.pageIndex + 1));
        } else {
          params.delete("page");
        }
        const qs = params.toString();
        const url = qs ? `${pathname}?${qs}` : pathname;
        router.replace(url, { scroll: false });
        return next;
      });
    },
    [router, pathname, searchParams]
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([
    { id: "status", value: ["draft", "pending", "payment_detected", "paid", "overdue"] },
  ]);
  const [globalFilter, setGlobalFilter] = React.useState("");
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [showArchived, setShowArchived] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<string[] | null>(null);
  const [archiveFeedback, setArchiveFeedback] = React.useState<string | null>(null);

  const copyPublicLink = React.useCallback((id: string) => {
    const url = `${window.location.origin}/invoice/${id}`;
    navigator.clipboard.writeText(url).catch(() => {});
  }, []);

  const runRowAction = React.useCallback(
    async (fn: () => Promise<unknown>) => {
      setPending(true);
      try {
        await fn();
        router.refresh();
      } finally {
        setPending(false);
      }
    },
    [router]
  );

  const columns = React.useMemo(
    () =>
      buildColumns({
        onPublishOnly: (id) => runRowAction(() => publishInvoice(id)),
        onSendEmail: (id) => runRowAction(() => publishAndSendEmail(id)),
        onMarkSent: (id) => runRowAction(() => publishAndMarkSent(id)),
        onDownloadAndMarkSent: (id) =>
          runRowAction(async () => {
            const result = await publishAndMarkSent(id, { withDownload: true });
            if (result?.downloadUrl && typeof window !== "undefined") {
              window.location.href = result.downloadUrl;
            }
          }),
        onMarkPaid: (id) => runRowAction(() => bulkMarkPaid([id])),
        onMarkOverdue: (id) => runRowAction(() => markOverdue(id)),
        onMarkPending: (id) => runRowAction(() => markUnpaid(id)),
        onArchive: (id) => runRowAction(() => bulkArchive([id])),
        onUnarchive: (id) => runRowAction(() => bulkUnarchive([id])),
        onDelete: (id) => setDeleteTarget([id]),
        onCopyPublicLink: copyPublicLink,
        onDuplicate: (id) => runRowAction(() => duplicateInvoice(id)),
      }),
    [runRowAction, copyPublicLink]
  );

  const table = useReactTable({
    data,
    columns,
    onPaginationChange,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const q = filterValue.trim().toLowerCase();
      if (!q) return true;
      const num = row.original.invoice_number?.toLowerCase() ?? "";
      const client = row.original.client_name?.toLowerCase() ?? "";
      return num.includes(q) || client.includes(q);
    },
    state: {
      pagination,
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedIds = Object.keys(rowSelection);
  const hasSelection = selectedIds.length > 0;

  React.useEffect(() => {
    const statusValues = showArchived
      ? ["draft", "pending", "payment_detected", "paid", "overdue", "archived"]
      : ["draft", "pending", "payment_detected", "paid", "overdue"];
    table.getColumn("status")?.setFilterValue(statusValues);
  }, [showArchived, table]);

  // Clamp pageIndex if the URL or filtering pushes it past the last available page.
  const pageCount = table.getPageCount();
  React.useEffect(() => {
    if (pageCount > 0 && pagination.pageIndex > pageCount - 1) {
      table.setPageIndex(pageCount - 1);
    }
  }, [pageCount, pagination.pageIndex, table]);

  async function handleBulkMarkPaid() {
    setPending(true);
    try {
      await bulkMarkPaid(selectedIds);
      setRowSelection({});
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleBulkArchive() {
    setPending(true);
    try {
      const { archived, skipped } = await bulkArchive(selectedIds);
      if (skipped > 0) {
        setArchiveFeedback(
          `Archived ${archived} invoice${archived === 1 ? "" : "s"}. Skipped ${skipped} (drafts and already-archived invoices can't be archived).`
        );
      } else {
        setArchiveFeedback(null);
      }
      setRowSelection({});
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setPending(true);
    try {
      await bulkDelete(deleteTarget);
      setRowSelection((prev) => {
        const next: Record<string, boolean> = { ...(prev as Record<string, boolean>) };
        deleteTarget.forEach((id) => delete next[id]);
        return next;
      });
      setDeleteTarget(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div id="invoice-data-table">
      {/* Toolbar */}
      <div className="flex items-center gap-2 py-4">
        <Input
          id="invoice-data-table--filter"
          type="search"
          placeholder="Filter by invoice # or client..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          autoComplete="off"
          data-lpignore="true"
          data-form-type="other"
          data-1p-ignore="true"
          className="max-w-sm"
        />

        {/* Bulk actions dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                id="invoice-data-table--bulk-actions"
                variant="outline"
                disabled={!hasSelection || pending}
              >
                Bulk actions {hasSelection && `(${selectedIds.length})`}
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48 whitespace-nowrap">
            <DropdownMenuItem onClick={handleBulkMarkPaid}>Mark as paid</DropdownMenuItem>
            <DropdownMenuItem onClick={handleBulkArchive}>Archive</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteTarget(selectedIds)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {hasSelection && (
          <Button
            id="invoice-data-table--clear-selected"
            variant="ghost"
            onClick={() => setRowSelection({})}
          >
            Clear selected
          </Button>
        )}

        <Button
          id="invoice-data-table--archive-toggle"
          variant="outline"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived ? "Hide archived" : "Show archived"}
        </Button>

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" className="ml-auto">
                Columns
              </Button>
            }
          />
          <DropdownMenuContent align="end" className="w-48 whitespace-nowrap">
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide())
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {COLUMN_LABELS[column.id] ?? column.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {archiveFeedback && (
        <div
          id="invoice-data-table--archive-feedback"
          role="status"
          className="mb-3 flex items-start justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
        >
          <span>{archiveFeedback}</span>
          <button
            type="button"
            onClick={() => setArchiveFeedback(null)}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} invoices selected.
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget?.length ?? 0} invoice{(deleteTarget?.length ?? 0) !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
