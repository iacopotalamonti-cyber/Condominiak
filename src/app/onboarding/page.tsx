"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { UploadStep } from "@/components/onboarding/UploadStep";
import { AnalyzingStep } from "@/components/onboarding/AnalyzingStep";
import { ResultsStep } from "@/components/onboarding/ResultsStep";
import { ConominioStep } from "@/components/onboarding/ConominioStep";
import { UnitaStep } from "@/components/onboarding/UnitaStep";
import { BilanciStep } from "@/components/onboarding/BilanciStep";
import { ImpiantiStep } from "@/components/onboarding/ImpiantiStep";
import { AntepimaStep } from "@/components/onboarding/AntepimaStep";
import type {
  ExtractedBilancio,
  ExtractedImpianti,
  ExtractedImpiantiDettagli,
  ExtractedInfo,
  ExtractedSpese,
  ExtractedUnita,
  ExtractionResult,
  UploadedFile,
} from "@/lib/types";

type WizardStep = "upload" | "analyzing" | "results" | "condominio" | "unita" | "bilanci" | "impianti" | "anteprima";

const STEP_ORDER: WizardStep[] = ["condominio", "unita", "bilanci", "impianti", "anteprima"];
const STEP_LABELS: Record<string, string> = {
  condominio: "Edificio",
  unita: "Unità",
  bilanci: "Bilanci",
  impianti: "Impianti",
  anteprima: "Anteprima",
};

const EMPTY_INFO: ExtractedInfo = {
  via: "",
  citta: "",
  cap: "",
  annoCostr: "",
  piani: 4,
  nApt: 12,
  pianoTerra: true,
  amm: "",
  emailAmm: "",
  telAmm: "",
};

const EMPTY_BILANCI: ExtractedBilancio[] = Array.from({ length: 5 }, (_, i) => ({
  anno: new Date().getFullYear() - i,
  prev: 0,
  cons: 0,
  fondo: 0,
}));

const EMPTY_SPESE: ExtractedSpese = {
  riscaldamento: 0,
  ascensore: 0,
  pulizia: 0,
  assicurazione: 0,
  amm: 0,
  illuminazione: 0,
  manutenzione: 0,
  acqua: 0,
  giardinaggio: 0,
  varie: 0,
};

