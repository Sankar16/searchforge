import json
from src.schemas import Product
from src.catalog_agent.uom import normalize_catalog_uom
from src.catalog_agent.spec_checker import check_missing_specs
from src.catalog_agent.description_quality import check_description_quality
from src.catalog_agent.report import build_catalog_health_report, print_catalog_health_report


with open("data/catalog_messy.json", "r") as f:
    raw_catalog = json.load(f)

products = [Product(**item) for item in raw_catalog]

messy_spec_issues = check_missing_specs(products)
messy_description_issues = check_description_quality(products)

normalized_products = normalize_catalog_uom(products)

normalized_spec_issues = check_missing_specs(normalized_products)
normalized_description_issues = check_description_quality(normalized_products)

report = build_catalog_health_report(
    products=products,
    messy_spec_issues=messy_spec_issues,
    normalized_spec_issues=normalized_spec_issues,
    description_issues=normalized_description_issues,
)

print_catalog_health_report(report)

print("\nSAMPLE WEAK DESCRIPTIONS")
print("------------------------")
for issue in normalized_description_issues[:10]:
    print(issue)