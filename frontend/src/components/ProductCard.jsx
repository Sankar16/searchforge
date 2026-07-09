export default function ProductCard({ product, isNew }) {
  return (
    <div
      className={`bg-white rounded-lg border p-4 shadow-sm relative ${
        isNew ? "border-blue-400" : "border-gray-200"
      }`}
    >
      {isNew && (
        <span className="absolute top-2 right-2 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
          New match
        </span>
      )}
      <div className="font-semibold text-gray-900 text-sm leading-snug pr-16">
        {product.name}
      </div>
      <div className="text-xs text-gray-500 mt-0.5 mb-2">
        {product.sku} · {product.category}
      </div>
      <p className="text-xs text-gray-600 line-clamp-2">{product.description}</p>
      <div className="flex items-center justify-between mt-3">
        {product.price != null ? (
          <span className="text-sm font-medium text-gray-800">
            ${product.price}
          </span>
        ) : (
          <span />
        )}
        <span className="text-xs text-gray-400">score {product.score}</span>
      </div>
    </div>
  );
}
