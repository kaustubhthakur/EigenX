export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-1 px-4 py-6 text-sm text-gray-500 sm:px-6">
        <p>&copy; {new Date().getFullYear()} EigenX. All rights reserved.</p>
        <p className="text-xs text-gray-400">
          Built by <span className="font-medium text-gray-600">Kaustubh Thakur</span>
        </p>
      </div>
    </footer>
  );
}