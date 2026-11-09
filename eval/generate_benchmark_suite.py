"""Compatibility entry point; canonical implementation lives under ``eval.sql``."""

from eval.sql.generate_benchmark_suite import *  # noqa: F403
from eval.sql.generate_benchmark_suite import main


if __name__ == "__main__":
    main()
