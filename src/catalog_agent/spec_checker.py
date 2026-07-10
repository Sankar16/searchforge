from typing import List, Dict, Any
from src.schemas import Product, CatalogIssue


PRODUCT_TYPE_REQUIRED_SPECS: Dict[str, List[str]] = {
    # Bearings
    "bearing": ["inner_diameter_mm", "outer_diameter_mm", "width_mm"],

    # Housings / mounts
    "pillow_block_housing": ["compatible_bearing_series", "shaft_diameter_mm", "mount_type"],
    "flange_housing": ["compatible_bearing_series", "shaft_diameter_mm", "mount_type"],
    "motor_mount": ["compatible_motor_frame", "material"],

    # Shaft / coupling
    "shaft": ["diameter_mm", "material"],
    "shaft_coupling": ["bore_diameter_mm", "coupling_type", "material"],
    "vibration_pad": ["material", "application"],

    # Fasteners
    "bolt": ["diameter_mm", "length_mm", "material"],
    "screw": ["diameter_mm", "length_mm", "material"],
    "washer": ["inner_diameter_mm", "outer_diameter_mm", "thickness_mm", "material"],
    "nut": ["diameter_mm", "thread_pitch_mm", "material"],
    "anchor": ["diameter_mm", "length_mm", "material"],
    "hardware_kit": ["diameter_mm", "material"],
    "shaft_key": ["width_mm", "height_mm", "length_mm", "material"],
    "grease_fitting": ["thread_size", "fitting_type", "material"],
    "threadlocker": ["strength", "color", "application"],

    # Pipe fittings
    "pipe_elbow": ["size_inch", "material", "fitting_type"],
    "pipe_tee": ["size_inch", "thread_type", "material", "fitting_type"],
    "pipe_coupling": ["size_inch", "thread_type", "material", "fitting_type"],
    "pipe_adapter": ["size_inch", "material", "fitting_type"],
    "pipe_reducer": ["size_inch", "reduced_size_inch", "thread_type", "material"],
    "pipe_nipple": ["size_inch", "thread_type", "material", "fitting_type"],
    "pipe_union": ["size_inch", "thread_type", "material", "fitting_type"],
    "pipe_clamp": ["size_inch", "material", "mount_type"],
    "thread_sealant": ["application"],

    # Valves
    "valve": ["size_inch", "pressure_rating_psi", "material", "valve_type"],

    # Accessories / tools
    "bearing_grease": ["grease_type", "nlgi_grade", "application"],
    "pipe_wrench": ["length_in", "tool_type", "material"],
}


SPEC_ALIASES: Dict[str, List[str]] = {
    "inner_diameter_mm": ["inner_diameter_mm", "bore", "inner_diameter", "id"],
    "outer_diameter_mm": ["outer_diameter_mm", "od", "outer_diameter"],
    "width_mm": ["width_mm", "width"],

    "diameter_mm": ["diameter_mm", "diameter", "thread_size"],
    "length_mm": ["length_mm", "length"],
    "thread_pitch_mm": ["thread_pitch_mm", "thread_pitch"],
    "material": ["material"],

    "size_inch": ["size_inch", "size"],
    "thread_type": ["thread_type", "thread"],
    "pressure_rating_psi": ["pressure_rating_psi", "pressure_rating", "pressure"],

    "compatible_bearing_series": [
        "compatible_bearing_series",
        "compatible_bearing",
        "compatible_housing_series",
    ],
    "shaft_diameter_mm": ["shaft_diameter_mm", "shaft_size"],
    "mount_type": ["mount_type", "mount"],

    "compatible_motor_frame": ["compatible_motor_frame"],
    "bore_diameter_mm": ["bore_diameter_mm"],
    "coupling_type": ["coupling_type"],
    "included_items": ["included_items"],
    "width_mm": ["width_mm", "width"],
    "height_mm": ["height_mm", "height"],

    "fitting_type": ["fitting_type"],
    "reduced_size_inch": ["reduced_size_inch"],
    "application": ["application"],
    "grease_type": ["grease_type"],
    "nlgi_grade": ["nlgi_grade"],
    "tool_type": ["tool_type"],
    "strength": ["strength"],
    "color": ["color"],
}


