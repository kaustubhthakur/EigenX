export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-slate-200 bg-white transition-colors duration-300 dark:border-white/10 dark:bg-[#070815]">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-1 px-4 py-6 text-sm text-slate-600 sm:px-6 dark:text-slate-400">
        <p>&copy; {new Date().getFullYear()} EigenX. All rights reserved.</p>
        <p className="text-xs text-slate-500">
          Built by{" "}
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Kaustubh Thakur
          </span>
        </p>
      </div>
    </footer>
  );
}