export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-gray-500 sm:flex-row">
        <p>&copy; {new Date().getFullYear()} EigenX. All rights reserved.</p>
        <div className="flex gap-4">
          <a href="/login" className="hover:text-gray-700">
            Log in
          </a>
          <a href="/register" className="hover:text-gray-700">
            Sign up
          </a>
        </div>
      </div>
    </footer>
  );
}