const EMPTY_IMP: ExtractedImpianti = {
  riscaldamento: false,
  ascensore: false,
  areeVerdi: false,
  raffrescamento: false,
  citofono: false,
  parcheggio: false,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>("upload");
  const [aiFilled, setAiFilled] = useState(false);
  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [analyzingStatus, setAnalyzingStatus] = useState("Invio documenti…");

  const [info, setInfo] = useState<ExtractedInfo>(EMPTY_INFO);
  const [unita, setUnita] = useState<ExtractedUnita[]>([]);
  const [bilanci, setBilanci] = useState<ExtractedBilancio[]>(EMPTY_BILANCI);
  const [spese, setSpese] = useState<ExtractedSpese>(EMPTY_SPESE);
  const [imp, setImp] = useState<ExtractedImpianti>(EMPTY_IMP);
  const [impDet, setImpDet] = useState<ExtractedImpiantiDettagli>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]);

  async function handleAnalyze(files: UploadedFile[]) {
    setStep("analyzing");
    setExtractionError(null);
    setAnalyzingStatus("Invio documenti…");
    try {
      const createRes = await fetch("/api/extract-documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });
      const createJson = await createRes.json();
      if (!createJson.success) throw new Error(createJson.error || "Invio fallito");

      const jobId = createJson.jobId as string;
      const deadline = Date.now() + 5 * 60_000; // max 5 minuti di attesa
      setAnalyzingStatus("Analisi documenti in corso…");

      let result: ExtractionResult | null = null;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const statusRes = await fetch(`/api/extract-status?jobId=${encodeURIComponent(jobId)}`);
        const statusJson = await statusRes.json();

        if (statusJson.done && !statusJson.success) {
          throw new Error(statusJson.error || "Estrazione fallita");
        }

        if (statusJson.done) {
          result = statusJson.data as ExtractionResult;
          break;
        }
      }

      if (!result) throw new Error("Tempo massimo di attesa superato, riprova");

      setExtractionResult(result);
      setInfo({ ...EMPTY_INFO, ...result.info });
      setUnita(result.unita?.length ? result.unita : []);
      setBilanci(result.bilanci?.length ? result.bilanci : EMPTY_BILANCI);
      setSpese({ ...EMPTY_SPESE, ...result.spese });
      setImp({ ...EMPTY_IMP, ...result.imp });
      setImpDet(result.impDet ?? {});
      setAiFilled(true);
      setStep("results");
    } catch (err) {
      setExtractionError(err instanceof Error ? err.message : "Errore sconosciuto");
      setStep("upload");
    }
  }

  function handleSkipUpload() {
    setAiFilled(false);
    setStep("condominio");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/save-condominium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ info, unita, bilanci, spese, imp, impDet }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Salvataggio fallito");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Errore sconosciuto");
      setSubmitting(false);
    }
  }

  const showStepper = STEP_ORDER.includes(step as (typeof STEP_ORDER)[number]);

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">Configura il tuo condominio</h1>
        </div>

        {showStepper && (
          <div className="mb-6 flex items-center justify-center gap-2">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                    i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </div>
                <span className={`text-xs ${i <= stepIndex ? "text-foreground" : "text-muted-foreground"}`}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEP_ORDER.length - 1 && <div className="h-px w-6 bg-border" />}
              </div>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="py-8">
            {extractionError && step === "upload" && (
              <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {extractionError}
              </p>
            )}

            {step === "upload" && <UploadStep onAnalyze={handleAnalyze} onSkip={handleSkipUpload} />}
            {step === "analyzing" && <AnalyzingStep statusText={analyzingStatus} />}
            {step === "results" && extractionResult && (
              <ResultsStep
                result={extractionResult}
                onContinue={() => setStep("condominio")}
                onRetry={() => setStep("upload")}
              />
            )}
            {step === "condominio" && (
              <StepNav onNext={() => setStep("unita")} onBack={() => setStep("upload")}>
                <ConominioStep info={info} onChange={setInfo} aiFilled={aiFilled} />
              </StepNav>
            )}
            {step === "unita" && (
              <StepNav onNext={() => setStep("bilanci")} onBack={() => setStep("condominio")}>
                <UnitaStep unita={unita} onChange={setUnita} aiFilled={aiFilled} />
              </StepNav>
            )}
            {step === "bilanci" && (
              <StepNav onNext={() => setStep("impianti")} onBack={() => setStep("unita")}>
                <BilanciStep
                  bilanci={bilanci}
                  onBilanciChange={setBilanci}
                  spese={spese}
                  onSpeseChange={setSpese}
                  aiFilled={aiFilled}
                />
              </StepNav>
            )}
            {step === "impianti" && (
              <StepNav onNext={() => setStep("anteprima")} onBack={() => setStep("bilanci")}>
                <ImpiantiStep
                  imp={imp}
                  onImpChange={setImp}
                  impDet={impDet}
                  onImpDetChange={setImpDet}
                  aiFilled={aiFilled}
                />
              </StepNav>
            )}
            {step === "anteprima" && (
              <StepNav onBack={() => setStep("impianti")} hideNext>
                <AntepimaStep
                  info={info}
                  unita={unita}
                  bilanci={bilanci}
                  onSubmit={handleSubmit}
                  submitting={submitting}
                  error={submitError}
                />
              </StepNav>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepNav({
  children,
  onNext,
  onBack,
  hideNext,
}: {
  children: React.ReactNode;
  onNext?: () => void;
  onBack: () => void;
  hideNext?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {children}
      <div className="flex items-center justify-between border-t pt-4">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Indietro
        </button>
        {!hideNext && onNext && (
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continua
          </button>
        )}
      </div>
    </div>
  );
}
