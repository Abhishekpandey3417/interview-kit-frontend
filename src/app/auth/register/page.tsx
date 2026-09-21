"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../../contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
    const { register, user, loading } = useAuth();
    const router = useRouter();

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!loading && user) {
            router.replace("/dashboard");
        }
    }, [user, loading, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            await register(name, email, password);
            router.push("/dashboard");
        } catch (err: any) {
            setError(
                err.response?.data?.error?.message ??
                "Registration failed"
            );
        }
    };

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-indigo-100 to-indigo-200 dark:from-gray-800 dark:to-gray-900 p-4">
            <div className="w-full max-w-md bg-white/30 dark:bg-gray-800/30 backdrop-blur-lg rounded-xl shadow-lg p-8 animate-fade-in">
                <h1 className="text-3xl font-bold text-center mb-6">Interview Kit</h1>
                <h2 className="text-xl text-center mb-4">Register</h2>
                {error && <p className="text-red-600 mb-3 text-center">{error}</p>}
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <div>
                        <label className="block text-sm font-medium mb-1">Name</label>
                        <input
                            className="w-full p-2 border rounded bg-white/70 dark:bg-gray-700/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Email</label>
                        <input
                            className="w-full p-2 border rounded bg-white/70 dark:bg-gray-700/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Password</label>
                        <input
                            className="w-full p-2 border rounded bg-white/70 dark:bg-gray-700/70 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button
                        className={`w-full py-2 rounded text-white transition ${submitting ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"}`}
                        type="submit"
                        disabled={submitting}
                    >
                        {submitting ? "Registering..." : "Register"}
                    </button>
                </form>
                <p className="mt-4 text-center text-sm">
                    Already have an account? <Link href="/auth/login" className="text-indigo-600 hover:underline">Log In</Link>
                </p>
            </div>
        </main>
    );
}