"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/date-picker";
import {
  saveDraft,
  updateDraft,
  publishInvoice,
  publishAndSendEmail,
  publishAndMarkSent,
  InvoicePayload,
} from "@/app/(dashboard)/invoices/actions";
import { PublishMenu } from "@/components/publish-menu";
import { computeInvoiceTotals, isValidEmail, isValidBtcAddress, parseServerError, LineItem } from "@/lib/invoices";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

interface InvoiceFormProps {
  invoiceId?: string;
  initialValues?: Partial<FormState>;
  // When provided, locks your_email to the session user's email. A future branch
  // can re-introduce per-invoice override behind a toggle — explicit non-goal here.
  sessionEmail?: string;
}

interface FormState {
  invoice_number: string;
  your_name: string;
  your_email: string;
  your_company: string;
  your_address: string;
  your_tax_id: string;
  client_name: string;
  client_email: string;
  client_company: string;
  client_address: string;
  client_tax_id: string;
  line_items: LineItem[];
  tax_percent: string;
  btc_address: string;
  due_date: Date | undefined;
  no_due_date: boolean;
  access_code: string;
}

const DEFAULT_STATE: FormState = {
  invoice_number: "",
  your_name: "",
  your_email: "",
  your_company: "",
  your_address: "",
  your_tax_id: "",
  client_name: "",
  client_email: "",
  client_company: "",
  client_address: "",
  client_tax_id: "",
  line_items: [{ description: "", quantity: 1, unit_price: 0 }],
  tax_percent: "",
  btc_address: "",
  due_date: undefined,
  no_due_date: false,
  access_code: "",
};