def has_spec(specs: Dict[str, Any], required_spec: str) -> bool:
    possible_keys = SPEC_ALIASES.get(required_spec, [required_spec])

    for key in possible_keys:
        if key in specs and specs.get(key) not in [None, "", []]:
            return True

    return False


def infer_product_type(product: Product) -> str:
    name = product.name.lower()
    category = product.category.lower()

    # Accessories/tools should be checked early
    if "pipe wrench" in name:
        return "pipe_wrench"

    if "bearing grease" in name or "grease cartridge" in name:
        return "bearing_grease"

    if "threadlocker" in name:
        return "threadlocker"

    if "grease zerk" in name or "grease fitting" in name:
        return "grease_fitting"

    # Housings / mounts should come before bolt/screw detection
    if "pillow block" in name or name.startswith("p205") or name.startswith("p204"):
        return "pillow_block_housing"

    if "flange housing" in name or "flange" in name or name.startswith("fl205") or name.startswith("fl204"):
        return "flange_housing"

    if "motor mount" in name or "base plate" in name:
        return "motor_mount"

    if "vibration" in name or "isolation pad" in name:
        return "vibration_pad"

    if "bearing mount" in name:
        return "pillow_block_housing"

    # Shaft/coupling/key should come before generic fastener checks
    if "shaft key" in name:
        return "shaft_key"

    if "shaft coupling" in name or "flexible shaft coupling" in name:
        return "shaft_coupling"

    if "steel shaft" in name or name.endswith("shaft"):
        return "shaft"

    # Valves
    # Important: valve adapter is a pipe fitting, not a valve
    if "valve adapter" not in name and "valve" in name:
        return "valve"

    # Pipe fittings
    if "thread seal" in name or "ptfe" in name or "seal tape" in name or "sealant" in name:
        return "thread_sealant"

    if "elbow" in name:
        return "pipe_elbow"

    # Use spaces to avoid matching "tee" inside "steel"
    if " tee " in f" {name} " or name.endswith(" tee fitting"):
        return "pipe_tee"

    if "reducer" in name or "bushing" in name:
        return "pipe_reducer"

    if "nipple" in name:
        return "pipe_nipple"

    if "union" in name:
        return "pipe_union"

    if "pipe support clamp" in name or "pipe clamp" in name:
        return "pipe_clamp"

    if "hose barb" in name or "adapter" in name:
        return "pipe_adapter"

    if "coupling" in name and "shaft" not in name:
        return "pipe_coupling"

    if "threaded pipe fitting" in name or category == "pipe fittings":
        return "pipe_adapter"

    # Fasteners
    # Specific items before generic bolt/screw
    if "washer" in name:
        return "washer"

    if "nut" in name:
        return "nut"

    if "anchor" in name:
        return "anchor"

    if "hardware kit" in name or "bolt kit" in name:
        return "hardware_kit"

    if "bolt" in name or "cap screw" in name:
        return "bolt"

    if "machine screw" in name or "socket head" in name or "screw" in name:
        return "screw"

    # Bearings should come after bearing grease, housings, and mounts
    if "bearing" in name:
        return "bearing"

    if category in ["bearings", "bearing"]:
        return "bearing"

    return "unknown"


def check_missing_specs(products: List[Product]) -> List[CatalogIssue]:
    issues = []

    for product in products:
        product_type = infer_product_type(product)
        required_specs = PRODUCT_TYPE_REQUIRED_SPECS.get(product_type, [])

        if product_type == "unknown":
            # Unknown product types skip spec checking
            # Spec requirements are domain-specific and must be configured
            # per industry (industrial B2B, electronics, etc.)
            continue

        for spec in required_specs:
            if not has_spec(product.specs, spec):
                issues.append(
                    CatalogIssue(
                        sku=product.sku,
                        issue_type="missing_spec",
                        message=f"Missing required spec for {product_type}: {spec}",
                        severity="high"
                    )
                )

    return issues