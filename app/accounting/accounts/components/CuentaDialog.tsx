"use client";

import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ErrorApi as ApiError,
  registerAccount,
  updateAccount,
  ACCOUNT_TYPES,
  type AccountingAccount,
} from "@/lib/services/cuentas.service";

/** Format validated on server (`AccountingAccount.code` ≤ 10). */
const ACCOUNT_CODE_REGEX = /^[A-Za-z0-9.-]{1,10}$/;

/** Selector sentinel value for root account (no parent). */
const ROOT_ACCOUNT_VALUE = "__raiz__";

interface AccountDialogProps {
  isOpen: boolean;
  account: AccountingAccount | null;
  initialParent: AccountingAccount | null;
  accounts: AccountingAccount[];
  onClose: () => void;
  onSaved: (account: AccountingAccount) => void;
}

export function AccountDialog({
  isOpen,
  account,
  initialParent,
  accounts,
  onClose,
  onSaved,
}: Readonly<AccountDialogProps>) {
  const [code, setCode] = useState<string>(() => (account ? account.codigo : ""));
  const [name, setName] = useState<string>(() => (account ? account.nombre : ""));
  const [parentId, setParentId] = useState<string>(() => {
    if (account) return account.idPadre === null ? ROOT_ACCOUNT_VALUE : String(account.idPadre);
    if (initialParent) return String(initialParent.id);
    return ROOT_ACCOUNT_VALUE;
  });
  const [accountType, setAccountType] = useState<string>(() => {
    if (account) return account.tipo;
    if (initialParent) return initialParent.tipo;
    return "";
  });
  const [isActive, setIsActive] = useState<boolean>(() => (account ? account.activo : true));
  const [errors, setErrors] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const isEditMode = account !== null;
  const numericParentId = parentId === ROOT_ACCOUNT_VALUE ? null : Number(parentId);
  const isInheritedType = numericParentId !== null;

  const parentAccount = useMemo(
    () => (numericParentId === null ? null : (accounts.find((c) => c.id === numericParentId) ?? null)),
    [accounts, numericParentId]
  );

  const excludedIds = useMemo(() => {
    const excluded = new Set<number>();
    if (!cuenta) return excluded;
    excluded.add(cuenta.id);
    let changed = true;
    while (changed) {
      changed = false;
      for (const candidate of cuentas) {
        if (
          !excluded.has(candidate.id) &&
          candidate.idPadre !== null &&
          excluded.has(candidate.idPadre)
        ) {
          excluded.add(candidate.id);
          changed = true;
        }
      }
    }
    return excluded;
  }, [cuenta, cuentas]);

  const parentOptions = useMemo(
    () =>
      accounts
        .filter((c) => !excludedIds.has(c.id) && (c.activo || c.id === numericParentId))
        .slice()
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    [accounts, excludedIds, numericParentId]
  );

  const typeOptions = useMemo(
    () => ACCOUNT_TYPES.map((val) => ({ value: val as string, label: val })),
    []
  );

  const handleParentChange = (value: string | null) => {
    const nextParentId = value ?? ROOT_ACCOUNT_VALUE;
    setParentId(nextParentId);
    if (nextParentId !== ROOT_ACCOUNT_VALUE) {
      const parent = accounts.find((c) => String(c.id) === nextParentId);
      if (parent) setAccountType(parent.tipo);
    }
  };

  const validateForm = (): string[] => {
    const list: string[] = [];
    const cleanCode = code.trim();
    const cleanName = name.trim();

    if (!cleanCode) list.push("Escribe el código de la cuenta.");
    else if (!ACCOUNT_CODE_REGEX.test(cleanCode)) {
      list.push(
        "El código sólo puede tener hasta 10 caracteres con letras, números, punto o guion."
      );
    }

    if (!cleanName) list.push("Escribe el nombre de la cuenta.");
    else if (cleanName.length > 100) {
      list.push("El nombre de la cuenta no puede superar los 100 caracteres.");
    }

    if (!accountType) list.push("Selecciona el tipo de cuenta.");

    return list;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    setIsSaving(true);
    try {
      const payload = {
        codigo: code.trim(),
        nombre: name.trim(),
        tipo: accountType,
        idPadre: numericParentId,
        ...(isEditMode ? { activo: isActive } : {}),
      };
      const savedAccount = isEditMode
        ? await updateAccount(account!.id, payload)
        : await registerAccount(payload);
      onSaved(savedAccount);
    } catch (error) {
      setErrors(
        error instanceof ApiError
          ? error.errors
          : [error instanceof Error ? error.message : "No se pudo guardar la cuenta."]
      );
    } finally {
      setIsSaving(false);
    }
  };

  const labelClasses = "text-[11px] font-bold uppercase tracking-wider text-slate-500";
  const inputClasses = "h-9 w-full rounded-lg border-slate-200 bg-white text-xs shadow-none";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            {isEditMode
              ? "Editar cuenta contable"
              : initialParent
                ? `Nueva subcuenta de ${initialParent.codigo}`
                : "Nueva cuenta contable"}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {isEditMode
              ? "Modifica los datos de la cuenta. Si cambias el tipo, éste se aplica también a sus subcuentas."
              : "El código es único en todo el plan contable. Una subcuenta hereda el tipo de su cuenta padre."}
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="cuenta-codigo" className={labelClasses}>
                Código
              </label>
              <Input
                id="cuenta-codigo"
                type="text"
                maxLength={10}
                placeholder="Ej. 101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${inputClasses} font-mono tabular-nums`}
                disabled={isSaving}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label id="cuenta-tipo-label" htmlFor="cuenta-tipo" className={labelClasses}>
                Tipo de cuenta
              </label>
              <Select
                id="cuenta-tipo"
                value={accountType}
                items={typeOptions}
                onValueChange={(val) => setAccountType(val ?? "")}
                disabled={isSaving || isInheritedType}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="cuenta-tipo-label"
                >
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="cuenta-nombre" className={labelClasses}>
                Nombre de la cuenta
              </label>
              <Input
                id="cuenta-nombre"
                type="text"
                maxLength={100}
                placeholder="Ej. Caja"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClasses}
                disabled={isSaving}
                autoComplete="off"
              />
            </div>

            <div className="flex flex-col gap-1 sm:col-span-2">
              <label id="cuenta-padre-label" htmlFor="cuenta-padre" className={labelClasses}>
                Cuenta padre (subcuenta de)
              </label>
              <Select
                id="cuenta-padre"
                value={parentId}
                items={[
                  { value: ROOT_ACCOUNT_VALUE, label: "Ninguna · es una cuenta raíz" },
                  ...parentOptions.map((c) => ({
                    value: String(c.id),
                    label: `${c.codigo} · ${c.nombre}${c.activo ? "" : " (inactiva)"}`,
                  })),
                ]}
                onValueChange={handleParentChange}
                disabled={isSaving}
              >
                <SelectTrigger
                  className="w-full rounded-lg bg-white text-xs"
                  aria-labelledby="cuenta-padre-label"
                >
                  <SelectValue placeholder="Seleccionar cuenta padre" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROOT_ACCOUNT_VALUE}>Ninguna · es una cuenta raíz</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.codigo} · {c.nombre}
                      {c.activo ? "" : " (inactiva)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isInheritedType && (
                <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  El tipo se hereda de{" "}
                  <b className="text-slate-700">{parentAccount?.codigo ?? "la cuenta padre"}</b>.
                </p>
              )}
            </div>
          </div>

          {isEditMode && (
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-slate-800">Cuenta activa</span>
                <span className="text-[11px] text-slate-500">
                  {isActive
                    ? "Disponible para registrar asientos contables."
                    : "Oculta para registrar asientos; los asientos existentes la conservan."}
                </span>
              </div>
              <Switch
                checked={isActive}
                onCheckedChange={(val) => setIsActive(!!val)}
                disabled={isSaving}
                aria-label="Estado activo de la cuenta"
              />
            </div>
          )}

          {isEditMode && cuenta.usos > 0 && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <span className={labelClasses}>Uso actual</span>
              <p className="text-xs text-slate-600 mt-1">
                La cuenta está en{" "}
                <b className="text-slate-900 tabular-nums">
                  {cuenta.usos} línea{cuenta.usos === 1 ? "" : "s"}
                </b>{" "}
                de asiento{cuenta.usos === 1 ? "" : "s"}. Su historial no se modifica.
              </p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
              <p className="flex items-center gap-1.5 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Revisa lo siguiente para guardar la cuenta
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                {errors.map((err, idx) => (
                  <li key={`${idx}-${err}`}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onCerrar}
              disabled={isSaving}
              className="rounded-lg border-slate-200 bg-white text-xs font-semibold shadow-none"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold shadow-none"
            >
              {isSaving
                ? "Guardando..."
                : isEditMode
                  ? "Guardar cambios"
                  : "Registrar cuenta"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