export function InvoiceForm({ invoiceId, initialValues, sessionEmail }: InvoiceFormProps) {
  const router = useRouter();
  const initialState: FormState = {
    ...DEFAULT_STATE,
    ...initialValues,
    ...(sessionEmail ? { your_email: sessionEmail } : {}),
  };
  const [form, setForm] = useState<FormState>(initialState);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const initialFormRef = useRef(JSON.stringify(initialState));

  // Raw string display values for qty/unit_price so "0" and "" are distinct
  const [rawAmounts, setRawAmounts] = useState<{ quantity: string; unit_price: string }[]>(() =>
    (initialValues?.line_items ?? DEFAULT_STATE.line_items).map((item) => ({
      quantity: item.quantity !== 0 ? String(item.quantity) : "",
      unit_price: item.unit_price !== 0 ? String(item.unit_price) : "",
    }))
  );

  const [itemKeys, setItemKeys] = useState<string[]>(() =>
    (initialValues?.line_items ?? DEFAULT_STATE.line_items).map(() => crypto.randomUUID())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = itemKeys.indexOf(String(active.id));
    const newIndex = itemKeys.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setItemKeys((prev) => arrayMove(prev, oldIndex, newIndex));
    setForm((prev) => ({ ...prev, line_items: arrayMove(prev.line_items, oldIndex, newIndex) }));
    setRawAmounts((prev) => arrayMove(prev, oldIndex, newIndex));
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const QTY_MAX = 100_000;
  const UNIT_PRICE_MAX = 1_000_000_000;

  function isValidAmountInput(raw: string, maxValue: number): boolean {
    if (raw === "" || raw === "-" || raw.endsWith(".")) return true;
    const dotIndex = raw.indexOf(".");
    if (dotIndex !== -1 && raw.length - dotIndex - 1 > 2) return false;
    const n = parseFloat(raw);
    if (isNaN(n) || n < 0 || n > maxValue) return false;
    return true;
  }

  function updateItem(index: number, field: keyof LineItem, raw: string) {
    if (field === "quantity" || field === "unit_price") {
      const maxValue = field === "quantity" ? QTY_MAX : UNIT_PRICE_MAX;
      if (!isValidAmountInput(raw, maxValue)) return;
      setRawAmounts((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: raw };
        return next;
      });
      setForm((prev) => {
        const items = [...prev.line_items];
        const n = raw === "" ? 0 : parseFloat(raw);
        items[index] = { ...items[index], [field]: isNaN(n) ? 0 : n };
        return { ...prev, line_items: items };
      });
    } else {
      setForm((prev) => {
        const items = [...prev.line_items];
        items[index] = { ...items[index], description: raw };
        return { ...prev, line_items: items };
      });
    }
  }

  function addItem() {
    set("line_items", [...form.line_items, { description: "", quantity: 1, unit_price: 0 }]);
    setRawAmounts((prev) => [...prev, { quantity: "1", unit_price: "" }]);
    setItemKeys((prev) => [...prev, crypto.randomUUID()]);
  }

  function removeItem(i: number) {
    set("line_items", form.line_items.filter((_, idx) => idx !== i));
    setRawAmounts((prev) => prev.filter((_, idx) => idx !== i));
    setItemKeys((prev) => prev.filter((_, idx) => idx !== i));
  }

  const errorFieldIds: Record<string, string> = {
    invoice_number: "input-invoice-number",
    your_email: "input-your-email",
    client_email: "input-client-email",
    btc_address: "input-btc-address",
  };

  function validate(isPublish: boolean): boolean {
    const errs: Record<string, string> = {};
    if (form.client_email && !isValidEmail(form.client_email)) errs.client_email = "Must be a valid email";
    if (form.your_email && !isValidEmail(form.your_email)) errs.your_email = "Must be a valid email";
    if (form.invoice_number && form.invoice_number.length > 50) errs.invoice_number = "Max 50 characters";
    const btc = form.btc_address.trim();
    if (btc && !isValidBtcAddress(btc)) errs.btc_address = "Invalid BTC address";
    if (isPublish && !btc) errs.btc_address = "BTC address is required to publish";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const firstKey = Object.keys(errs)[0];
      const elId = errorFieldIds[firstKey];
      if (elId) document.getElementById(elId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    return Object.keys(errs).length === 0;
  }

  function buildPayload(): InvoicePayload {
    return {
      invoice_number: form.invoice_number || undefined,
      your_name: form.your_name || undefined,
      your_email: form.your_email || undefined,
      your_company: form.your_company || undefined,
      your_address: form.your_address || undefined,
      your_tax_id: form.your_tax_id || undefined,
      client_name: form.client_name || undefined,
      client_email: form.client_email || undefined,
      client_company: form.client_company || undefined,
      client_address: form.client_address || undefined,
      client_tax_id: form.client_tax_id || undefined,
      line_items: form.line_items,
      tax_percent: parseFloat(form.tax_percent) || 0,
      btc_address: form.btc_address.trim() || undefined,
      due_date: !form.no_due_date && form.due_date ? form.due_date.toISOString().split("T")[0] : undefined,
      access_code: form.access_code.trim() || undefined,
    };
  }

  function handleServerError(e: unknown) {
    const { field, message } = parseServerError((e as Error).message);
    if (field && field in errorFieldIds) {
      setErrors({ [field]: message });
      document.getElementById(errorFieldIds[field])?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setErrors({ _form: message });
    }
  }

  async function handleSaveDraft() {
    if (!validate(false)) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      if (invoiceId) {
        await updateDraft(invoiceId, payload);
        router.push(`/invoices/${invoiceId}`);
      } else {
        const invoice = await saveDraft(payload);
        router.push(`/invoices/${invoice.id}`);
      }
    } catch (e) {
      handleServerError(e);
    } finally {
      setSaving(false);
    }
  }

  // Shared flow for all four publish/send options. Saves/updates the draft to obtain
  // an id, then runs the chosen publish action against that id, then navigates.
  async function runPublishFlow<T>(action: (id: string) => Promise<T>, postNavigate?: (result: T) => void) {
    if (!validate(true)) return;
    setSaving(true);
    try {
      const payload = buildPayload();
      let id = invoiceId;
      if (id) {
        await updateDraft(id, payload);
      } else {
        const invoice = await saveDraft(payload);
        id = invoice.id;
      }
      const result = await action(id!);
      router.push(`/invoices/${id}`);
      postNavigate?.(result);
    } catch (e) {
      handleServerError(e);
    } finally {
      setSaving(false);
    }
  }

  const handlePublishOnly = () => runPublishFlow((id) => publishInvoice(id));
  const handleSendEmail = () => runPublishFlow((id) => publishAndSendEmail(id));
  const handleMarkSent = () => runPublishFlow((id) => publishAndMarkSent(id));
  const handleDownloadAndMarkSent = () =>
    runPublishFlow(
      (id) => publishAndMarkSent(id, { withDownload: true }),
      (result) => {
        if (result?.downloadUrl && typeof window !== "undefined") {
          window.location.href = result.downloadUrl;
        }
      }
    );

  const taxPct = parseFloat(form.tax_percent) || 0;
  const { subtotal, taxFiat, total } = computeInvoiceTotals(form.line_items, taxPct);

  function handleCancel() {
    const isDirty = JSON.stringify(form) !== initialFormRef.current;
    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Discard and go back?")) return;
    }
    router.back();
  }

  return (
    <div id="form-invoice" className="space-y-8">
      {errors._form && (
        <div id="form-error" className="rounded-md bg-primary/10 border border-primary/30 px-4 py-3 text-sm text-primary">
          {errors._form}
        </div>
      )}

      {/* Invoice number */}
      <section id="section-invoice-number">
        <Field label="Invoice number" error={errors.invoice_number}>
          <input
            id="input-invoice-number"
            type="text"
            maxLength={50}
            value={form.invoice_number}
            onChange={(e) => set("invoice_number", e.target.value)}
            className={`${inputCls} max-w-xs`}
            placeholder="e.g. INV-001"
          />
        </Field>
      </section>

      {/* YOU / CLIENT split */}
      <div id="section-parties" className="grid grid-cols-2">
        <section id="section-you" className="space-y-2 border-r border-border" style={{ paddingRight: "2.5rem" }}>
          <h2 id="heading-you" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">You</h2>
          <Field label="Name">
            <input id="input-your-name" type="text" value={form.your_name} onChange={(e) => set("your_name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email" error={errors.your_email}>
            <input
              id="input-your-email"
              type="email"
              value={form.your_email}
              onChange={(e) => set("your_email", e.target.value)}
              disabled={!!sessionEmail}
              className={`${inputCls} disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-70`}
            />
          </Field>
          <Field label="Company">
            <input id="input-your-company" type="text" value={form.your_company} onChange={(e) => set("your_company", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address">
            <input id="input-your-address" type="text" value={form.your_address} onChange={(e) => set("your_address", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tax ID">
            <input id="input-your-tax-id" type="text" value={form.your_tax_id} onChange={(e) => set("your_tax_id", e.target.value)} className={inputCls} />
          </Field>
        </section>

        <section id="section-client" className="space-y-2" style={{ paddingLeft: "2.5rem" }}>
          <h2 id="heading-client" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Client</h2>
          <Field label="Name" error={errors.client_name}>
            <input id="input-client-name" type="text" value={form.client_name} onChange={(e) => set("client_name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Email" error={errors.client_email}>
            <input id="input-client-email" type="email" value={form.client_email} onChange={(e) => set("client_email", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Company">
            <input id="input-client-company" type="text" value={form.client_company} onChange={(e) => set("client_company", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Address">
            <input id="input-client-address" type="text" value={form.client_address} onChange={(e) => set("client_address", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Tax ID">
            <input id="input-client-tax-id" type="text" value={form.client_tax_id} onChange={(e) => set("client_tax_id", e.target.value)} className={inputCls} />
          </Field>
        </section>
      </div>

      {/* Line items */}
      <section id="section-line-items" className="space-y-3">
        <h2 id="heading-line-items" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Line Items</h2>

        <div id="line-items-header" className="flex items-end" style={{ gap: "0.75rem" }}>
          <div className="flex-1 min-w-0">
            <label id="label-line-item-description" htmlFor="input-line-item-0-description" className="text-sm font-medium">
              Description
            </label>
          </div>
          <div className="shrink-0" style={{ width: "5rem" }}>
            <label id="label-line-item-qty" htmlFor="input-line-item-0-qty" className="text-sm font-medium">
              Qty
            </label>
          </div>
          <div className="shrink-0" style={{ width: "7rem" }}>
            <label id="label-line-item-unit-price" htmlFor="input-line-item-0-unit-price" className="text-sm font-medium">
              Unit price
            </label>
          </div>
          <div className="shrink-0" style={{ width: "2rem" }} aria-hidden="true" />
          <div className="shrink-0" style={{ width: "1.5rem" }} aria-hidden="true" />
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={itemKeys} strategy={verticalListSortingStrategy}>
            <div id="line-items-list" className="space-y-2">
              {form.line_items.map((item, i) => (
                <SortableLineItem
                  key={itemKeys[i]}
                  id={itemKeys[i]}
                  index={i}
                  item={item}
                  rawAmount={rawAmounts[i]}
                  canRemove={form.line_items.length > 1}
                  onChangeField={updateItem}
                  onRemove={removeItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <button id="btn-add-line-item" type="button" onClick={addItem} className="text-sm text-primary hover:underline cursor-pointer">
          + Add line item
        </button>
      </section>

      {/* Tax */}
      <section id="section-tax">
        <Field label="Tax (%)">
          <input
            id="input-tax-percent"
            type="text"
            inputMode="decimal"
            value={form.tax_percent}
            onChange={(e) => set("tax_percent", e.target.value)}
            placeholder="0"
            className={`${inputCls} max-w-[6rem]`}
          />
        </Field>
      </section>

      {/* Due date */}
      <section id="section-due-date">
        <Field label="Due date">
          <div className="space-y-2">
            <label id="label-no-due-date" htmlFor="input-no-due-date" className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                id="input-no-due-date"
                type="checkbox"
                checked={form.no_due_date}
                onChange={(e) => set("no_due_date", e.target.checked)}
                className="rounded border-border"
              />
              No due date
            </label>
            {!form.no_due_date && (
              <div id="due-date-picker" className="max-w-xs">
                <DatePicker
                  value={form.due_date}
                  onChange={(d) => set("due_date", d)}
                  placeholder="Select due date"
                />
              </div>
            )}
          </div>
        </Field>
      </section>

      {/* Bitcoin address — required to publish, optional for drafts */}
      <section id="section-btc-address" className="space-y-3">
        <Field label="BTC address" error={errors.btc_address}>
          <input
            id="input-btc-address"
            type="text"
            value={form.btc_address}
            onChange={(e) => set("btc_address", e.target.value)}
            className={inputCls}
            placeholder="bc1q…"
          />
          <p id="hint-btc-address" className="text-xs text-muted-foreground">
            Required to publish. Each invoice needs a fresh, unique address — reusing one breaks payment detection.
          </p>
        </Field>
      </section>

      {/* Access code */}
      <section id="section-access-code">
        <Field label="Access code (Optional)">
          <input
            id="input-access-code"
            type="text"
            value={form.access_code}
            onChange={(e) => set("access_code", e.target.value.toLowerCase().slice(0, 16))}
            className={`${inputCls} max-w-[200px] font-mono tracking-widest`}
            placeholder="e.g. mycode01"
          />
          <p id="hint-access-code" className="text-xs text-muted-foreground">Leave blank for no access code — anyone with the link can view.</p>
        </Field>
      </section>

      {/* Totals */}
      <div id="section-totals" className="rounded-lg border border-border bg-card px-5 py-4 space-y-1.5 text-sm">
        <div id="row-subtotal" className="flex justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span id="value-subtotal">${subtotal.toFixed(2)}</span>
        </div>
        {taxPct > 0 && (
          <div id="row-tax" className="flex justify-between text-muted-foreground">
            <span>Tax ({taxPct}%)</span>
            <span id="value-tax">${taxFiat.toFixed(2)}</span>
          </div>
        )}
        <div id="row-total" className="flex justify-between font-semibold text-base pt-1 border-t border-border">
          <span>Total</span>
          <span id="value-total">${total.toFixed(2)} USD</span>
        </div>
      </div>

      <div id="section-actions" className="flex gap-3 items-start">
        <Button id="btn-save-draft" variant="outline" onClick={handleSaveDraft} disabled={saving}>
          Save draft
        </Button>
        <PublishMenu
          invoiceId={invoiceId ?? "new"}
          isDraft
          emailAttemptedAt={null}
          clientEmail={form.client_email || null}
          sentAt={null}
          sendMethod={null}
          busy={saving}
          onSendEmail={handleSendEmail}
          onMarkSent={handleMarkSent}
          onDownloadAndMarkSent={handleDownloadAndMarkSent}
          onPublishOnly={handlePublishOnly}
        />
        <Button id="btn-cancel" variant="outline" type="button" onClick={handleCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

const inputBase =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring h-9";

const inputCls = `w-full ${inputBase}`;

const noSpinner =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {label && <label className="block text-sm font-medium">{label}</label>}
      {children}
      {error && <p className="text-xs text-primary">{error}</p>}
    </div>
  );
}

function SortableLineItem({
  id,
  index,
  item,
  rawAmount,
  canRemove,
  onChangeField,
  onRemove,
}: {
  id: string;
  index: number;
  item: LineItem;
  rawAmount: { quantity: string; unit_price: string } | undefined;
  canRemove: boolean;
  onChangeField: (i: number, field: keyof LineItem, raw: string) => void;
  onRemove: (i: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
    zIndex: isDragging ? 10 : undefined,
    gap: "0.75rem",
  };

  return (
    <div
      ref={setNodeRef}
      id={`line-item-${index}`}
      className="group flex items-center relative bg-background"
      style={style}
    >
      <div id={`line-item-${index}-description`} className="flex-1 min-w-0">
        <input
          id={`input-line-item-${index}-description`}
          type="text"
          value={item.description}
          onChange={(e) => onChangeField(index, "description", e.target.value)}
          className={`w-full ${inputBase}`}
          placeholder="e.g. Design work"
        />
      </div>

      <div id={`line-item-${index}-qty`} className="shrink-0" style={{ width: "5rem" }}>
        <input
          id={`input-line-item-${index}-qty`}
          type="text"
          inputMode="decimal"
          value={rawAmount?.quantity ?? ""}
          onChange={(e) => onChangeField(index, "quantity", e.target.value)}
          className={`w-full ${inputBase}`}
        />
      </div>

      <div id={`line-item-${index}-unit-price`} className="shrink-0" style={{ width: "7rem" }}>
        <input
          id={`input-line-item-${index}-unit-price`}
          type="text"
          inputMode="decimal"
          value={rawAmount?.unit_price ?? ""}
          onChange={(e) => onChangeField(index, "unit_price", e.target.value)}
          className={`w-full ${inputBase}`}
          placeholder="0.00"
        />
      </div>

      <div id={`line-item-${index}-actions`} className="shrink-0 flex items-center justify-center" style={{ width: "2rem" }}>
        {canRemove && (
          <button
            id={`btn-line-item-${index}-remove`}
            type="button"
            onClick={() => onRemove(index)}
            className="h-9 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors text-lg cursor-pointer"
          >
            ×
          </button>
        )}
      </div>

      <div id={`line-item-${index}-drag`} className="shrink-0 flex items-center justify-center" style={{ width: "1.5rem" }}>
        <button
          id={`drag-handle-line-item-${index}`}
          type="button"
          aria-label={`Reorder line item ${index + 1}`}
          className="h-9 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
        >
          <DragHandleDots />
        </button>
      </div>
    </div>
  );
}

function DragHandleDots() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.25" />
      <circle cx="9" cy="3" r="1.25" />
      <circle cx="3" cy="8" r="1.25" />
      <circle cx="9" cy="8" r="1.25" />
      <circle cx="3" cy="13" r="1.25" />
      <circle cx="9" cy="13" r="1.25" />
    </svg>
  );
}
