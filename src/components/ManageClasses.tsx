"use client";

import { useState, useEffect } from "react";
import { 
    Plus, Trash2, Edit2, Check, X, BookOpen, Layers, 
    ChevronRight, AlertCircle, GraduationCap, Settings
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AcademicStructure, Section, SubjectItem } from "@/types/academic";

interface ManageClassesProps {
    schoolKey: string;
}

const capitalizeWords = (str: string) => {
    if (!str) return "";
    return str
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

export default function ManageClasses({ schoolKey }: ManageClassesProps) {
    const [structures, setStructures] = useState<AcademicStructure[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Modal / Form State: Add New Standard (Class)
    const [showAddStandardModal, setShowAddStandardModal] = useState(false);
    const [newStandardName, setNewStandardName] = useState("");
    const [newStandardDisplayNo, setNewStandardDisplayNo] = useState<number>(10);
    const [newStandardSections, setNewStandardSections] = useState("");
    const [newStandardSubjects, setNewStandardSubjects] = useState("");

    // Modal / Form State: Edit Class (Standard)
    const [editingStandard, setEditingStandard] = useState<AcademicStructure | null>(null);
    const [editStandardName, setEditStandardName] = useState("");
    const [editStandardDisplayNo, setEditStandardDisplayNo] = useState<number>(1);

    // Inline Form State: Add Section
    const [addingSectionForKey, setAddingSectionForKey] = useState<string | null>(null);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionDisplayNo, setNewSectionDisplayNo] = useState<number>(1);

    // Modal / Inline Form State: Edit Section
    const [editingSection, setEditingSection] = useState<{
        standardItem: AcademicStructure;
        oldName: string;
        name: string;
        displayno: number;
    } | null>(null);

    // Inline Form State: Add Subject
    const [addingSubjectForKey, setAddingSubjectForKey] = useState<string | null>(null);
    const [newSubjectName, setNewSubjectName] = useState("");
    const [newSubjectDisplayNo, setNewSubjectDisplayNo] = useState<number>(1);

    // Modal / Inline Form State: Edit Subject
    const [editingSubject, setEditingSubject] = useState<{
        standardItem: AcademicStructure;
        oldName: string;
        name: string;
        displayno: number;
    } | null>(null);

    useEffect(() => {
        fetchStructures(true);
    }, [schoolKey]);

    const showToast = (type: 'success' | 'error', text: string) => {
        setToastMessage({ type, text });
        setTimeout(() => setToastMessage(null), 3000);
    };

    const fetchStructures = async (showLoading = false) => {
        try {
            if (showLoading) setIsLoading(true);
            const supabase = createClient();

            const { data, error } = await supabase
                .from("schoolacademicstructure")
                .select("*")
                .eq("schoolkey", schoolKey)
                .order("displayno", { ascending: true });

            if (error) {
                console.error("Error fetching academic structure:", error);
                showToast('error', "Failed to load academic structure.");
            } else if (data) {
                const sorted = (data as AcademicStructure[]).map(item => ({
                    ...item,
                    sections: [...(item.sections || [])].sort((a, b) => (a.displayno || 0) - (b.displayno || 0)),
                    subjects: [...(item.subjects || [])].sort((a, b) => (a.displayno || 0) - (b.displayno || 0))
                })).sort((a, b) => (a.displayno || 0) - (b.displayno || 0));

                setStructures(sorted);
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (showLoading) setIsLoading(false);
        }
    };

    // ── CREATE NEW CLASS / STANDARD ──
    const handleAddStandard = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = newStandardName.trim();
        if (!trimmedName) return;

        // Validation: Unique Class Name Check
        const isDuplicate = structures.some(
            s => s.standardname.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
            showToast('error', `A class named "${trimmedName}" already exists.`);
            return;
        }

        setIsSaving(true);
        try {
            const supabase = createClient();
            const now = new Date().toISOString();

            // Parse optional sections (comma-separated e.g. "A, B, C")
            const initialSections: Section[] = newStandardSections.trim()
                ? newStandardSections.split(",").map((s, idx) => ({
                    name: s.trim().toUpperCase(),
                    displayno: idx + 1,
                    createdtime: now
                })).filter(s => s.name.length > 0)
                : [];

            // Parse subjects list (comma-separated e.g. "Tamil, English, Mathematics")
            const initialSubjects: SubjectItem[] = newStandardSubjects.trim()
                ? newStandardSubjects.split(",").map((s, idx) => ({
                    name: s.trim(),
                    displayno: idx + 1,
                    createdtime: now
                })).filter(s => s.name.length > 0)
                : [];

            const newRow = {
                schoolkey: schoolKey,
                standardname: trimmedName,
                displayno: Number(newStandardDisplayNo) || 1,
                sections: initialSections,
                subjects: initialSubjects,
                createdtime: now,
                updatedtime: now
            };

            const { error } = await supabase
                .from("schoolacademicstructure")
                .insert([newRow]);

            if (error) throw error;

            showToast('success', `Added Class ${trimmedName}`);
            setNewStandardName("");
            setNewStandardSections("");
            setNewStandardSubjects("");
            setShowAddStandardModal(false);
            fetchStructures();
        } catch (err: any) {
            console.error("Add Standard error:", err);
            showToast('error', err.message || "Failed to add standard.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── UPDATE CLASS / STANDARD ──
    const handleSaveEditStandard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingStandard) return;
        const trimmedName = editStandardName.trim();
        if (!trimmedName) return;

        // Validation: Unique Class Name Check (excluding current item)
        const isDuplicate = structures.some(
            s => s.key !== editingStandard.key && s.standardname.trim().toLowerCase() === trimmedName.toLowerCase()
        );
        if (isDuplicate) {
            showToast('error', `A class named "${trimmedName}" already exists.`);
            return;
        }

        setIsSaving(true);
        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    standardname: trimmedName, 
                    displayno: Number(editStandardDisplayNo) || 1,
                    updatedtime: new Date().toISOString() 
                })
                .eq("key", editingStandard.key);

            if (error) throw error;

            showToast('success', `Updated ${trimmedName}`);
            setEditingStandard(null);
            fetchStructures();
        } catch (err: any) {
            console.error("Update Standard error:", err);
            showToast('error', err.message || "Failed to update standard.");
        } finally {
            setIsSaving(false);
        }
    };

    // ── DELETE CLASS / STANDARD ──
    const handleDeleteStandard = async (key: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name} and all its sections/subjects?`)) return;

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .delete()
                .eq("key", key);

            if (error) throw error;

            showToast('success', `Deleted ${name}`);
            setStructures(prev => prev.filter(item => item.key !== key));
        } catch (err: any) {
            console.error("Delete error:", err);
            showToast('error', err.message || "Failed to delete standard.");
        }
    };

    // ── ADD SECTION ──
    const handleAddSection = async (standardItem: AcademicStructure) => {
        const formattedName = capitalizeWords(newSectionName.trim());
        if (!formattedName) return;

        const now = new Date().toISOString();
        const updatedSections: Section[] = [
            ...(standardItem.sections || []),
            { name: formattedName, displayno: Number(newSectionDisplayNo) || 1, createdtime: now }
        ].sort((a, b) => a.displayno - b.displayno);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    sections: updatedSections,
                    updatedtime: now 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Added Section ${formattedName}`);
            setNewSectionName("");
            setAddingSectionForKey(null);
            fetchStructures();
        } catch (err: any) {
            console.error("Add section error:", err);
            showToast('error', err.message || "Failed to add section.");
        }
    };

    // ── SAVE EDIT SECTION ──
    const handleSaveEditSection = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSection || !editingSection.name.trim()) return;

        const { standardItem, oldName, name, displayno } = editingSection;
        const formattedName = capitalizeWords(name.trim());
        const updatedSections = (standardItem.sections || []).map(sec => {
            if (sec.name === oldName) {
                return { ...sec, name: formattedName, displayno: Number(displayno) || 1 };
            }
            return sec;
        }).sort((a, b) => a.displayno - b.displayno);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    sections: updatedSections,
                    updatedtime: new Date().toISOString() 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Updated Section ${formattedName}`);
            setEditingSection(null);
            fetchStructures();
        } catch (err: any) {
            console.error("Update section error:", err);
            showToast('error', err.message || "Failed to update section.");
        }
    };

    // ── DELETE SECTION ──
    const handleDeleteSection = async (standardItem: AcademicStructure, sectionName: string) => {
        const updatedSections = (standardItem.sections || []).filter(s => s.name !== sectionName);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    sections: updatedSections,
                    updatedtime: new Date().toISOString() 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Removed Section ${sectionName}`);
            fetchStructures();
        } catch (err: any) {
            console.error("Delete section error:", err);
            showToast('error', err.message || "Failed to delete section.");
        }
    };

    // ── ADD SUBJECT ──
    const handleAddSubject = async (standardItem: AcademicStructure) => {
        if (!newSubjectName.trim()) return;

        const now = new Date().toISOString();
        const updatedSubjects: SubjectItem[] = [
            ...(standardItem.subjects || []),
            { name: newSubjectName.trim(), displayno: Number(newSubjectDisplayNo) || 1, createdtime: now }
        ].sort((a, b) => a.displayno - b.displayno);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    subjects: updatedSubjects,
                    updatedtime: now 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Added Subject ${newSubjectName}`);
            setNewSubjectName("");
            setAddingSubjectForKey(null);
            fetchStructures();
        } catch (err: any) {
            console.error("Add subject error:", err);
            showToast('error', err.message || "Failed to add subject.");
        }
    };

    // ── SAVE EDIT SUBJECT ──
    const handleSaveEditSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSubject || !editingSubject.name.trim()) return;

        const { standardItem, oldName, name, displayno } = editingSubject;
        const updatedSubjects = (standardItem.subjects || []).map(sub => {
            if (sub.name === oldName) {
                return { ...sub, name: name.trim(), displayno: Number(displayno) || 1 };
            }
            return sub;
        }).sort((a, b) => a.displayno - b.displayno);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    subjects: updatedSubjects,
                    updatedtime: new Date().toISOString() 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Updated Subject ${name}`);
            setEditingSubject(null);
            fetchStructures();
        } catch (err: any) {
            console.error("Update subject error:", err);
            showToast('error', err.message || "Failed to update subject.");
        }
    };

    // ── DELETE SUBJECT ──
    const handleDeleteSubject = async (standardItem: AcademicStructure, subjectName: string) => {
        const updatedSubjects = (standardItem.subjects || []).filter(s => s.name !== subjectName);

        try {
            const supabase = createClient();
            const { error } = await supabase
                .from("schoolacademicstructure")
                .update({ 
                    subjects: updatedSubjects,
                    updatedtime: new Date().toISOString() 
                })
                .eq("key", standardItem.key);

            if (error) throw error;

            showToast('success', `Removed ${subjectName}`);
            fetchStructures();
        } catch (err: any) {
            console.error("Delete subject error:", err);
            showToast('error', err.message || "Failed to delete subject.");
        }
    };

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#F54927]"></div>
            </div>
        );
    }

    return (
        <div className="w-full min-h-full bg-slate-50/50 p-6 md:p-10 font-sans">
            
            {/* Toast Notification */}
            {toastMessage && (
                <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 transition-all ${
                    toastMessage.type === 'success' 
                        ? 'bg-emerald-500 text-white border-emerald-600' 
                        : 'bg-rose-500 text-white border-rose-600'
                }`}>
                    {toastMessage.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{toastMessage.text}</span>
                </div>
            )}

            <div className="max-w-5xl mx-auto space-y-8">
                
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm text-slate-400 font-medium mb-1">
                            <span>Academic</span>
                            <span>/</span>
                            <span className="text-slate-900 font-semibold">Manage Classes</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <GraduationCap className="w-7 h-7 text-[#F54927]" />
                            <span>Classes &amp; Subjects</span>
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Configure standards, sections, and subject templates for report cards.</p>
                    </div>

                    <button
                        onClick={() => {
                            setNewStandardName("");
                            setNewStandardDisplayNo(structures.length > 0 ? (Math.max(...structures.map(s => s.displayno || 0)) + 1) : 1);
                            setNewStandardSections("");
                            setNewStandardSubjects("");
                            setShowAddStandardModal(true);
                        }}
                        className="inline-flex items-center gap-2 py-3 px-5 rounded-2xl font-extrabold text-white text-sm bg-[#F54927] hover:bg-[#e03d1d] active:scale-95 transition-all shadow-lg shadow-orange-500/20 whitespace-nowrap self-start sm:self-auto"
                    >
                        <Plus className="w-5 h-5" />
                        <span>Add Class / Standard</span>
                    </button>
                </div>

                {/* ── Empty State ── */}
                {structures.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 shadow-sm">
                        <div className="w-16 h-16 rounded-2xl bg-orange-50 text-[#F54927] flex items-center justify-center mx-auto border border-orange-100">
                            <BookOpen className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">No Academic Structure Configured</h3>
                        <p className="text-slate-500 text-sm max-w-md mx-auto">
                            Add your first class (e.g. Grade 10) to configure optional sections and default subjects for report cards.
                        </p>
                        <button
                            onClick={() => setShowAddStandardModal(true)}
                            className="inline-flex items-center gap-2 py-3 px-6 rounded-xl font-bold text-white bg-[#F54927] hover:bg-[#e03d1d] transition-all text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create First Class</span>
                        </button>
                    </div>
                ) : (
                    /* ── List of Standards / Classes ── */
                    <div className="space-y-6">
                        {structures.map((item) => (
                            <div key={item.key} className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm hover:shadow-md transition-all space-y-6">
                                
                                {/* Standard Card Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white font-black text-lg flex items-center justify-center shadow-md">
                                            {item.displayno}
                                        </div>
                                        <div>
                                            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{item.standardname}</h2>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Display Order: {item.displayno}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 self-end sm:self-auto">
                                        <button
                                            onClick={() => {
                                                setEditingStandard(item);
                                                setEditStandardName(item.standardname);
                                                setEditStandardDisplayNo(item.displayno);
                                            }}
                                            className="p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all flex items-center gap-1.5 text-xs font-bold"
                                            title="Edit Class Name & Display Order"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                            <span>Edit Class</span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteStandard(item.key, item.standardname)}
                                            className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all"
                                            title="Delete Class"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Grid: Sections & Subjects */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    
                                    {/* Left: Sections List */}
                                    <div className="lg:col-span-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
                                                <Layers className="w-4 h-4 text-purple-600" />
                                                <span>Sections ({item.sections?.length || 0})</span>
                                                <span className="text-[10px] font-normal text-slate-400 normal-case">(Optional)</span>
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setAddingSectionForKey(addingSectionForKey === item.key ? null : item.key);
                                                    setNewSectionName("");
                                                    setNewSectionDisplayNo((item.sections?.length || 0) + 1);
                                                }}
                                                className="text-xs font-bold text-[#F54927] hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Section</span>
                                            </button>
                                        </div>

                                        {/* Inline Add Section Form */}
                                        {addingSectionForKey === item.key && (
                                            <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4 flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Section Name (e.g. A, B)"
                                                    value={newSectionName}
                                                    onChange={e => setNewSectionName(e.target.value)}
                                                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-purple-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Order"
                                                    value={newSectionDisplayNo}
                                                    onChange={e => setNewSectionDisplayNo(Number(e.target.value))}
                                                    className="w-16 px-2 py-2 text-sm rounded-xl border border-purple-200 bg-white font-medium text-center focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => handleAddSection(item)}
                                                    className="p-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Sections Chips */}
                                        <div className="flex flex-wrap gap-2.5">
                                            {(item.sections || []).length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No sections created (Batch style).</p>
                                            ) : (
                                                item.sections.map((sec) => (
                                                    <div key={sec.name} className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200/80 px-3.5 py-1.5 rounded-xl text-sm font-bold text-slate-700 group">
                                                        <span>{capitalizeWords(sec.name)}</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">({sec.displayno})</span>
                                                        <button
                                                            onClick={() => setEditingSection({
                                                                standardItem: item,
                                                                oldName: sec.name,
                                                                name: sec.name,
                                                                displayno: sec.displayno || 1
                                                            })}
                                                            className="text-slate-400 hover:text-slate-900 transition-colors"
                                                            title="Edit Section Name & Display Order"
                                                        >
                                                            <Edit2 className="w-3 h-3" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSection(item, sec.name)}
                                                            className="text-slate-400 hover:text-rose-500 transition-colors"
                                                            title="Delete Section"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: Subjects List */}
                                    <div className="lg:col-span-7 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black text-slate-400 tracking-widest uppercase flex items-center gap-2">
                                                <BookOpen className="w-4 h-4 text-emerald-600" />
                                                <span>Subjects ({item.subjects?.length || 0})</span>
                                            </h3>
                                            <button
                                                onClick={() => {
                                                    setAddingSubjectForKey(addingSubjectForKey === item.key ? null : item.key);
                                                    setNewSubjectName("");
                                                    setNewSubjectDisplayNo((item.subjects?.length || 0) + 1);
                                                }}
                                                className="text-xs font-bold text-[#F54927] hover:underline flex items-center gap-1"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                                <span>Add Subject</span>
                                            </button>
                                        </div>

                                        {/* Inline Add Subject Form */}
                                        {addingSubjectForKey === item.key && (
                                            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center gap-3">
                                                <input
                                                    type="text"
                                                    placeholder="Subject Name (e.g. Science)"
                                                    value={newSubjectName}
                                                    onChange={e => setNewSubjectName(e.target.value)}
                                                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-emerald-200 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Order"
                                                    value={newSubjectDisplayNo}
                                                    onChange={e => setNewSubjectDisplayNo(Number(e.target.value))}
                                                    className="w-16 px-2 py-2 text-sm rounded-xl border border-emerald-200 bg-white font-medium text-center focus:outline-none"
                                                />
                                                <button
                                                    onClick={() => handleAddSubject(item)}
                                                    className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all"
                                                >
                                                    <Check className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}

                                        {/* Subjects List Rows */}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {(item.subjects || []).length === 0 ? (
                                                <p className="text-xs text-slate-400 italic">No subjects added.</p>
                                            ) : (
                                                item.subjects.map((sub, idx) => (
                                                    <div key={sub.name} className="flex items-center justify-between bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-800">
                                                        <div className="flex items-center gap-2.5">
                                                            <span className="text-xs font-bold text-slate-400 w-5">{sub.displayno || (idx + 1)}.</span>
                                                            <span>{capitalizeWords(sub.name)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                onClick={() => setEditingSubject({
                                                                    standardItem: item,
                                                                    oldName: sub.name,
                                                                    name: sub.name,
                                                                    displayno: sub.displayno || (idx + 1)
                                                                })}
                                                                className="text-slate-400 hover:text-slate-900 transition-colors p-1"
                                                                title="Edit Subject Name & Display Order"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteSubject(item, sub.name)}
                                                                className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                                                                title="Delete Subject"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                    </div>

                                </div>

                            </div>
                        ))}
                    </div>
                )}

            </div>

            {/* ── MODAL: ADD NEW CLASS / STANDARD ── */}
            {showAddStandardModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Add New Class / Standard</h3>
                            <button onClick={() => setShowAddStandardModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAddStandard} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Class Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Grade 10, Class 9, UKG"
                                    value={newStandardName}
                                    onChange={e => setNewStandardName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Display Order Number
                                </label>
                                <input
                                    type="number"
                                    value={newStandardDisplayNo}
                                    onChange={e => setNewStandardDisplayNo(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">Order in dropdown list (e.g. 1, 2, 10).</p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Sections <span className="text-slate-400 font-normal">(Optional, comma-separated)</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. A, B, C (or leave blank for single batch)"
                                    value={newStandardSections}
                                    onChange={e => setNewStandardSections(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Subjects List <span className="text-slate-400 font-normal">(Comma-separated)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="e.g. Tamil, English, Mathematics, Science, Social Science"
                                    value={newStandardSubjects}
                                    onChange={e => setNewStandardSubjects(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddStandardModal(false)}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#F54927] hover:bg-[#e03d1d] shadow-md shadow-orange-500/20 disabled:opacity-50"
                                >
                                    {isSaving ? "Saving..." : "Create Class"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: EDIT CLASS / STANDARD ── */}
            {editingStandard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-100 p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-slate-900">Edit Class Details</h3>
                            <button onClick={() => setEditingStandard(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditStandard} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Class Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editStandardName}
                                    onChange={e => setEditStandardName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Display Order Number
                                </label>
                                <input
                                    type="number"
                                    value={editStandardDisplayNo}
                                    onChange={e => setEditStandardDisplayNo(Number(e.target.value))}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F54927]"
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setEditingStandard(null)}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-[#F54927] hover:bg-[#e03d1d] shadow-md shadow-orange-500/20 disabled:opacity-50"
                                >
                                    {isSaving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: EDIT SECTION ── */}
            {editingSection && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Edit Section</h3>
                            <button onClick={() => setEditingSection(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditSection} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Section Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingSection.name}
                                    onChange={e => setEditingSection({ ...editingSection, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={editingSection.displayno}
                                    onChange={e => setEditingSection({ ...editingSection, displayno: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingSection(null)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-500/20"
                                >
                                    Update Section
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── MODAL: EDIT SUBJECT ── */}
            {editingSubject && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-bold text-slate-900">Edit Subject</h3>
                            <button onClick={() => setEditingSubject(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditSubject} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Subject Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editingSubject.name}
                                    onChange={e => setEditingSubject({ ...editingSubject, name: e.target.value })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                                    Display Order
                                </label>
                                <input
                                    type="number"
                                    value={editingSubject.displayno}
                                    onChange={e => setEditingSubject({ ...editingSubject, displayno: Number(e.target.value) })}
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditingSubject(null)}
                                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-500/20"
                                >
                                    Update Subject
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
