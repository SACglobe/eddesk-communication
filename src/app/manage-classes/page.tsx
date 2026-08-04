"use client";

import { useEffect, useRef, useState } from "react";
import { GraduationCap, Plus, Trash2, Layers, BookOpen, X, Check, Save, AlertTriangle } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader } from "@/components/ui-kit";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastContext";

interface SchoolClass {
  id: string;
  name: string;
  sections: string[];
  subjects: string[];
  displayNo: number;
}

interface DraftClass {
  name: string;
  displayNo: number;
  sections: string[];
  subjects: string[];
}

function capitalizeWords(str: any): string {
  if (typeof str !== "string") return String(str || "");
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ManageClassesPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const { showToast } = useToast();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  
  // Unsaved new class draft state
  const [newClassDraft, setNewClassDraft] = useState<DraftClass | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSavingNewClass, setIsSavingNewClass] = useState(false);
  const newClassRef = useRef<HTMLDivElement | null>(null);

  const fetchStructures = async (showLoading = true) => {
    if (!schoolKey) return;
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("schoolacademicstructure")
        .select("*")
        .eq("schoolkey", schoolKey)
        .order("displayno", { ascending: true });

      if (error) {
        showToast(error.message || "Failed to load classes.", "error");
        return;
      }

      if (data) {
        const formatted: SchoolClass[] = data.map((item) => ({
          id: item.key || item.id,
          name: capitalizeWords(item.standardname),
          sections: Array.isArray(item.sections)
            ? item.sections.map((sec: any) => typeof sec === "string" ? capitalizeWords(sec) : capitalizeWords(sec?.name || sec?.section || ""))
            : [],
          subjects: Array.isArray(item.subjects)
            ? item.subjects.map((sub: any) => typeof sub === "string" ? capitalizeWords(sub) : capitalizeWords(sub?.name || sub?.subject || ""))
            : [],
          displayNo: item.displayno ?? 0,
        }));
        formatted.sort((a, b) => (a.displayNo ?? 0) - (b.displayNo ?? 0));
        setClasses(formatted);
      }
    } catch (err: any) {
      showToast(err?.message || "Error fetching academic structure.", "error");
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      fetchStructures();
    }
  }, [isAuthorized, schoolKey]);

  // Spawns a new un-saved draft row and scrolls smoothly to it
  const handleStartAddClass = () => {
    const nextDisplayNo = classes.length > 0 ? Math.max(...classes.map((c) => c.displayNo || 0)) + 1 : 1;
    setNewClassDraft({
      name: "",
      displayNo: nextDisplayNo,
      sections: [],
      subjects: [],
    });
    setDraftError(null);

    setTimeout(() => {
      newClassRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      const inputEl = newClassRef.current?.querySelector("input");
      if (inputEl) inputEl.focus();
    }, 100);
  };

  // Only saves the class to Supabase database when user clicks "Save Class"
  const handleSaveNewClass = async () => {
    if (!newClassDraft || !schoolKey) return;
    const trimmedName = newClassDraft.name.trim();

    if (!trimmedName) {
      setDraftError("Please enter a class name.");
      showToast("Please enter a valid class name.", "error");
      newClassRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const normalizedNewName = trimmedName.toLowerCase();
    const isDuplicate = classes.some(
      (c) => c.name.trim().toLowerCase() === normalizedNewName
    );

    if (isDuplicate) {
      const errorMsg = `A class named "${capitalizeWords(trimmedName)}" already exists. Please use a unique name.`;
      setDraftError(errorMsg);
      showToast(errorMsg, "error", "Duplicate Class");
      newClassRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setIsSavingNewClass(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.from("schoolacademicstructure").insert({
        schoolkey: schoolKey,
        standardname: capitalizeWords(trimmedName),
        displayno: newClassDraft.displayNo || 1,
        sections: newClassDraft.sections.map(capitalizeWords),
        subjects: newClassDraft.subjects.map(capitalizeWords),
      });

      if (error) {
        showToast(error.message || "Failed to add class.", "error");
      } else {
        showToast(`"${capitalizeWords(trimmedName)}" saved successfully.`, "success");
        setNewClassDraft(null);
        fetchStructures(false);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to save class.", "error");
    } finally {
      setIsSavingNewClass(false);
    }
  };

  const patchClass = async (id: string, patch: Partial<SchoolClass>) => {
    if (patch.name !== undefined) {
      const normalizedPatchName = patch.name.trim().toLowerCase();
      const isDuplicate = classes.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === normalizedPatchName
      );
      if (isDuplicate) {
        showToast(`A class named "${capitalizeWords(patch.name)}" already exists.`, "error", "Duplicate Class");
        fetchStructures(false);
        return;
      }
    }

    setClasses((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      return updated.sort((a, b) => (a.displayNo ?? 0) - (b.displayNo ?? 0));
    });

    try {
      const supabase = createClient();
      const updateData: any = {};
      if (patch.name !== undefined) updateData.standardname = patch.name;
      if (patch.sections !== undefined) updateData.sections = patch.sections;
      if (patch.subjects !== undefined) updateData.subjects = patch.subjects;
      if (patch.displayNo !== undefined) updateData.displayno = patch.displayNo;

      const { error } = await supabase
        .from("schoolacademicstructure")
        .update(updateData)
        .eq("key", id);

      if (error) {
        showToast(error.message || "Failed to update class.", "error");
        fetchStructures(false);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to update class.", "error");
      fetchStructures(false);
    }
  };

  const removeClass = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("schoolacademicstructure")
        .delete()
        .eq("key", id);

      if (error) {
        showToast(error.message || "Failed to delete class.", "error");
      } else {
        showToast("Class deleted successfully.", "info");
        fetchStructures(false);
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to delete class.", "error");
    }
  };

  if (accessError) {
    return <AccessDenied type={accessError} />;
  }

  if (isLoading || !isAuthorized) {
    return (
      <AppLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Academic"
          title="Classes & Subjects"
          description="Configure standards, sections and subject lists. Report card marks entry fills in automatically from here."
          action={
            <button
              onClick={handleStartAddClass}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5"
            >
              <Plus className="size-4" strokeWidth={2.4} />
              Add class / standard
            </button>
          }
        />

        <div className="space-y-5">
          {/* Saved Classes List (Sorted by displayNo ascending) */}
          {classes.map((cls) => (
            <section key={cls.id} className="surface p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft font-display text-sm font-semibold text-primary" title={`Display No: ${cls.displayNo}`}>
                    #{cls.displayNo}
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      value={cls.name}
                      onChange={(e) => patchClass(cls.id, { name: e.target.value })}
                      onBlur={(e) => patchClass(cls.id, { name: capitalizeWords(e.target.value) })}
                      className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1 font-display text-lg font-semibold outline-none focus:border-border focus:bg-background"
                    />
                    <p className="px-2 text-xs text-muted-foreground">
                      {cls.sections.length} sections · {cls.subjects.length} subjects
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                  <DisplayNoControl
                    value={cls.displayNo}
                    onSave={(newVal) => patchClass(cls.id, { displayNo: newVal })}
                  />

                  <button
                    onClick={() => removeClass(cls.id)}
                    aria-label={`Delete ${cls.name}`}
                    className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="size-4" strokeWidth={1.9} />
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-6 border-t border-border pt-5 lg:grid-cols-2">
                <ChipEditor
                  icon={Layers}
                  label={`Sections (${cls.sections.length})`}
                  hint="Optional"
                  placeholder="e.g. A"
                  values={cls.sections}
                  onChange={(sections) => patchClass(cls.id, { sections: sections.map(capitalizeWords) })}
                />
                <ListEditor
                  icon={BookOpen}
                  label={`Subjects (${cls.subjects.length})`}
                  hint="Auto-filled in marks entry"
                  placeholder="e.g. Mathematics"
                  values={cls.subjects}
                  onChange={(subjects) => patchClass(cls.id, { subjects: subjects.map(capitalizeWords) })}
                />
              </div>
            </section>
          ))}

          {/* New Class Draft Card (Un-saved) */}
          {newClassDraft && (
            <div ref={newClassRef} className="surface border-2 border-primary/40 p-6 shadow-lg transition-all">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground mt-6">
                    #{newClassDraft.displayNo}
                  </span>
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div>
                        <label className="block text-eyebrow mb-1">Class / Standard Name *</label>
                        <input
                          value={newClassDraft.name}
                          placeholder="e.g. Standard 10, 8 Th Std, Grade 5..."
                          onChange={(e) => {
                            setDraftError(null);
                            setNewClassDraft({ ...newClassDraft, name: e.target.value });
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveNewClass();
                            }
                          }}
                          className={`w-full rounded-xl border bg-background px-3.5 py-2 font-display text-lg font-semibold outline-none transition-colors ${
                            draftError
                              ? "border-destructive focus:ring-2 focus:ring-destructive/20"
                              : "border-primary/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                          }`}
                          autoFocus
                        />
                      </div>

                      <div>
                        <label className="block text-eyebrow mb-1">Display No *</label>
                        <input
                          type="number"
                          min="1"
                          value={newClassDraft.displayNo}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val >= 0) {
                              setNewClassDraft({ ...newClassDraft, displayNo: val });
                            }
                          }}
                          className="w-24 rounded-xl border border-primary/50 bg-background px-3.5 py-2 font-display text-lg font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                    </div>

                    {draftError && (
                      <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-semibold text-destructive">
                        <AlertTriangle className="size-4 shrink-0 text-destructive" />
                        <span>{draftError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-start sm:mt-6">
                  <button
                    onClick={() => setNewClassDraft(null)}
                    className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNewClass}
                    disabled={isSavingNewClass || !newClassDraft.name.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    <Check className="size-4" strokeWidth={2.4} />
                    {isSavingNewClass ? "Saving..." : "Save Class"}
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-6 border-t border-border pt-5 lg:grid-cols-2">
                <ChipEditor
                  icon={Layers}
                  label={`Sections (${newClassDraft.sections.length})`}
                  hint="Optional"
                  placeholder="e.g. A"
                  values={newClassDraft.sections}
                  onChange={(sections) => setNewClassDraft({ ...newClassDraft, sections: sections.map(capitalizeWords) })}
                />
                <ListEditor
                  icon={BookOpen}
                  label={`Subjects (${newClassDraft.subjects.length})`}
                  hint="Auto-filled in marks entry"
                  placeholder="e.g. Mathematics"
                  values={newClassDraft.subjects}
                  onChange={(subjects) => setNewClassDraft({ ...newClassDraft, subjects: subjects.map(capitalizeWords) })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function ChipEditor({
  icon: Icon,
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  icon: any;
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const val = inputValue.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
      setInputValue("");
    }
  };

  const handleRemove = (item: string) => {
    onChange(values.filter((v) => v !== item));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Icon className="size-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {values.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground"
          >
            {val}
            <button
              onClick={() => handleRemove(val)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium outline-none focus:border-primary/40 focus:bg-background"
        />
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
        >
          <Check className="size-3.5 text-primary" />
          Add
        </button>
      </div>
    </div>
  );
}

function ListEditor({
  icon: Icon,
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  icon: any;
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [inputValue, setInputValue] = useState("");

  const handleAdd = () => {
    const val = inputValue.trim();
    if (val && !values.includes(val)) {
      onChange([...values, val]);
      setInputValue("");
    }
  };

  const handleRemove = (item: string) => {
    onChange(values.filter((v) => v !== item));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          <Icon className="size-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">{hint}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {values.map((val) => (
          <span
            key={val}
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground"
          >
            {val}
            <button
              onClick={() => handleRemove(val)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder={placeholder}
          className="flex-1 rounded-xl border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium outline-none focus:border-primary/40 focus:bg-background"
        />
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-1 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-accent"
        >
          <Check className="size-3.5 text-primary" />
          Add
        </button>
      </div>
    </div>
  );
}

function DisplayNoControl({
  value,
  onSave,
}: {
  value: number;
  onSave: (newVal: number) => void;
}) {
  const [tempValue, setTempValue] = useState<string>(String(value));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTempValue(String(value));
  }, [value]);

  const parsed = parseInt(tempValue, 10);
  const isChanged = !isNaN(parsed) && parsed >= 0 && parsed !== value;

  const handleCommit = async () => {
    if (!isChanged) return;
    setIsSaving(true);
    await onSave(parsed);
    setIsSaving(false);
  };

  return (
    <div
      className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/40 p-1.5 pl-3"
      title="Display Order Position"
    >
      <span className="text-xs font-semibold text-muted-foreground">Display No:</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={tempValue}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          const cleanVal = e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
          setTempValue(cleanVal);
        }}
        onBlur={() => {
          const parsed = parseInt(tempValue, 10);
          if (isNaN(parsed) || parsed < 0) {
            setTempValue(String(value));
          } else {
            setTempValue(String(parsed));
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleCommit();
          }
        }}
        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center font-display text-xs font-bold text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {isChanged && (
        <button
          onClick={handleCommit}
          disabled={isSaving}
          className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all animate-in fade-in zoom-in-95"
          title="Save display number"
        >
          <Check className="size-3.5" strokeWidth={2.5} />
          <span>{isSaving ? "Saving..." : "Save"}</span>
        </button>
      )}
    </div>
  );
}
