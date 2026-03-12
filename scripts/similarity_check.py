#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from dataclasses import asdict, dataclass
from difflib import SequenceMatcher
from pathlib import Path
from typing import Iterable


DEFAULT_EXTENSIONS = (".ts", ".tsx", ".js", ".jsx")


@dataclass
class SimilarityMetrics:
    source_code_files: int
    baseline_code_files: int
    common_path_files: int
    source_only_files: int
    baseline_only_files: int
    path_jaccard_pct: float
    path_dice_pct: float
    exact_samepath_files: int
    exact_samepath_pct_of_common: float
    line_similarity_common_path_pct: float
    exact_content_intersection_files: int
    exact_content_overlap_pct_min_denom: float
    blended_similarity_pct: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Compare source similarity between two code trees.")
    parser.add_argument("--source", required=True, help="Path to source repo src directory.")
    parser.add_argument("--baseline", required=True, help="Path to baseline repo src directory.")
    parser.add_argument("--config", help="Optional JSON config with threshold settings.")
    parser.add_argument("--json", action="store_true", help="Emit JSON output.")
    parser.add_argument(
        "--extensions",
        nargs="+",
        default=list(DEFAULT_EXTENSIONS),
        help="Code file extensions to include.",
    )
    return parser.parse_args()


def list_code_files(root: Path, extensions: tuple[str, ...]) -> list[str]:
    return sorted(
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        if p.is_file() and p.suffix in extensions
    )


def read_lines(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8", errors="ignore").splitlines()


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def percent(num: float, den: float) -> float:
    if den == 0:
        return 0.0
    return (num / den) * 100.0


def compute_metrics(source_root: Path, baseline_root: Path, extensions: tuple[str, ...]) -> SimilarityMetrics:
    source_files = list_code_files(source_root, extensions)
    baseline_files = list_code_files(baseline_root, extensions)

    source_set = set(source_files)
    baseline_set = set(baseline_files)
    common_paths = sorted(source_set & baseline_set)

    source_count = len(source_files)
    baseline_count = len(baseline_files)
    common_count = len(common_paths)
    source_only = source_count - common_count
    baseline_only = baseline_count - common_count

    union_count = len(source_set | baseline_set)
    path_jaccard = percent(common_count, union_count)
    path_dice = percent(2 * common_count, source_count + baseline_count)

    exact_samepath = 0
    similarity_weighted_sum = 0.0
    similarity_weight_total = 0

    for rel_path in common_paths:
        source_lines = read_lines(source_root / rel_path)
        baseline_lines = read_lines(baseline_root / rel_path)

        if source_lines == baseline_lines:
            exact_samepath += 1

        weight = max(len(source_lines), len(baseline_lines), 1)
        ratio = SequenceMatcher(a=source_lines, b=baseline_lines, autojunk=False).ratio()
        similarity_weighted_sum += ratio * weight
        similarity_weight_total += weight

    line_similarity = percent(similarity_weighted_sum, similarity_weight_total)
    exact_samepath_pct = percent(exact_samepath, common_count)

    source_hashes = {hash_file(source_root / rel_path) for rel_path in source_files}
    baseline_hashes = {hash_file(baseline_root / rel_path) for rel_path in baseline_files}
    exact_intersection = len(source_hashes & baseline_hashes)
    exact_overlap_pct = percent(exact_intersection, min(source_count, baseline_count))

    blended = (0.25 * path_dice) + (0.75 * line_similarity)

    return SimilarityMetrics(
        source_code_files=source_count,
        baseline_code_files=baseline_count,
        common_path_files=common_count,
        source_only_files=source_only,
        baseline_only_files=baseline_only,
        path_jaccard_pct=path_jaccard,
        path_dice_pct=path_dice,
        exact_samepath_files=exact_samepath,
        exact_samepath_pct_of_common=exact_samepath_pct,
        line_similarity_common_path_pct=line_similarity,
        exact_content_intersection_files=exact_intersection,
        exact_content_overlap_pct_min_denom=exact_overlap_pct,
        blended_similarity_pct=blended,
    )


def load_config(path: Path | None) -> dict:
    if path is None:
        return {}
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def check_thresholds(metrics: SimilarityMetrics, config: dict) -> list[str]:
    failures: list[str] = []
    metric_dict = asdict(metrics)

    threshold_map = {
        "max_path_dice_pct": "path_dice_pct",
        "max_path_jaccard_pct": "path_jaccard_pct",
        "max_shared_path_line_similarity_pct": "line_similarity_common_path_pct",
        "max_blended_similarity_pct": "blended_similarity_pct",
        "max_exact_samepath_files": "exact_samepath_files",
        "max_exact_content_intersection_files": "exact_content_intersection_files",
    }

    for config_key, metric_key in threshold_map.items():
        if config_key not in config:
            continue
        threshold = config[config_key]
        value = metric_dict[metric_key]
        if value > threshold:
            failures.append(f"{metric_key}={value:.4f} exceeded {config_key}={threshold}")

    return failures


def print_text_report(metrics: SimilarityMetrics, failures: Iterable[str]) -> None:
    print(f"SOURCE_CODE_FILES={metrics.source_code_files}")
    print(f"BASELINE_CODE_FILES={metrics.baseline_code_files}")
    print(f"COMMON_PATH_FILES={metrics.common_path_files}")
    print(f"SOURCE_ONLY_FILES={metrics.source_only_files}")
    print(f"BASELINE_ONLY_FILES={metrics.baseline_only_files}")
    print(f"PATH_JACCARD_PCT={metrics.path_jaccard_pct:.4f}")
    print(f"PATH_DICE_PCT={metrics.path_dice_pct:.4f}")
    print(f"EXACT_SAMEPATH_FILES={metrics.exact_samepath_files}")
    print(f"EXACT_SAMEPATH_PCT_OF_COMMON={metrics.exact_samepath_pct_of_common:.4f}")
    print(f"LINE_SIMILARITY_COMMON_PATH_PCT={metrics.line_similarity_common_path_pct:.4f}")
    print(f"EXACT_CONTENT_INTERSECTION_FILES={metrics.exact_content_intersection_files}")
    print(f"EXACT_CONTENT_OVERLAP_PCT_MIN_DENOM={metrics.exact_content_overlap_pct_min_denom:.4f}")
    print(f"BLENDED_SIMILARITY_PCT={metrics.blended_similarity_pct:.4f}")
    if failures:
        print("THRESHOLD_RESULT=FAIL")
        for failure in failures:
            print(f"FAILURE={failure}")
    else:
        print("THRESHOLD_RESULT=PASS")


def main() -> int:
    args = parse_args()
    source_root = Path(args.source).resolve()
    baseline_root = Path(args.baseline).resolve()
    config_path = Path(args.config).resolve() if args.config else None

    if not source_root.exists():
        print(f"Source path not found: {source_root}", file=sys.stderr)
        return 2
    if not baseline_root.exists():
        print(f"Baseline path not found: {baseline_root}", file=sys.stderr)
        return 2

    extensions = tuple(args.extensions)
    metrics = compute_metrics(source_root, baseline_root, extensions)
    config = load_config(config_path)
    failures = check_thresholds(metrics, config)

    if args.json:
        payload = asdict(metrics)
        payload["threshold_failures"] = failures
        print(json.dumps(payload, indent=2))
    else:
        print_text_report(metrics, failures)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
