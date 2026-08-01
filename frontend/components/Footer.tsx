export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-gray-500 sm:flex-row sm:px-6">
        <p>&copy; {new Date().getFullYear()} EigenX. All rights reserved.</p>
      
      </div>
    </footer>
  );
}