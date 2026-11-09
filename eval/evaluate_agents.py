"""Compatibility entry point; canonical implementation lives under ``eval.sql``."""

from eval.sql.evaluate_agents import *  # noqa: F403
from eval.sql.evaluate_agents import main


if __name__ == "__main__":
    raise SystemExit(main())
