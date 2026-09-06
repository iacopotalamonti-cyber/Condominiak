"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Condominium } from "@/lib/types";

export function EditCondominiumForm({ condominium }: { condominium: Condominium }) {
  const router = useRouter();
  const [form, setForm] = useState({
    via: condominium.via,
    civico: condominium.civico ?? "",
    citta: condominium.citta,
    cap: condominium.cap ?? "",
    nome_amm: condominium.nome_amm ?? "",
    email_amm: condominium.email_amm ?? "",
    tel_amm: condominium.tel_amm ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const supabase = createClient();
    await supabase
      .from("condominiums")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", condominium.id);
    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Via</Label>
          <Input value={form.via} onChange={(e) => setForm({ ...form, via: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Civico</Label>
          <Input value={form.civico} onChange={(e) => setForm({ ...form, civico: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Città</Label>
          <Input value={form.citta} onChange={(e) => setForm({ ...form, citta: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>CAP</Label>
          <Input value={form.cap} onChange={(e) => setForm({ ...form, cap: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Amministratore</Label>
          <Input value={form.nome_amm} onChange={(e) => setForm({ ...form, nome_amm: e.target.value })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email amministratore</Label>
          <Input
            type="email"
            value={form.email_amm}
            onChange={(e) => setForm({ ...form, email_amm: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Telefono amministratore</Label>
          <Input value={form.tel_amm} onChange={(e) => setForm({ ...form, tel_amm: e.target.value })} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? <Loader2 className="animate-spin" /> : <Save />}
          Salva modifiche
        </Button>
        {saved && <span className="text-sm text-success">Salvato</span>}
      </div>
    </div>
  );
}
