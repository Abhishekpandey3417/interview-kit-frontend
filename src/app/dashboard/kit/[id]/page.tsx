"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import api from "@/utils/api";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "questions" | "flashcards" | "schedule";

type RequirementPriority = "must" | "nice";
type QuestionCategory = "technical" | "behavioural" | "system-design" | "company-fit";

interface Requirement {
    id: string;
    text: string;
    kind: string;
    priority: RequirementPriority;
}

interface Question {
    id: string;
    requirement_ids: string[];
    category: QuestionCategory;
    prompt: string;
    answer_outline: string;
    difficulty: 1 | 2 | 3;
}

interface Flashcard {
    id: string;
    front: string;
    back: string;
    requirement_ids: string[];
}

interface ScheduleDay {
    day: number;
    focus: string;
    question_ids: string[];
    minutes: number;
}

interface Kit {
    _id: string;
    status: "draft" | "generating" | "complete" | "failed";
    jd: string;
    daysRequested: number;
    progress?: { step: string; percentage: number; message: string };
    kit?: {
        source: { company: string; company_url: string; role: string; location: string; jd_chars: number; researched_at: string; pages_used: string[] };
        company_brief: { summary: string; what_they_do: string; sources: string[] };
        interview_research: { found: boolean; summary: string; process: string[]; discussion_points: string[]; sources: { url: string; title: string; type: string }[] };
        role: { title: string; seniority: string; responsibilities: string[]; requirements: Requirement[] };
        questions: Question[];
        flashcards: Flashcard[];
        schedule: { days_available: number; days: ScheduleDay[] };
        coverage: { uncovered_requirement_ids: string[]; passes: number };
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const difficultyMeta = (d: number) => {
    if (d === 1) return { label: "Easy", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" };
    if (d === 2) return { label: "Medium", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" };
    return { label: "Hard", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" };
};

const categoryMeta: Record<string, string> = {
    technical: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    behavioural: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    "system-design": "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    "company-fit": "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
};

const nanoid = () => Math.random().toString(36).slice(2, 10);

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ label, cls }: { label: string; cls: string }) {
    return <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold tracking-wide ${cls}`}>{label}</span>;
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
            {children}
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-14 border-2 border-dashed border-gray-200 dark:border-gray-700 text-center">
            <p className="text-gray-400 dark:text-gray-500">{message}</p>
        </div>
    );
}

// Editable field header card
function EditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const commit = () => { onSave(draft.trim() || value); setEditing(false); };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1 font-medium">{label}</p>
            {editing ? (
                <div className="flex gap-2 items-center mt-1">
                    <input autoFocus className="flex-1 bg-gray-50 dark:bg-gray-700 border border-indigo-400 rounded-lg px-2 py-1 text-sm font-semibold text-gray-900 dark:text-white outline-none" value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
                    <button onClick={commit} className="text-indigo-600 text-xs font-semibold hover:underline">Save</button>
                    <button onClick={() => setEditing(false)} className="text-gray-400 text-xs hover:underline">Cancel</button>
                </div>
            ) : (
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => { setDraft(value); setEditing(true); }} title="Click to edit">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{value || "—"}</p>
                    <svg className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition ml-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                    </svg>
                </div>
            )}
        </div>
    );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({ kit }: { kit: Kit }) {
    const data = kit.kit;
    const [showJD, setShowJD] = useState(false);

    if (!data) {
        return <EmptyState message="Generate your kit to see the overview." />;
    }

    return (
        <div className="space-y-5">
            {/* JD Card */}
            {kit.jd && (
                <SectionCard title="Job Description">
                    <button onClick={() => setShowJD(v => !v)} className="text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline mb-3 block">
                        {showJD ? "▲ Hide JD" : "▼ Show full JD"}
                    </button>
                    {showJD && (
                        <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 dark:bg-gray-900 rounded-xl p-4 max-h-80 overflow-y-auto border border-gray-100 dark:border-gray-700">
                            {kit.jd}
                        </pre>
                    )}
                    <div className="flex gap-4 text-xs text-gray-400 mt-2">
                        <span>{kit.jd.length.toLocaleString()} characters</span>
                        {data.source?.location && <span>📍 {data.source.location}</span>}
                    </div>
                </SectionCard>
            )}

            {/* Company Brief */}
            {(data.company_brief?.summary || data.company_brief?.what_they_do) && (
                <SectionCard title="Company Brief">
                    {data.company_brief.summary && <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">{data.company_brief.summary}</p>}
                    {data.company_brief.what_they_do && (
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            <span className="font-semibold text-gray-800 dark:text-gray-200">What they do: </span>
                            {data.company_brief.what_they_do}
                        </p>
                    )}
                    {data.source?.researched_at && (
                        <p className="text-xs text-gray-400 mt-3">Researched: {new Date(data.source.researched_at).toLocaleDateString()}</p>
                    )}
                </SectionCard>
            )}

            {/* Interview Research */}
            {data.interview_research?.found && (
                <SectionCard title="Interview Research">
                    {data.interview_research.summary && (
                        <p className="text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">{data.interview_research.summary}</p>
                    )}
                    {data.interview_research.process?.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Interview Process</h4>
                            <ol className="space-y-1.5 list-decimal list-inside">
                                {data.interview_research.process.map((step, i) => (
                                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400">{step}</li>
                                ))}
                            </ol>
                        </div>
                    )}
                    {data.interview_research.discussion_points?.length > 0 && (
                        <div className="mb-4">
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Key Discussion Points</h4>
                            <ul className="space-y-1.5">
                                {data.interview_research.discussion_points.map((point, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="text-indigo-500 flex-shrink-0">•</span>{point}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {data.interview_research.sources?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Sources</h4>
                            <ul className="space-y-1">
                                {data.interview_research.sources.map((s, i) => (
                                    <li key={i}>
                                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline truncate block">
                                            {s.title || s.url}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </SectionCard>
            )}

            {/* Role Info */}
            {(data.role?.responsibilities?.length > 0 || data.role?.requirements?.length > 0) && (
                <>
                    {data.role.responsibilities?.length > 0 && (
                        <SectionCard title="Key Responsibilities">
                            <ul className="space-y-2">
                                {data.role.responsibilities.map((r, i) => (
                                    <li key={i} className="flex gap-2 text-sm text-gray-600 dark:text-gray-400">
                                        <span className="text-indigo-500 mt-0.5 flex-shrink-0">•</span><span>{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </SectionCard>
                    )}
                    {data.role.requirements?.length > 0 && (
                        <SectionCard title="Requirements">
                            <div className="flex flex-wrap gap-2">
                                {data.role.requirements.map(req => (
                                    <span key={req.id} className={`px-3 py-1 rounded-full text-xs font-semibold ${req.priority === "must" ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                                        {req.text} <span className="opacity-60">({req.priority})</span>
                                    </span>
                                ))}
                            </div>
                            <div className="mt-3 flex gap-4 text-xs text-gray-400">
                                <span>{data.role.requirements.filter(r => r.priority === "must").length} must-have</span>
                                <span>{data.role.requirements.filter(r => r.priority === "nice").length} nice-to-have</span>
                            </div>
                        </SectionCard>
                    )}
                </>
            )}

            {/* Coverage */}
            {data.coverage && data.coverage.passes > 0 && (
                <SectionCard title="Coverage">
                    <div className="flex gap-6 text-sm">
                        <div>
                            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{data.coverage.passes}</p>
                            <p className="text-gray-500 text-xs mt-0.5">AI passes</p>
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{data.coverage.uncovered_requirement_ids.length}</p>
                            <p className="text-gray-500 text-xs mt-0.5">Uncovered requirements</p>
                        </div>
                    </div>
                </SectionCard>
            )}

            {!data.company_brief?.summary && !data.role?.responsibilities?.length && (
                <EmptyState message="Details will appear once generation is complete." />
            )}
        </div>
    );
}

