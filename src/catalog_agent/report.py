from collections import Counter
from typing import List, Dict, Any
from src.schemas import Product, CatalogIssue


def summarize_issues(issues: List[CatalogIssue]) -> Dict[str, Any]:
    issue_type_counts = Counter(issue.issue_type for issue in issues)
    severity_counts = Counter(issue.severity for issue in issues)

    return {
        "total_issues": len(issues),
        "issue_type_counts": dict(issue_type_counts),
        "severity_counts": dict(severity_counts),
    }


def build_catalog_health_report(
    products: List[Product],
    messy_spec_issues: List[CatalogIssue],
    normalized_spec_issues: List[CatalogIssue],
    description_issues: List[CatalogIssue],
) -> Dict[str, Any]:
    all_current_issues = normalized_spec_issues + description_issues

    improvement = len(messy_spec_issues) - len(normalized_spec_issues)

    return {
        "total_products": len(products),
        "messy_spec_issues": len(messy_spec_issues),
        "normalized_spec_issues": len(normalized_spec_issues),
        "uom_issues_fixed": improvement,
        "weak_description_issues": len(description_issues),
        "total_current_issues": len(all_current_issues),
        "issue_summary": summarize_issues(all_current_issues),
    }


def print_catalog_health_report(report: Dict[str, Any]) -> None:
    print("\nCATALOG HEALTH REPORT")
    print("---------------------")
    print(f"Total products: {report['total_products']}")
    print(f"Spec issues before UOM normalization: {report['messy_spec_issues']}")
    print(f"Spec issues after UOM normalization: {report['normalized_spec_issues']}")
    print(f"UOM-related issues fixed: {report['uom_issues_fixed']}")
    print(f"Weak description issues: {report['weak_description_issues']}")
    print(f"Total current issues: {report['total_current_issues']}")

    print("\nIssue types:")
    for issue_type, count in report["issue_summary"]["issue_type_counts"].items():
        print(f"- {issue_type}: {count}")

    print("\nSeverity:")
    for severity, count in report["issue_summary"]["severity_counts"].items():
        print(f"- {severity}: {count}")