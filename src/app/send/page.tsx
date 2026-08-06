"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Send as SendIcon, Coins } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import { useAuthGuard } from "@/lib/useAuthGuard";
import AccessDenied from "@/components/AccessDenied";
import { PageHeader, Panel } from "@/components/ui-kit";
import { WhatsAppPreview } from "@/components/whatsapp-preview";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ToastContext";

type Subject = { id: string; name: string; total: number; obtained: number };

interface AcademicStructure {
  id: string;
  standardName: string;
  sections: string[];
  subjects: string[];
  displayNo: number;
}


function capitalizeWords(str: any): string {
  if (typeof str !== "string") return String(str || "");
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function SendReportCardPage() {
  const { isLoading, isAuthorized, accessError, schoolKey } = useAuthGuard(true);
  const { showToast } = useToast();
  const [structures, setStructures] = useState<AcademicStructure[]>([]);
  const [whatsappCredit, setWhatsappCredit] = useState<number | null>(null);
  const [schoolName, setSchoolName] = useState<string>("School");
  const [schoolPhone, setSchoolPhone] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");

  const [phone, setPhone] = useState("");
  const [student, setStudent] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSection, setSelectedSection] = useState("");
  const [exam, setExam] = useState("Term Examination");
  const [marks, setMarks] = useState<Subject[]>([]);
  const [remarks, setRemarks] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [studentSuggestions, setStudentSuggestions] = useState<
    { studentName: string; mobile: string; classSec: string }[]
  >([]);
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'preview'>('form');

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (user.email) setUserEmail(user.email);

      let keyToUse = schoolKey;
      if (!keyToUse) {
        const { data: wu } = await supabase
          .from("whatsappusers")
          .select("schoolkey")
          .eq("authuserid", user.id)
          .maybeSingle();
        if (wu?.schoolkey) keyToUse = wu.schoolkey;
      }

      // Query whatsappuser details for school name & contact phone
      let { data: whatsappUser } = await supabase
        .from("whatsappusers")
        .select("*")
        .eq("authuserid", user.id)
        .maybeSingle();

      if (!whatsappUser && user.email) {
        const { data: userByEmail } = await supabase
          .from("whatsappusers")
          .select("*")
          .ilike("email", user.email.trim().toLowerCase())
          .maybeSingle();
        if (userByEmail) whatsappUser = userByEmail;
      }

      if (whatsappUser) {
        if (whatsappUser.schoolname) setSchoolName(whatsappUser.schoolname);
      }

      if (keyToUse) {
        // Fetch School Name from schools table (name column)
        const { data: schoolRow } = await supabase
          .from("schools")
          .select("name")
          .eq("key", keyToUse)
          .maybeSingle();

        if (schoolRow?.name) {
          setSchoolName(schoolRow.name);
        } else if (whatsappUser?.schoolname) {
          setSchoolName(whatsappUser.schoolname);
        }

        // Fetch Official Contact Phone from schoolidentity table (phone column)
        const { data: identityRow } = await supabase
          .from("schoolidentity")
          .select("phone")
          .eq("schoolkey", keyToUse)
          .maybeSingle();

        if (identityRow?.phone) {
          setSchoolPhone(identityRow.phone);
        } else if (whatsappUser?.contactmobile) {
          setSchoolPhone(whatsappUser.contactmobile);
        }
      }

      // Load school subscription data
      let subQuery = supabase
        .from("subscriptions")
        .select("whatsappcredit");

      if (keyToUse) {
        subQuery = subQuery.eq("schoolkey", keyToUse);
      } else {
        subQuery = subQuery.order("createdat", { ascending: false });
      }

      const { data: subList } = await subQuery.limit(1);
      const sub = subList && subList.length > 0 ? subList[0] : null;

      if (sub) {
        setWhatsappCredit(sub.whatsappcredit ?? 0);
      }

      // Load previous students from report_card_history for autocomplete suggestions
      const { data: historyItems } = await supabase
        .from("report_card_history")
        .select("studentname, mobile, classsec")
        .eq("schoolkey", keyToUse)
        .order("created_at", { ascending: false })
        .limit(100);

      if (historyItems) {
        const map = new Map<string, { studentName: string; mobile: string; classSec: string }>();
        historyItems.forEach((item) => {
          if (item.studentname) {
            const key = `${item.studentname.trim().toLowerCase()}-${item.mobile}`;
            if (!map.has(key)) {
              map.set(key, {
                studentName: capitalizeWords(item.studentname),
                mobile: item.mobile || "",
                classSec: item.classsec || "",
              });
            }
          }
        });
        setStudentSuggestions(Array.from(map.values()));
      }

      // Load academic structures sorted by displayno
      const { data: structData } = await supabase
        .from("schoolacademicstructure")
        .select("*")
        .eq("schoolkey", keyToUse)
        .order("displayno", { ascending: true });

      if (structData) {
        const formatted: AcademicStructure[] = structData.map(item => ({
          id: item.key || item.id,
          standardName: capitalizeWords(item.standardname),
          sections: Array.isArray(item.sections)
            ? item.sections.map((sec: any) => typeof sec === "string" ? sec : (sec?.name || sec?.section || String(sec || "")))
            : [],
          subjects: Array.isArray(item.subjects)
            ? item.subjects.map((sub: any) => typeof sub === "string" ? sub : (sub?.name || sub?.subject || String(sub || "")))
            : [],
          displayNo: item.displayno || 0
        }));
        formatted.sort((a, b) => (a.displayNo ?? 0) - (b.displayNo ?? 0));
        setStructures(formatted);
        if (formatted.length > 0) {
          setSelectedClassId(formatted[0].id);
        }

        // Check if there is a resend draft from History page
        try {
          const draftStr = localStorage.getItem("resend_draft");
          if (draftStr) {
            const draft = JSON.parse(draftStr);
            if (draft.studentName) setStudent(draft.studentName);
            if (draft.mobile) setPhone(draft.mobile);
            if (draft.examName) setExam(draft.examName);

            if (draft.classSec) {
              const matched = formatted.find(s =>
                draft.classSec.toLowerCase().includes(s.standardName.toLowerCase())
              );
              if (matched) {
                setSelectedClassId(matched.id);
                const secMatch = matched.sections.find(sec =>
                  draft.classSec.toLowerCase().includes(sec.toLowerCase())
                );
                if (secMatch) setSelectedSection(secMatch);
              }
            }
            localStorage.removeItem("resend_draft");
          }
        } catch (e) {
          console.error("Error restoring resend draft:", e);
        }
      }
    }

    loadData();

    const handleCreditsUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (typeof customEvent.detail === "number") {
        setWhatsappCredit(customEvent.detail);
      } else {
        loadData();
      }
    };

    window.addEventListener("credits_updated", handleCreditsUpdate);
    return () => {
      window.removeEventListener("credits_updated", handleCreditsUpdate);
    };
  }, [isAuthorized, schoolKey]);

  const selectedClass = structures.find(s => s.id === selectedClassId);

  // When selected class changes, populate sections and subjects without overriding valid active section
  useEffect(() => {
    if (!selectedClass) return;
    if (selectedClass.sections.length > 0) {
      setSelectedSection((prevSec) => {
        if (prevSec && selectedClass.sections.includes(prevSec)) {
          return prevSec;
        }
        return selectedClass.sections[0];
      });
    } else {
      setSelectedSection("");
    }

    setMarks(
      selectedClass.subjects.map((name, i) => ({
        id: `${selectedClass.id}-${i}-${name}`,
        name: capitalizeWords(name),
        total: 100,
        obtained: 0
      }))
    );
  }, [selectedClassId]);

  const klass = selectedClass
    ? `${selectedClass.standardName.toUpperCase()}${selectedSection ? ` - SECTION ${selectedSection.trim().toUpperCase()}` : ""}`
    : "";

  const totals = useMemo(() => {
    const total = marks.reduce((s, m) => s + m.total, 0);
    const obtained = marks.reduce((s, m) => s + m.obtained, 0);
    const percent = total ? Math.round((obtained / total) * 1000) / 10 : 0;
    return { total, obtained, percent };
  }, [marks]);

  const displaySchoolName = schoolName && schoolName !== "School" ? schoolName : "Sunrise International";
  const displaySchoolPhone = schoolPhone
    ? schoolPhone.startsWith("+")
      ? schoolPhone
      : `+91 ${schoolPhone.replace(/\D/g, "").slice(-10).replace(/(\d{5})(\d{5})/, "$1 $2")}`
    : "+91 99940 26550";

  const remarksText = remarks.trim()
    ? `${remarks.trim()} - Contact us on ${displaySchoolPhone}`
    : `Contact us on ${displaySchoolPhone}`;

  const previewLines = [
    `🎓 *${displaySchoolName} (${displaySchoolPhone})* 🎓`,
    "",
    `Dear Parent, the report card for *${exam || "—"}* exam has been published.`,
    "",
    `👤 *Name:* ${student ? capitalizeWords(student) : "—"}`,
    `🏫 *Class & Sec:* ${klass || "—"}`,
    "",
    "*--- Marks ---*",
    marks.filter((m) => m.name.trim()).map((m) => `${m.name}: ${m.obtained}/${m.total}`).join(", "),
    "",
    `📊 *Total:* ${totals.obtained} / ${totals.total}`,
    `📈 *Percentage:* ${totals.percent.toFixed(2)}%`,
    "",
    "*--- Remarks ---*",
    remarksText,
    "",
    "If you have any questions regarding your child's report card, please contact the school. Thank you!",
  ];

  const hasCredits = whatsappCredit === null || whatsappCredit > 0;
  const hasValidMarks = marks.length > 0 && marks.every((m) => !m.name.trim() || (m.obtained > 0 && m.total > 0));

  const isStudentValid = student.trim().length > 0;
  const isPhoneValid = phone.replace(/\D/g, "").length === 10;
  const isClassValid = Boolean(selectedClassId && selectedClass);
  const isSectionValid = selectedSection.trim().length > 0;
  const isExamValid = exam.trim().length > 0;

  const canSend =
    isStudentValid &&
    isPhoneValid &&
    isClassValid &&
    isSectionValid &&
    isExamValid &&
    hasCredits &&
    hasValidMarks;

  const updateSubject = (index: number, patch: Partial<Subject>) => {
    setMarks((prev) => prev.map((m, i) => (i === index ? { ...m, ...patch } : m)));
  };

  const handleSendReportCard = async () => {
    if (!isStudentValid) {
      showToast("Student name is required.", "error", "Missing Field");
      return;
    }
    if (!isPhoneValid) {
      showToast("Valid 10-digit parent WhatsApp number is required.", "error", "Missing Field");
      return;
    }
    if (!isClassValid) {
      showToast("Please select a class.", "error", "Missing Field");
      return;
    }
    if (!isSectionValid) {
      showToast("Please select a section.", "error", "Missing Field");
      return;
    }
    if (!isExamValid) {
      showToast("Exam name is required.", "error", "Missing Field");
      return;
    }

    const zeroMarkSubject = marks.find((m) => m.name.trim() && (m.obtained <= 0 || m.total <= 0));
    if (zeroMarkSubject) {
      showToast(`Obtained and Total marks must be greater than 0 for "${zeroMarkSubject.name}".`, "error", "Invalid Marks");
      return;
    }

    if (!canSend) return;
    setIsSending(true);
    setToastMessage(null);

    try {
      const finalMessage = previewLines.join("\n");
      const cleanPhone = phone.replace(/\D/g, "").slice(-10);

      const res = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mobile: cleanPhone,
          message: finalMessage,
          templateParams: {
            1: `${displaySchoolName} (${displaySchoolPhone})`,
            2: exam,
            3: capitalizeWords(student),
            4: klass,
            5: marks.filter(m => m.name.trim()).map(m => `${m.name}: ${m.obtained}/${m.total}`).join(", "),
            6: `${totals.obtained}/${totals.total}`,
            7: `${totals.percent.toFixed(2)}%`,
            8: remarksText
          }
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send WhatsApp message.");
      }

      // Record in Supabase report_card_history
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("report_card_history").insert({
        user_id: user?.id,
        schoolkey: schoolKey,
        sender_email: userEmail,
        studentname: capitalizeWords(student.trim()),
        mobile: cleanPhone,
        classsec: klass.trim(),
        examname: capitalizeWords(exam.trim()),
        message: finalMessage,
        sid: data.sid || null,
        status: data.status || "sent"
      });

      // Update local & remote credits balance cleanly from latest DB value
      let currentDbCredit = whatsappCredit;
      let targetSchoolKey = schoolKey;

      if (!targetSchoolKey && user?.id) {
        const { data: wu } = await supabase
          .from("whatsappusers")
          .select("schoolkey")
          .eq("authuserid", user.id)
          .maybeSingle();
        if (wu?.schoolkey) targetSchoolKey = wu.schoolkey;
      }

      if (targetSchoolKey) {
        const { data: latestSub } = await supabase
          .from("subscriptions")
          .select("whatsappcredit")
          .eq("schoolkey", targetSchoolKey)
          .maybeSingle();
        if (latestSub?.whatsappcredit !== undefined && latestSub?.whatsappcredit !== null) {
          currentDbCredit = latestSub.whatsappcredit;
        }
      }

      const newBalance = Math.max(0, (currentDbCredit ?? 0) - 1);
      setWhatsappCredit(newBalance);
      window.dispatchEvent(new CustomEvent("credits_updated", { detail: newBalance }));

      if (targetSchoolKey) {
        await supabase
          .from("subscriptions")
          .update({ whatsappcredit: newBalance })
          .eq("schoolkey", targetSchoolKey);
      }

      showToast(`Report card sent successfully to +91 ${cleanPhone}!`, "success", "Report Card Sent");

      // Reset form
      setPhone("");
      setStudent("");
      setRemarks("");
      if (selectedClass) {
        setMarks(
          selectedClass.subjects.map((name, i) => ({
            id: `${selectedClass.id}-${i}-${name}`,
            name: capitalizeWords(name),
            total: 100,
            obtained: 0
          }))
        );
      }
    } catch (err: any) {
      showToast(err.message || "Failed to send report card.", "error", "Sending Failed");
    } finally {
      setIsSending(false);
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
          eyebrow="Report card"
          title="Send a report card"
          description="Fill in student details and marks. The live WhatsApp preview updates in real-time."
        />

        {/* Mobile View Switcher */}
        <div className="flex rounded-xl bg-muted/60 p-1 xl:hidden">
          <button
            type="button"
            onClick={() => setActiveMobileTab('form')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
              activeMobileTab === 'form'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            ✍️ Student Details & Marks
          </button>
          <button
            type="button"
            onClick={() => setActiveMobileTab('preview')}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all ${
              activeMobileTab === 'preview'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            💬 Live WhatsApp Preview
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,420px)]">
          <div className={`${activeMobileTab === 'form' ? 'block' : 'hidden xl:block'} space-y-5`}>
            <Panel>
              <div className="grid gap-5 sm:grid-cols-2">
                {/* 1. Student name (with suggestions dropdown) */}
                <div className="relative block">
                  <span className="text-eyebrow">Student name *</span>
                  <input
                    value={student}
                    placeholder="e.g. Aarav Sundaram"
                    onFocus={() => setShowStudentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowStudentDropdown(false), 200)}
                    onChange={(e) => {
                      setStudent(e.target.value);
                      setShowStudentDropdown(true);
                    }}
                    className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary/40 focus:bg-background"
                  />

                  {showStudentDropdown && student.trim().length >= 1 && (
                    <ul className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-pop">
                      {studentSuggestions
                        .filter(
                          (s) =>
                            s.studentName.toLowerCase().includes(student.toLowerCase()) ||
                            s.mobile.includes(student)
                        )
                        .slice(0, 8)
                        .map((sug, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              onMouseDown={() => {
                                setStudent(sug.studentName);
                                if (sug.mobile) setPhone(sug.mobile);
                                if (sug.classSec && structures.length > 0) {
                                  const matched = structures.find((s) =>
                                    sug.classSec.toLowerCase().includes(s.standardName.toLowerCase())
                                  );
                                  if (matched) {
                                    setSelectedClassId(matched.id);
                                    const secMatch = matched.sections.find((sec) =>
                                      sug.classSec.toLowerCase().includes(sec.toLowerCase())
                                    );
                                    if (secMatch) setSelectedSection(secMatch);
                                  }
                                }
                                setShowStudentDropdown(false);
                              }}
                              className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                            >
                              <span className="font-semibold text-foreground">{sug.studentName}</span>
                              <span className="text-muted-foreground">
                                +91 {sug.mobile} · {sug.classSec}
                              </span>
                            </button>
                          </li>
                        ))}
                      {studentSuggestions.filter(
                        (s) =>
                          s.studentName.toLowerCase().includes(student.toLowerCase()) ||
                          s.mobile.includes(student)
                      ).length === 0 && (
                        <li className="px-3 py-2 text-xs text-muted-foreground">No matching student found</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* 2. Parent WhatsApp (with suggestions dropdown) */}
                <div className="relative block">
                  <span className="text-eyebrow">Parent WhatsApp *</span>
                  <span className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 transition-colors focus-within:border-primary/40 focus-within:bg-background">
                    <span className="shrink-0 text-sm text-muted-foreground">+91</span>
                    <input
                      value={phone}
                      placeholder="10-digit mobile number"
                      onFocus={() => setShowPhoneDropdown(true)}
                      onBlur={() => setTimeout(() => setShowPhoneDropdown(false), 200)}
                      onChange={(e) => {
                        setPhone(e.target.value.replace(/\D/g, "").slice(0, 10));
                        setShowPhoneDropdown(true);
                      }}
                      className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:font-normal placeholder:text-muted-foreground"
                    />
                  </span>

                  {showPhoneDropdown && phone.length >= 1 && (
                    <ul className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-pop">
                      {studentSuggestions
                        .filter(
                          (s) =>
                            s.mobile.includes(phone) ||
                            s.studentName.toLowerCase().includes(phone.toLowerCase())
                        )
                        .slice(0, 8)
                        .map((sug, idx) => (
                          <li key={idx}>
                            <button
                              type="button"
                              onMouseDown={() => {
                                setStudent(sug.studentName);
                                if (sug.mobile) setPhone(sug.mobile);
                                if (sug.classSec && structures.length > 0) {
                                  const matched = structures.find((s) =>
                                    sug.classSec.toLowerCase().includes(s.standardName.toLowerCase())
                                  );
                                  if (matched) {
                                    setSelectedClassId(matched.id);
                                    const secMatch = matched.sections.find((sec) =>
                                      sug.classSec.toLowerCase().includes(sec.toLowerCase())
                                    );
                                    if (secMatch) setSelectedSection(secMatch);
                                  }
                                }
                                setShowPhoneDropdown(false);
                              }}
                              className="flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
                            >
                              <span className="font-semibold text-foreground">{sug.studentName}</span>
                              <span className="text-muted-foreground">
                                +91 {sug.mobile} · {sug.classSec}
                              </span>
                            </button>
                          </li>
                        ))}
                      {studentSuggestions.filter(
                        (s) =>
                          s.mobile.includes(phone) ||
                          s.studentName.toLowerCase().includes(phone.toLowerCase())
                      ).length === 0 && (
                        <li className="px-3 py-2 text-xs text-muted-foreground">No matching mobile found</li>
                      )}
                    </ul>
                  )}
                </div>

                {/* 3. Class / standard */}
                <label className="block">
                  <span className="text-eyebrow">Class / standard *</span>
                  <select
                    value={selectedClassId}
                    disabled={structures.length === 0}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary/40 focus:bg-background disabled:opacity-60"
                  >
                    {structures.length === 0 ? <option value="">No classes configured</option> : null}
                    {structures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.standardName}
                      </option>
                    ))}
                  </select>
                </label>

                {/* 4. Section */}
                {selectedClass && selectedClass.sections.length > 0 ? (
                  <label className="block">
                    <span className="text-eyebrow">Section *</span>
                    <select
                      value={selectedSection}
                      onChange={(e) => setSelectedSection(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary/40 focus:bg-background"
                    >
                      {selectedClass.sections.map((sec) => (
                        <option key={sec} value={sec}>
                          {sec}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div />
                )}

                {/* 5. Exam name */}
                <label className="block sm:col-span-2">
                  <span className="text-eyebrow">Exam name *</span>
                  <input
                    value={exam}
                    placeholder="e.g. Term II Examination"
                    onChange={(e) => setExam(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-muted/50 px-3.5 py-2.5 text-sm font-medium outline-none transition-colors focus:border-primary/40 focus:bg-background"
                  />
                </label>
              </div>
            </Panel>

            <Panel
              title="Marks entry"
              hint="Subjects come from the selected class. Totals update automatically."
              action={
                <Link href="/manage-classes" className="text-xs font-medium text-primary hover:underline">
                  Manage classes
                </Link>
              }
            >
              {marks.length === 0 ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                  No subjects configured for this class.{" "}
                  <Link href="/manage-classes" className="font-medium text-primary hover:underline">
                    Add subjects
                  </Link>{" "}
                  to auto-fill marks entry.
                </p>
              ) : null}

              {marks.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Subject</th>
                        <th className="w-28 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Obtained</th>
                        <th className="w-28 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">Total</th>
                        <th className="w-20 px-3 py-2.5 text-right text-xs font-medium text-muted-foreground">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {marks.map((m, i) => {
                        const pct = m.total ? Math.round((m.obtained / m.total) * 1000) / 10 : 0;
                        return (
                          <tr key={m.id} className="hover:bg-muted/30">
                            <td className="px-3 py-2">
                              <input
                                value={m.name}
                                placeholder={`Subject ${i + 1}`}
                                onChange={(e) => updateSubject(i, { name: e.target.value })}
                                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm font-medium outline-none focus:border-border focus:bg-background"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={m.obtained === 0 ? "" : m.obtained}
                                placeholder="1"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const cleanVal = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                                  const num = cleanVal === "" ? 0 : parseInt(cleanVal, 10);
                                  updateSubject(i, { obtained: Math.min(isNaN(num) ? 0 : num, m.total) });
                                }}
                                onBlur={(e) => {
                                  if (m.obtained <= 0) {
                                    updateSubject(i, { obtained: 1 });
                                    e.target.value = "1";
                                  } else {
                                    e.target.value = String(m.obtained);
                                  }
                                }}
                                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-border focus:bg-background"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={m.total === 0 ? "" : m.total}
                                placeholder="100"
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => {
                                  const cleanVal = e.target.value.replace(/\D/g, "").replace(/^0+/, "");
                                  const num = cleanVal === "" ? 0 : parseInt(cleanVal, 10);
                                  updateSubject(i, { total: isNaN(num) ? 0 : num });
                                }}
                                onBlur={(e) => {
                                  if (m.total <= 0) {
                                    updateSubject(i, { total: 100 });
                                    e.target.value = "100";
                                  } else {
                                    e.target.value = String(m.total);
                                  }
                                }}
                                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:border-border focus:bg-background"
                              />
                            </td>
                            <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">{pct}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-5 grid gap-3 rounded-xl bg-primary-soft/60 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-eyebrow">Total Marks</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                    {totals.obtained} / {totals.total}
                  </p>
                </div>
                <div>
                  <p className="text-eyebrow">Percentage</p>
                  <p className="mt-1 font-display text-lg font-semibold tabular-nums">
                    {totals.percent.toFixed(2)}%
                  </p>
                </div>
              </div>
            </Panel>

            <Panel title="Remarks" hint="Optional — added at the end of the message.">
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Write a short note for the parent..."
                className="w-full resize-none rounded-xl border border-border bg-muted/50 p-4 text-sm outline-none transition-colors focus:border-primary/40 focus:bg-background"
              />
            </Panel>
          </div>

          <div className={`${activeMobileTab === 'preview' ? 'block' : 'hidden xl:block'} space-y-4 xl:sticky xl:top-24 xl:self-start`}>
            <p className="text-eyebrow">Live WhatsApp preview</p>
            <WhatsAppPreview lines={previewLines} recipient={student ? capitalizeWords(student) : "Parent"} />

            <div className="surface p-5">
              <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="size-4 text-primary" strokeWidth={2} />
                  1 credit per report card
                </span>
                <span className="text-sm font-medium tabular-nums">
                  {whatsappCredit !== null ? whatsappCredit.toLocaleString() : "..."} credits left
                </span>
              </div>

              <button
                disabled={!canSend || isSending}
                onClick={handleSendReportCard}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-whatsapp px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-45"
              >
                <SendIcon className="size-4" strokeWidth={2.2} />
                {isSending ? "Sending report card…" : "Send WhatsApp message"}
              </button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                {canSend
                  ? "Delivery is tracked in History."
                  : whatsappCredit !== null && whatsappCredit < 1
                  ? "Insufficient credits. Top up to send."
                  : !isStudentValid
                  ? "Enter student name."
                  : !isPhoneValid
                  ? "Enter a valid 10-digit parent WhatsApp number."
                  : !isClassValid
                  ? "Select a class."
                  : !isSectionValid
                  ? "Select a section."
                  : !isExamValid
                  ? "Enter exam name."
                  : !hasValidMarks
                  ? "All subjects must have obtained & total marks greater than 0."
                  : "Fill all mandatory fields to send."}
              </p>
            </div>
          </div>
        </div>

        {/* Sticky Mobile Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between gap-3 border-t border-border bg-card/90 px-4 py-3 shadow-lg backdrop-blur-md xl:hidden">
          <div>
            <span className="block text-[11px] font-semibold text-muted-foreground uppercase">Credits left</span>
            <span className="font-display text-sm font-bold tabular-nums text-foreground">
              {whatsappCredit !== null ? whatsappCredit.toLocaleString() : "..."} credits
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveMobileTab(activeMobileTab === 'form' ? 'preview' : 'form')}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95"
          >
            {activeMobileTab === 'form' ? 'Preview & Send →' : '← Back to Form'}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
