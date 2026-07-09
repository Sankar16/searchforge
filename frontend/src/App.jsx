import { useState } from "react";
import NavBar from "./components/NavBar.jsx";
import CatalogHealth from "./pages/CatalogHealth.jsx";
import SearchComparison from "./pages/SearchComparison.jsx";
import CrossSell from "./pages/CrossSell.jsx";

export default function App() {
  const [page, setPage] = useState("catalog");

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar page={page} setPage={setPage} />
      <main>
        {page === "catalog" && <CatalogHealth />}
        {page === "search" && <SearchComparison />}
        {page === "crosssell" && <CrossSell />}
      </main>
    </div>
  );
}
