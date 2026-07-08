import json
from src.schemas import Product
from src.catalog_agent.uom import normalize_catalog_uom
from src.catalog_agent.spec_checker import check_missing_specs
from src.catalog_agent.description_quality import check_description_quality
from src.catalog_agent.description_rewriter import rewrite_weak_descriptions
from src.catalog_agent.report import build_catalog_health_report, print_catalog_health_report


with open("data/catalog_messy.json", "r") as f:
    raw_catalog = json.load(f)

products = [Product(**item) for item in raw_catalog]

# 1. Check messy catalog
messy_spec_issues = check_missing_specs(products)
messy_description_issues = check_description_quality(products)

# 2. Normalize units
normalized_products = normalize_catalog_uom(products)

# 3. Check after UOM normalization
normalized_spec_issues = check_missing_specs(normalized_products)
normalized_description_issues = check_description_quality(normalized_products)

# 4. Rewrite weak descriptions
weak_skus = {issue.sku for issue in normalized_description_issues}
rewritten_products = rewrite_weak_descriptions(
    products=normalized_products,
    weak_skus=weak_skus,
)

# 5. Check after description rewriting
final_spec_issues = check_missing_specs(rewritten_products)
final_description_issues = check_description_quality(rewritten_products)

# 6. Report
report = build_catalog_health_report(
    products=products,
    messy_spec_issues=messy_spec_issues,
    normalized_spec_issues=final_spec_issues,
    description_issues=final_description_issues,
)

print_catalog_health_report(report)

print("\nDESCRIPTION REWRITE RESULTS")
print("---------------------------")
print(f"Weak descriptions before rewrite: {len(normalized_description_issues)}")
print(f"Weak descriptions after rewrite: {len(final_description_issues)}")

print("\nSAMPLE REWRITES")
print("---------------")

for original, rewritten in zip(normalized_products, rewritten_products):
    if original.sku in weak_skus:
        print(f"\nSKU: {original.sku}")
        print(f"Before: {original.description}")
        print(f"After:  {rewritten.description}")