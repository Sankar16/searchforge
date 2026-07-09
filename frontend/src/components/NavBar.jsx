export default function NavBar({ page, setPage }) {
  const links = [
    { id: "catalog", label: "Catalog Health" },
    { id: "search", label: "Search Comparison" },
    { id: "crosssell", label: "Cross-Sell" },
  ];

  return (
    <nav className="bg-navy-800 text-white shadow-lg" style={{ backgroundColor: "#1B2A4A" }}>
      <div className="max-w-7xl mx-auto px-6 flex items-center h-14">
        <span className="font-bold text-lg tracking-wide mr-10 text-white">
          ⚙ SearchForge
        </span>
        <div className="flex gap-1">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => setPage(link.id)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                page === link.id
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
}
