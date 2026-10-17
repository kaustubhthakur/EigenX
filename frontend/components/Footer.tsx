export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-white/10 bg-[#070815]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-4 py-6 text-sm text-slate-400 sm:px-6">
        <p>&copy; {new Date().getFullYear()} EigenX. All rights reserved.</p>
        <p className="text-xs text-slate-500">
          Built by{" "}
          <span className="font-medium text-slate-300">Kaustubh Thakur</span>
        </p>
      </div>
    </footer>
  );
}