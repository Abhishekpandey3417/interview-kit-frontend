"use client";

import RequireAuth from "../../components/RequireAuth";
import { useAuth } from "../../contexts/AuthContext";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../../utils/api";

export default function Dashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [kits, setKits] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    const [jd, setJd] = useState("");
    const [companyUrl, setCompanyUrl] = useState("");
    const [roleName, setRoleName] = useState("");
    const [days, setDays] = useState("7");
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [localRoles, setLocalRoles] = useState<Record<string, string>>({});

    useEffect(() => {
        const fetchKits = async () => {
            try {
                const { data } = await api.get("/kits");
                if (data.success) {
                    setKits(data.kits);
                }
            } catch (err) {
                console.error("Failed to fetch kits", err);
            }
        };
        fetchKits();
        // Load locally saved role names from localStorage
        try {
            const saved = localStorage.getItem("kit_roles");
            if (saved) setLocalRoles(JSON.parse(saved));
        } catch {}
    }, []);

    const handleCreateKit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsCreating(true);

        try {
            const { data } = await api.post("/kits", {
                jd,
                company_url: companyUrl,
                days: parseInt(days, 10),
            });

            if (data.success) {
                // Save role name locally keyed by kit ID
                if (roleName.trim()) {
                    const updated = { ...localRoles, [data.kit._id]: roleName.trim() };
                    setLocalRoles(updated);
                    localStorage.setItem("kit_roles", JSON.stringify(updated));
                }
                setKits([...kits, data.kit]);
                setIsModalOpen(false);
                setJd("");
                setCompanyUrl("");
                setRoleName("");
                setDays("7");
            }
        } catch (err: any) {
            const errorObj = err.response?.data?.error;
            if (errorObj?.details && Array.isArray(errorObj.details)) {
                const messages = errorObj.details.map((d: any) => d.message).join(", ");
                setError(messages);
            } else {
                setError(errorObj?.message ?? "Failed to create kit");
            }
        } finally {
            setIsCreating(false);
        }
    };

    const getKitRoleName = (kit: any): string => {
        // Prefer AI-extracted role title, then fall back to locally saved name
        return kit.kit?.role?.title || kit.kit?.source?.role || localRoles[kit._id] || "Draft Kit";
    };

    const handleDeleteKit = async (id: string) => {
        if (!confirm("Are you sure you want to delete this kit?")) return;
        try {
            const { data } = await api.delete(`/kits/${id}`);
            if (data.success) {
                // Also remove local role name
                const updated = { ...localRoles };
                delete updated[id];
                setLocalRoles(updated);
                localStorage.setItem("kit_roles", JSON.stringify(updated));
                setKits(kits.filter(k => k._id !== id));
            }
        } catch (err) {
            console.error("Failed to delete kit", err);
            alert("Failed to delete kit");
        }
    };

    return (
        <RequireAuth>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
                {/* Sidebar */}
                <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hidden md:flex flex-col z-10">
                    <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                        <h2 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">Interview Kit</h2>
                    </div>
                    <nav className="flex-1 p-4 space-y-2">
                        <a href="#" className="flex items-center space-x-3 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                            <span className="font-medium">Dashboard</span>
                        </a>
                    </nav>
                    <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                        <button onClick={logout} className="w-full py-2 px-4 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition flex items-center justify-center space-x-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                            <span>Log Out</span>
                        </button>
                    </div>
                </aside>

                {/* Main Content */}
                <main className="flex-1 flex flex-col h-screen overflow-hidden">
                    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 md:px-8 flex justify-between items-center shadow-sm">
                        <div className="md:hidden">
                            <h2 className="text-xl font-bold text-indigo-600">Interview Kit</h2>
                        </div>
                        <div className="hidden md:block">
                            <h1 className="text-xl font-semibold text-gray-800 dark:text-white">Overview</h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold uppercase">
                                {user?.name?.[0] || 'U'}
                            </div>
                            <span className="hidden md:inline text-sm font-medium text-gray-700 dark:text-gray-300">
                                {user?.name || 'User'}
                            </span>
                        </div>
                    </header>

                    <div className="p-4 md:p-8 flex-1 overflow-y-auto">
                        {/* Welcome Banner */}
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-8 mb-8 text-white shadow-lg relative overflow-hidden">
                            <div className="relative z-10">
                                <h2 className="text-3xl font-bold mb-2">Welcome back, {user?.name || 'User'}! 👋</h2>
                                <p className="text-indigo-100 max-w-xl">
                                    Ready to build your next interview kit? Upload a job description to automatically generate tailored questions and evaluation criteria.
                                </p>
                                <button 
                                    onClick={() => setIsModalOpen(true)}
                                    className="mt-6 bg-white text-indigo-600 px-6 py-2.5 rounded-lg font-semibold shadow hover:bg-gray-50 transition transform hover:-translate-y-0.5"
                                >
                                    + Create New Kit
                                </button>
                            </div>
                            <div className="absolute right-0 top-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                        </div>

                        {/* Stats / Empty State */}
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Recent Kits</h3>
                        {kits.length === 0 ? (
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 p-12 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                </div>
                                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No interview kits yet</h4>
                                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">Get started by creating your first interview kit from a job description.</p>
                                <button 
                                    onClick={() => setIsModalOpen(true)}
                                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                                >
                                    Create Kit
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {kits.map(kit => (
                                    <div key={kit._id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                                {kit.status.toUpperCase()}
                                            </div>
                                            <span className="text-xs text-gray-500">{new Date(kit.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1">
                                            {kit.status === 'generating' 
                                                ? "Generating Kit..." 
                                                : getKitRoleName(kit)}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                                            {kit.status === 'generating'
                                                ? "Processing Job Description..."
                                                : kit.kit?.source?.company || kit.kit?.source?.company_url || "Company Unspecified"}
                                        </p>
                                        <div className="flex justify-between items-center mt-2 border-t border-gray-100 dark:border-gray-700 pt-4">
                                            <button 
                                                onClick={() => handleDeleteKit(kit._id)}
                                                className="text-sm font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition"
                                            >
                                                Delete
                                            </button>
                                            <button 
                                                disabled={kit.status === 'generating'}
                                                onClick={() => router.push(`/dashboard/kit/${kit._id}`)}
                                                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                            >
                                                {kit.status === 'generating' ? 'Processing...' : 'View Kit →'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Create Kit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Create Interview Kit</h3>
                            <button 
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <form onSubmit={handleCreateKit} className="p-6">
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role Applying For</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g. Full Stack Developer, MERN Stack Engineer"
                                        value={roleName}
                                        onChange={e => setRoleName(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company URL</label>
                                    <input 
                                        type="url" 
                                        required
                                        placeholder="https://example.com"
                                        value={companyUrl}
                                        onChange={e => setCompanyUrl(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days to Prepare</label>
                                    <input 
                                        type="number" 
                                        required
                                        min="1"
                                        max="60"
                                        value={days}
                                        onChange={e => setDays(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Description</label>
                                    <textarea 
                                        required
                                        rows={6}
                                        placeholder="Paste the job description here..."
                                        value={jd}
                                        onChange={e => setJd(e.target.value)}
                                        className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    ></textarea>
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end space-x-3">
                                <button 
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-5 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-70 flex items-center"
                                >
                                    {isCreating ? (
                                        <>
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Generating...
                                        </>
                                    ) : (
                                        "Generate Kit"
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </RequireAuth>
    );
}