// ─── Questions Tab ────────────────────────────────────────────────────────────

interface EditingQ {
    prompt: string;
    answer_outline: string;
    category: QuestionCategory;
    difficulty: 1 | 2 | 3;
}

function QuestionsTab({ kit, onKitUpdate }: { kit: Kit; onKitUpdate: (k: Kit) => void }) {
    const questions: Question[] = kit.kit?.questions ?? [];
    const [filterCat, setFilterCat] = useState<string>("all");
    const [filterDiff, setFilterDiff] = useState<number>(0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState<EditingQ>({ prompt: "", answer_outline: "", category: "technical", difficulty: 1 });
    const [showAdd, setShowAdd] = useState(false);
    const [newQ, setNewQ] = useState<EditingQ>({ prompt: "", answer_outline: "", category: "technical", difficulty: 1 });
    const [generating, setGenerating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const patchQuestions = async (updated: Question[]) => {
        setSaving(true);
        try {
            await api.patch(`/kits/${kit._id}`, { questions: updated });
            onKitUpdate({ ...kit, kit: kit.kit ? { ...kit.kit, questions: updated } : kit.kit });
        } catch {
            setError("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const startEdit = (q: Question) => {
        setEditingId(q.id);
        setEditDraft({ prompt: q.prompt, answer_outline: q.answer_outline, category: q.category, difficulty: q.difficulty });
    };

    const saveEdit = async () => {
        if (!editingId) return;
        const updated = questions.map(q => q.id === editingId ? { ...q, ...editDraft } : q);
        await patchQuestions(updated);
        setEditingId(null);
    };

    const deleteQ = async (id: string) => {
        if (!confirm("Delete this question?")) return;
        await patchQuestions(questions.filter(q => q.id !== id));
    };

    const addQuestion = async () => {
        if (!newQ.prompt.trim()) { setError("Prompt is required."); return; }
        const q: Question = { id: `q_${nanoid()}`, requirement_ids: [], ...newQ };
        await patchQuestions([...questions, q]);
        setNewQ({ prompt: "", answer_outline: "", category: "technical", difficulty: 1 });
        setShowAdd(false);
    };

    const generate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const { data } = await api.post(`/kits/${kit._id}/questions/generate`);
            if (data.success) {
                onKitUpdate({ ...kit, kit: kit.kit ? { ...kit.kit, questions: data.questions } : kit.kit });
            }
        } catch (e: any) {
            setError(e?.response?.data?.error?.message ?? "Failed to generate questions.");
        } finally {
            setGenerating(false);
        }
    };

    const filtered = questions.filter(q =>
        (filterCat === "all" || q.category === filterCat) &&
        (filterDiff === 0 || q.difficulty === filterDiff)
    );

    const categories: QuestionCategory[] = ["technical", "behavioural", "system-design", "company-fit"];

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                    {["all", ...categories].map(c => (
                        <button key={c} onClick={() => setFilterCat(c)}
                            className={`text-xs px-3 py-1.5 rounded-full font-medium transition ${filterCat === c ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"}`}>
                            {c === "all" ? "All" : c}
                        </button>
                    ))}
                    <select value={filterDiff} onChange={e => setFilterDiff(Number(e.target.value))}
                        className="text-xs px-3 py-1.5 rounded-full font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-0 outline-none">
                        <option value={0}>All Difficulty</option>
                        <option value={1}>Easy</option>
                        <option value={2}>Medium</option>
                        <option value={3}>Hard</option>
                    </select>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setShowAdd(v => !v)}
                        className="flex items-center gap-1.5 text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition">
                        ➕ Add
                    </button>
                    <button onClick={generate} disabled={generating || saving}
                        className="flex items-center gap-1.5 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
                        {generating ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> Generating…</> : "🔄 Generate"}
                    </button>
                </div>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{error}</div>}
            {saving && <div className="text-sm text-indigo-600 dark:text-indigo-400 animate-pulse">Saving…</div>}

            {/* Add Question Form */}
            {showAdd && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border-2 border-indigo-300 dark:border-indigo-700 shadow space-y-3">
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm">New Question</h4>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Prompt *</label>
                            <textarea rows={2} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" value={newQ.prompt} onChange={e => setNewQ(v => ({ ...v, prompt: e.target.value }))} placeholder="What is…" />
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs text-gray-500 font-medium block mb-1">Answer Outline</label>
                            <textarea rows={3} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" value={newQ.answer_outline} onChange={e => setNewQ(v => ({ ...v, answer_outline: e.target.value }))} placeholder="Key points to cover…" />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">Category</label>
                            <select className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none" value={newQ.category} onChange={e => setNewQ(v => ({ ...v, category: e.target.value as QuestionCategory }))}>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-medium block mb-1">Difficulty</label>
                            <select className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none" value={newQ.difficulty} onChange={e => setNewQ(v => ({ ...v, difficulty: Number(e.target.value) as 1 | 2 | 3 }))}>
                                <option value={1}>Easy</option>
                                <option value={2}>Medium</option>
                                <option value={3}>Hard</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={addQuestion} className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition">Save Question</button>
                        <button onClick={() => setShowAdd(false)} className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-lg font-medium transition">Cancel</button>
                    </div>
                </div>
            )}

            {filtered.length === 0 ? (
                <EmptyState message={questions.length === 0 ? "No questions yet. Click 'Generate' or 'Add' to create some." : "No questions match the current filters."} />
            ) : (
                filtered.map((q, i) => {
                    const diff = difficultyMeta(q.difficulty);
                    const cat = categoryMeta[q.category] ?? "bg-gray-100 text-gray-700";
                    const isEditing = editingId === q.id;
                    return (
                        <div key={q.id} className={`bg-white dark:bg-gray-800 rounded-2xl p-5 border shadow-sm transition ${isEditing ? "border-indigo-400 dark:border-indigo-500" : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"}`}>
                            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Q{i + 1}</span>
                                <div className="flex gap-2 items-center">
                                    <Badge label={q.category} cls={cat} />
                                    <Badge label={diff.label} cls={diff.cls} />
                                    {!isEditing && (
                                        <>
                                            <button onClick={() => startEdit(q)} title="Edit" className="ml-1 text-gray-400 hover:text-indigo-600 transition">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" /></svg>
                                            </button>
                                            <button onClick={() => deleteQ(q.id)} title="Delete" className="text-gray-400 hover:text-red-600 transition">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {isEditing ? (
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium block mb-1">Prompt</label>
                                        <textarea rows={2} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" value={editDraft.prompt} onChange={e => setEditDraft(v => ({ ...v, prompt: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 font-medium block mb-1">Answer Outline</label>
                                        <textarea rows={4} className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-none" value={editDraft.answer_outline} onChange={e => setEditDraft(v => ({ ...v, answer_outline: e.target.value }))} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs text-gray-500 font-medium block mb-1">Category</label>
                                            <select className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none" value={editDraft.category} onChange={e => setEditDraft(v => ({ ...v, category: e.target.value as QuestionCategory }))}>
                                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 font-medium block mb-1">Difficulty</label>
                                            <select className="w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none" value={editDraft.difficulty} onChange={e => setEditDraft(v => ({ ...v, difficulty: Number(e.target.value) as 1 | 2 | 3 }))}>
                                                <option value={1}>Easy</option>
                                                <option value={2}>Medium</option>
                                                <option value={3}>Hard</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={saveEdit} disabled={saving} className="text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition">Save</button>
                                        <button onClick={() => setEditingId(null)} className="text-sm px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-medium transition">Cancel</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <p className="font-medium text-gray-900 dark:text-white mb-3 leading-relaxed">{q.prompt}</p>
                                    <details className="text-sm text-gray-600 dark:text-gray-400">
                                        <summary className="cursor-pointer text-indigo-600 dark:text-indigo-400 font-medium hover:underline select-none">Show Answer Outline</summary>
                                        <p className="mt-2 leading-relaxed whitespace-pre-line bg-gray-50 dark:bg-gray-900 rounded-lg p-3 border border-gray-100 dark:border-gray-700">{q.answer_outline}</p>
                                    </details>
                                </>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

// ─── Flashcards Tab ───────────────────────────────────────────────────────────

function FlipCard({ fc, index }: { fc: Flashcard; index: number }) {
    const [flipped, setFlipped] = useState(false);
    return (
        <div
            className="cursor-pointer"
            style={{ perspective: "1000px", height: "200px" }}
            onClick={() => setFlipped(v => !v)}
            title="Click to flip"
        >
            <div style={{
                transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
                transformStyle: "preserve-3d",
                transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                position: "relative",
                width: "100%",
                height: "100%",
            }}>
                {/* Front */}
                <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0 }}
                    className="bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-900/30 dark:to-gray-800 rounded-2xl border border-indigo-200 dark:border-indigo-700 shadow-sm flex flex-col justify-between p-5">
                    <div>
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Card {index + 1}</span>
                        <p className="mt-2 font-semibold text-gray-900 dark:text-white leading-snug line-clamp-4">{fc.front}</p>
                    </div>
                    <p className="text-xs text-indigo-400 text-right select-none">Tap to reveal →</p>
                </div>
                {/* Back */}
                <div style={{ backfaceVisibility: "hidden", position: "absolute", inset: 0, transform: "rotateY(180deg)" }}
                    className="bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-900/30 dark:to-gray-800 rounded-2xl border border-emerald-200 dark:border-emerald-700 shadow-sm flex flex-col justify-between p-5">
                    <div>
                        <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Answer</span>
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 leading-relaxed line-clamp-6">{fc.back}</p>
                    </div>
                    {fc.requirement_ids.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {fc.requirement_ids.map(rid => (
                                <span key={rid} className="text-xs bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded font-mono">{rid.slice(0, 8)}</span>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function FlashcardsTab({ kit, onKitUpdate }: { kit: Kit; onKitUpdate: (k: Kit) => void }) {
    const flashcards: Flashcard[] = kit.kit?.flashcards ?? [];
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [current, setCurrent] = useState(0);
    const [viewMode, setViewMode] = useState<"grid" | "single">("grid");

    const generate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const { data } = await api.post(`/kits/${kit._id}/flashcards/generate`);
            if (data.success) {
                onKitUpdate({ ...kit, kit: kit.kit ? { ...kit.kit, flashcards: data.flashcards } : kit.kit });
                setCurrent(0);
            }
        } catch (e: any) {
            setError(e?.response?.data?.error?.message ?? "Failed to generate flashcards.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <button onClick={() => setViewMode("grid")} className={`px-3 py-1 rounded-md text-sm font-medium transition ${viewMode === "grid" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow" : "text-gray-500"}`}>Grid</button>
                    <button onClick={() => setViewMode("single")} className={`px-3 py-1 rounded-md text-sm font-medium transition ${viewMode === "single" ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow" : "text-gray-500"}`}>Study</button>
                </div>
                <div className="flex items-center gap-2">
                    {flashcards.length > 0 && <span className="text-xs text-gray-400">{flashcards.length} cards</span>}
                    <button onClick={generate} disabled={generating}
                        className="flex items-center gap-1.5 text-sm px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg font-medium transition">
                        {generating ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"></span> Generating…</> : "🔄 Generate"}
                    </button>
                </div>
            </div>

            {error && <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-4 py-2">{error}</div>}

            {flashcards.length === 0 ? (
                <EmptyState message="No flashcards yet. Click 'Generate' to create them from your requirements." />
            ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {flashcards.map((fc, i) => <FlipCard key={fc.id} fc={fc} index={i} />)}
                </div>
            ) : (
                /* Single study mode */
                <div className="flex flex-col items-center gap-4">
                    <div className="w-full max-w-xl">
                        <FlipCard key={flashcards[current]?.id} fc={flashcards[current]} index={current} />
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setCurrent(v => Math.max(0, v - 1))} disabled={current === 0}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-30 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition">
                            ← Prev
                        </button>
                        <span className="text-sm text-gray-500">{current + 1} / {flashcards.length}</span>
                        <button onClick={() => setCurrent(v => Math.min(flashcards.length - 1, v + 1))} disabled={current === flashcards.length - 1}
                            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 disabled:opacity-30 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium transition">
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ kit }: { kit: Kit }) {
    const schedule = kit.kit?.schedule;
    const questions: Question[] = kit.kit?.questions ?? [];
    const questionMap = new Map(questions.map(q => [q.id, q]));

    if (!schedule || schedule.days?.length === 0) {
        return <EmptyState message="No schedule generated yet. Generate your full kit first." />;
    }

    const totalMinutes = schedule.days.reduce((sum, d) => sum + d.minutes, 0);
    const activeDays = schedule.days.filter(d => d.question_ids.length > 0).length;

    return (
        <div className="space-y-5">
            {/* Stats row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Days Available", value: schedule.days_available },
                    { label: "Active Days", value: activeDays },
                    { label: "Total Questions", value: questions.length },
                    { label: "Total Study Time", value: `${totalMinutes} min` },
                ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm text-center">
                        <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{s.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Day timeline */}
            <div className="space-y-3">
                {schedule.days.map(day => {
                    const isEmpty = day.question_ids.length === 0;
                    const resolvedQuestions = day.question_ids.map(qid => questionMap.get(qid)).filter(Boolean) as Question[];
                    return (
                        <div key={day.day} className={`bg-white dark:bg-gray-800 rounded-2xl border shadow-sm overflow-hidden ${isEmpty ? "opacity-60 border-gray-100 dark:border-gray-800" : "border-gray-200 dark:border-gray-700"}`}>
                            <div className="flex items-center gap-4 p-4">
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${isEmpty ? "bg-gray-100 dark:bg-gray-700 text-gray-400" : "bg-indigo-600 text-white"}`}>
                                    {day.day}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <p className={`font-semibold text-sm ${isEmpty ? "text-gray-400" : "text-gray-900 dark:text-white"}`}>{day.focus}</p>
                                        <div className="flex gap-2 flex-shrink-0">
                                            {!isEmpty && (
                                                <span className="text-xs bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-medium">
                                                    {day.minutes} min
                                                </span>
                                            )}
                                            <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">
                                                {day.question_ids.length} Q
                                            </span>
                                        </div>
                                    </div>
                                    {resolvedQuestions.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {resolvedQuestions.map(q => {
                                                const diff = difficultyMeta(q.difficulty);
                                                return (
                                                    <div key={q.id} className="flex items-start gap-2">
                                                        <Badge label={diff.label} cls={diff.cls} />
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{q.prompt}</p>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface LocalMeta {
    role?: string;
    company?: string;
    seniority?: string;
    days?: string;
}

export default function KitDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [kit, setKit] = useState<Kit | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>("overview");
    const [meta, setMeta] = useState<LocalMeta>({});
    const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const storageKey = `kit_meta_${id}`;

    const fetchKit = useCallback(async () => {
        try {
            const { data } = await api.get(`/kits/${id}`);
            if (data.success) setKit(data.kit);
            else setError("Kit not found");
        } catch {
            setError("Failed to load kit");
        } finally {
            setLoading(false);
        }
    }, [id]);

    // Poll while kit is generating
    useEffect(() => {
        if (!id) return;
        fetchKit();
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) setMeta(JSON.parse(saved));
        } catch { /* ignore */ }
    }, [id, fetchKit, storageKey]);

    useEffect(() => {
        if (kit?.status === "generating") {
            pollRef.current = setTimeout(() => fetchKit(), 3000);
        }
        return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    }, [kit?.status, fetchKit]);

    const saveMeta = (updates: Partial<LocalMeta>) => {
        const next = { ...meta, ...updates };
        setMeta(next);
        localStorage.setItem(storageKey, JSON.stringify(next));
    };

    const getField = (localKey: keyof LocalMeta, kitValue: string | undefined) =>
        meta[localKey] || kitValue || "";

    const tabs: { key: Tab; label: string }[] = [
        { key: "overview", label: "Overview" },
        { key: "questions", label: `Questions${(kit?.kit?.questions?.length ?? 0) > 0 ? ` (${kit!.kit!.questions.length})` : ""}` },
        { key: "flashcards", label: `Flashcards${(kit?.kit?.flashcards?.length ?? 0) > 0 ? ` (${kit!.kit!.flashcards.length})` : ""}` },
        { key: "schedule", label: "Schedule" },
    ];

    return (
        <RequireAuth>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                {/* Header */}
                <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-8 py-4 flex items-center gap-4 shadow-sm sticky top-0 z-10">
                    <button onClick={() => router.push("/dashboard")} className="flex items-center text-gray-500 hover:text-indigo-600 transition text-sm">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        Dashboard
                    </button>
                    <span className="text-gray-300">|</span>
                    <h1 className="text-base font-semibold text-gray-800 dark:text-white truncate flex-1">
                        {getField("role", kit?.kit?.role?.title || kit?.kit?.source?.role) || "Interview Kit"}
                    </h1>
                    {kit?.status && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${kit.status === "complete" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : kit.status === "generating" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" : kit.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300"}`}>
                            {kit.status.toUpperCase()}
                        </span>
                    )}
                </header>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-32">
                        <svg className="animate-spin h-10 w-10 text-indigo-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}

                {/* Error */}
                {error && !loading && (
                    <div className="max-w-2xl mx-auto mt-16 text-center">
                        <p className="text-red-500 text-lg">{error}</p>
                        <button onClick={() => router.push("/dashboard")} className="mt-4 text-indigo-600 hover:underline">Back to Dashboard</button>
                    </div>
                )}

                {/* Content */}
                {!loading && !error && kit && (
                    <div className="max-w-5xl mx-auto p-4 md:p-8">
                        {/* Status banner */}
                        {kit.status !== "complete" && (
                            <div className={`rounded-2xl p-5 mb-6 flex items-center gap-4 justify-between ${kit.status === "generating" ? "bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800" : kit.status === "failed" ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" : "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"}`}>
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    {kit.status === "generating" && (
                                        <svg className="animate-spin h-6 w-6 text-amber-600 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                        </svg>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-semibold text-gray-800 dark:text-gray-100 text-sm">
                                            {kit.status === "generating" ? "Generating your kit…" : kit.status === "failed" ? "Generation Failed" : "Kit is in Draft"}
                                        </p>
                                        {kit.progress?.message && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{kit.progress.message}</p>}
                                        {kit.status === "generating" && kit.progress != null && (kit.progress.percentage ?? 0) > 0 && (
                                            <div className="mt-2 h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full w-48">
                                                <div className="h-1.5 bg-amber-500 rounded-full transition-all" style={{ width: `${kit.progress!.percentage}%` }} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {kit.status === "draft" && (
                                    <button
                                        id="generate-btn"
                                        onClick={async () => {
                                            const btn = document.getElementById("generate-btn") as HTMLButtonElement | null;
                                            if (btn) { btn.disabled = true; btn.textContent = "Generating…"; }
                                            try {
                                                await api.post("/kits/batch", [{
                                                    id: kit._id,
                                                    jd: kit.jd,
                                                    company_url: kit.kit?.source?.company_url || "https://example.com",
                                                    days: parseInt(getField("days", String(kit.daysRequested)) || "30", 10),
                                                    role: getField("role", kit.kit?.role?.title || kit.kit?.source?.role),
                                                    company: getField("company", kit.kit?.source?.company),
                                                    seniority: getField("seniority", kit.kit?.role?.seniority),
                                                }]);
                                                await fetchKit();
                                            } catch {
                                                alert("Failed to start generation");
                                                if (btn) { btn.disabled = false; btn.textContent = "Generate Kit"; }
                                            }
                                        }}
                                        className="flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-sm transition"
                                    >
                                        Generate Kit
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Meta fields */}
                        <p className="text-xs text-gray-400 mb-3 italic">Click any field to edit it locally.</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <EditableField label="Role" value={getField("role", kit.kit?.role?.title || kit.kit?.source?.role)} onSave={v => saveMeta({ role: v })} />
                            <EditableField label="Company" value={getField("company", kit.kit?.source?.company)} onSave={v => saveMeta({ company: v })} />
                            <EditableField label="Seniority" value={getField("seniority", kit.kit?.role?.seniority)} onSave={v => saveMeta({ seniority: v })} />
                            <EditableField label="Days to Prepare" value={getField("days", String(kit.daysRequested))} onSave={v => saveMeta({ days: v })} />
                        </div>

                        {kit.kit?.source?.company_url && (
                            <p className="text-sm text-gray-500 mb-5">
                                Company URL:{" "}
                                <a href={kit.kit.source.company_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                                    {kit.kit.source.company_url}
                                </a>
                            </p>
                        )}

                        {/* Tabs */}
                        <div className="flex gap-1 mb-6 bg-white dark:bg-gray-800 rounded-xl p-1 border border-gray-200 dark:border-gray-700 shadow-sm w-fit">
                            {tabs.map(({ key, label }) => (
                                <button key={key} onClick={() => setActiveTab(key)}
                                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === key ? "bg-indigo-600 text-white shadow" : "text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"}`}>
                                    {label}
                                </button>
                            ))}
                        </div>

                        {/* Tab content */}
                        {activeTab === "overview" && <OverviewTab kit={kit} />}
                        {activeTab === "questions" && <QuestionsTab kit={kit} onKitUpdate={setKit} />}
                        {activeTab === "flashcards" && <FlashcardsTab kit={kit} onKitUpdate={setKit} />}
                        {activeTab === "schedule" && <ScheduleTab kit={kit} />}
                    </div>
                )}
            </div>
        </RequireAuth>
    );
}